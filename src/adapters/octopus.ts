import type { Env } from "../index";
import type { LoreContext, MissionResponse } from "../types";

/**
 * Adapter for the configured generation backend (currently Octopus Engine).
 *
 * The backend exposes a single mission route rather than one route per
 * capability: the capability is part of the payload. See docs/octopus-contract.md
 * for the contract this implementation was written against.
 */

import { PROCEDURAL_CAPABILITY } from "./three-d/procedural";

const DEFAULT_MISSION_PATH = "/mission";
const DEFAULT_CAPABILITY = "content.generate";
const DEFAULT_TIMEOUT_MS = 30_000;

/**
 * The backend accepted the mission but no registered executor provides the
 * requested capability. This is a documented backend state, not a transport
 * failure, and it must surface explicitly rather than be papered over with a
 * locally composed prompt.
 */
export class NoExecutorError extends Error {
  readonly status: string;
  readonly operationId?: string;

  constructor(response: MissionResponse) {
    super(
      response.summary ??
        "The generation backend has no registered executor for the requested capability",
    );
    this.name = "NoExecutorError";
    this.status = response.status ?? "waiting-executor";
    if (response.operationId) this.operationId = response.operationId;
  }
}

export interface GenerationOutcome {
  prompt: string;
  backendStatus: string;
  operationId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstString(...values: unknown[]): string | undefined {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
}

/**
 * The backend leaves the shape of `output` to the executor that handled the
 * mission, so accept the common conventions instead of demanding one field.
 */
export function extractGeneratedText(payload: MissionResponse): string | undefined {
  const output = isRecord(payload.output) ? payload.output : {};

  const direct = firstString(
    output.text,
    output.content,
    output.prompt,
    output.result,
    output.generatedText,
  );
  if (direct) return direct;

  if (isRecord(output.result)) {
    const nested = firstString(output.result.text, output.result.content, output.result.prompt);
    if (nested) return nested;
  }

  for (const artifact of Array.isArray(payload.artifacts) ? payload.artifacts : []) {
    if (!isRecord(artifact)) continue;
    const value = firstString(artifact.content, artifact.text);
    if (value) return value;
    if (isRecord(artifact.content)) {
      const deep = firstString(artifact.content.text, artifact.content.prompt);
      if (deep) return deep;
    }
  }

  return undefined;
}

export function buildMissionRequest(
  intent: string,
  lore: LoreContext,
  capability: string,
  operationId: string,
): Record<string, unknown> {
  const procedural = capability === PROCEDURAL_CAPABILITY;
  const prompt = procedural ? intent : lore.context
    ? `${lore.context}\n\nCreative intention: ${intent}`
    : `Creative intention: ${intent}`;

  return {
    operationId,
    title: procedural ? "Plan a procedural 3D asset" : "Creative intention to 3D prompt",
    objective:
      procedural ? "Select a recipe for a supported 3D asset." : "Turn a creative intention and its supplied context into a detailed, coherent text-to-3D prompt.",
    requiredCapabilities: [capability],
    authorizedResources: procedural ? [] : ["mistral"],
    prompt,
    // The backend rejects a mission without a context id (CONTEXT_REQUIRED).
    // Only neutral metadata travels here: narrative content stays in `prompt`.
    context: {
      id: operationId,
      label: "metaverse-creator",
      objective: procedural ? "Select a procedural recipe." : "Generate a text-to-3D prompt.",
      metadata: {
        source: "metaverse-creator",
        contextSource: lore.source,
      },
    },
  };
}

export async function generatePrompt(
  intent: string,
  lore: LoreContext,
  env: Env,
): Promise<GenerationOutcome> {
  const procedural = env.THREE_D_PROVIDER?.trim().toLowerCase() === "procedural";
  if (procedural && env.OCTOPUS_ENGINE_MOCK === "true") {
    throw new Error("Procedural generation requires an Octopus executor. Disable the prompt mock.");
  }
  if (env.OCTOPUS_ENGINE_MOCK === "true") {
    return { prompt: mockPrompt(intent, lore), backendStatus: "mocked" };
  }

  if (!env.OCTOPUS_ENGINE_URL) {
    throw new Error("OCTOPUS_ENGINE_URL is required when the generation mock is disabled");
  }

  const baseUrl = env.OCTOPUS_ENGINE_URL.replace(/\/$/, "");
  const path = env.OCTOPUS_ENGINE_MISSION_PATH || DEFAULT_MISSION_PATH;
  const capability = procedural ? PROCEDURAL_CAPABILITY : env.OCTOPUS_ENGINE_CAPABILITY || DEFAULT_CAPABILITY;
  const operationId = `mvc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetch(`${baseUrl}${path.startsWith("/") ? path : `/${path}`}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(env.OCTOPUS_ENGINE_API_KEY
          ? { authorization: `Bearer ${env.OCTOPUS_ENGINE_API_KEY}` }
          : {}),
      },
      body: JSON.stringify(buildMissionRequest(intent, lore, capability, operationId)),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as MissionResponse;

    // Mission recorded, but nothing was generated: no executor provides the
    // capability. Surfaced as its own error so callers can say so precisely.
    if (response.status === 202 || data.status === "waiting-executor") {
      throw new NoExecutorError(data);
    }

    if (!response.ok) {
      throw new Error(`Generation backend returned HTTP ${response.status}`);
    }

    if (data.status === "failed" || data.status === "rejected") {
      throw new Error(data.summary ?? `Generation backend reported status "${data.status}"`);
    }

    const prompt = extractGeneratedText(data);

    if (!prompt) {
      throw new Error("Generation backend response did not contain a generated prompt");
    }

    return {
      prompt,
      backendStatus: data.status ?? "completed",
      ...(data.operationId ? { operationId: data.operationId } : {}),
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("Generation backend request timed out after 30 seconds");
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function mockPrompt(intent: string, lore: LoreContext): string {
  return [
    "Create a rich, coherent 3D environment prompt from this creative intention,",
    "preserving the requested narrative intent and the supplied context.",
    `Intention: ${intent}.`,
    lore.context ? `Context: ${lore.context}` : "",
  ]
    .filter(Boolean)
    .join(" ");
}
