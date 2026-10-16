import { Hono } from "hono";
import type { Env } from "../index";
import { NoExecutorError, generatePrompt } from "../adapters/octopus";
import { createLoreProvider } from "../adapters/lore";
import { createProviderForJob, createThreeDProvider } from "../adapters/three-d";
import { decodeJobId, encodeJobId } from "../adapters/three-d/job-id";
import type { GenerateRequest } from "../types";
import { generationAccess, jobAccess, reservePaidJob, validateImageUrls } from "../security/generation";

const MAX_INTENT_LENGTH = 4_000;

export const generateRoute = new Hono<{ Bindings: Env }>();

const links = (jobId: string) => ({
  status: `/jobs/${jobId}`,
  model: `/jobs/${jobId}/model.glb`,
});

/**
 * Creative intent -> context -> generated prompt -> asset job.
 *
 * The response is immediate and carries a job id: external asset providers take
 * minutes, which is longer than a Worker request may last. Callers poll the
 * status route and then download the model.
 */
generateRoute.post("/generate", async (c) => {
  const forbidden = generationAccess(c.req.raw, c.env);
  if (forbidden) return forbidden;
  let body: GenerateRequest;

  try {
    body = (await c.req.json()) as GenerateRequest;
  } catch {
    return c.json({ error: "Request body must be valid JSON" }, 400);
  }

  const intent = typeof body?.intent === "string" ? body.intent.trim() : "";

  const hasImageInput = Object.prototype.hasOwnProperty.call(body ?? {}, "imageUrls");
  let imageUrls: string[] = [];
  if (hasImageInput) {
    try { imageUrls = validateImageUrls(body.imageUrls); }
    catch (error) { return c.json({ error: (error as Error).message }, 400); }
  }

  if (!intent && !imageUrls.length) {
    return c.json({ error: "intent or imageUrls must be supplied" }, 400);
  }
  if (intent.length > MAX_INTENT_LENGTH) {
    return c.json({ error: `intent must not exceed ${MAX_INTENT_LENGTH} characters` }, 400);
  }

  const selectedProvider = (c.env.THREE_D_PROVIDER ?? "mock").trim().toLowerCase();
  if (imageUrls.length && !["mock", "meshy"].includes(selectedProvider)) {
    return c.json({ error: "Multi-view mode currently supports Meshy or explicit mock only" }, 400);
  }

  try {
    let prompt: string;
    let loreSource: string;
    let backendStatus: string;
    let operationId: string | undefined;

    if (imageUrls.length) {
      // Image-guided reconstruction needs no Octopus executor: pass image views
      // directly to Meshy. The optional intent is only an audit description.
      prompt = intent || "Image-guided 3D reconstruction from supplied views";
      loreSource = "image-views";
      backendStatus = "not-needed";
    } else {
      const loreProvider = createLoreProvider(c.env);
      const lore = await loreProvider.getContext(intent);
      const generation = await generatePrompt(intent, lore, c.env);
      prompt = generation.prompt;
      loreSource = lore.source;
      backendStatus = generation.backendStatus;
      operationId = generation.operationId;
    }

    const provider = createThreeDProvider(
      c.env,
      imageUrls.length ? (selectedProvider === "meshy" ? "meshy-multi" : "mock") : undefined,
    );

    // Atomic quota reservation before every paid provider request.
    if (provider.name !== "mock") {
      const rejected = await reservePaidJob(c.env);
      if (rejected) return rejected;
    }

    const job = await provider.createJob({
      prompt,
      format: "glb",
      ...(imageUrls.length ? { imageUrls } : {}),
    });
    const jobId = encodeJobId(job.provider, job.providerJobId);

    return c.json({
      status: "accepted",
      intent: intent || "Multi-view image reconstruction",
      prompt,
      provider: job.provider,
      job: {
        id: jobId,
        state: job.state,
        ...(job.progress !== undefined ? { progress: job.progress } : {}),
      },
      links: links(jobId),
      trace: {
        generatedAt: new Date().toISOString(),
        loreSource,
        backendStatus,
        ...(operationId ? { operationId } : {}),
      },
    }, 202);
  } catch (error) {
    // The backend has no executor for the capability: report it as its own
    // condition instead of silently substituting a locally composed prompt.
    if (error instanceof NoExecutorError) {
      return c.json(
        {
          status: "no-executor",
          error: error.message,
          backendStatus: error.status,
          ...(error.operationId ? { operationId: error.operationId } : {}),
        },
        503,
      );
    }

    const message = error instanceof Error ? error.message : "Generation failed";
    return c.json({ status: "failed", error: message }, 502);
  }
});

/** Progress of an asset job. The job id carries the provider: no storage needed. */
generateRoute.get("/jobs/:jobId", async (c) => {
  const forbidden = jobAccess(c.req.raw, c.env);
  if (forbidden) return forbidden;
  const jobId = c.req.param("jobId");

  try {
    const { provider: providerName, providerJobId } = decodeJobId(jobId);
    const provider = createProviderForJob(c.env, providerName);
    const job = await provider.getJob(providerJobId);

    return c.json({
      id: jobId,
      provider: job.provider,
      state: job.state,
      ...(job.progress !== undefined ? { progress: job.progress } : {}),
      ...(job.error ? { error: job.error } : {}),
      ready: job.state === "succeeded",
      links: links(jobId),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to read job";
    return c.json({ error: message }, message.includes("job id") ? 400 : 502);
  }
});

/** Streams the generated model. Nothing is stored by this service. */
generateRoute.get("/jobs/:jobId/model.glb", async (c) => {
  const forbidden = jobAccess(c.req.raw, c.env);
  if (forbidden) return forbidden;
  const jobId = c.req.param("jobId");

  let providerJobId: string;
  let providerName: string;

  try {
    ({ provider: providerName, providerJobId } = decodeJobId(jobId));
  } catch {
    return c.json({ error: "Malformed job id" }, 400);
  }

  try {
    const provider = createProviderForJob(c.env, providerName);
    const job = await provider.getJob(providerJobId);

    if (job.state === "failed") {
      return c.json({ error: job.error ?? "Asset generation failed" }, 502);
    }

    if (job.state !== "succeeded") {
      return c.json(
        {
          error: `Model is not ready yet (state: ${job.state})`,
          state: job.state,
          ...(job.progress !== undefined ? { progress: job.progress } : {}),
        },
        409,
      );
    }

    const upstream = await provider.fetchModel(job);

    if (!upstream.ok || !upstream.body) {
      return c.json({ error: "Model file could not be retrieved from the provider" }, 502);
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "content-type": "model/gltf-binary",
        "content-disposition": `attachment; filename="${providerJobId}.glb"`,
        "cache-control": "no-store",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to fetch model";
    return c.json({ error: message }, 502);
  }
});
