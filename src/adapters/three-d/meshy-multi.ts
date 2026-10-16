import type { AssetJob, AssetJobInput, AssetJobState, ThreeDProvider } from "../../types";

const DEFAULT_BASE_URL = "https://api.meshy.ai";
const TIMEOUT_MS = 30_000;

function mapState(status?: string): AssetJobState {
  if (status === "SUCCEEDED") return "succeeded";
  if (["FAILED", "EXPIRED", "CANCELED"].includes(status ?? "")) return "failed";
  if (status === "IN_PROGRESS") return "running";
  return "queued";
}

/** Meshy multi-image -> 3D. The first picture is the primary FRONT view.
 * The job provider id is distinct from text-to-3D to make polling reliable. */
export class MeshyMultiImageProvider implements ThreeDProvider {
  readonly name = "meshy-multi";
  private readonly baseUrl: string;

  constructor(private readonly apiKey: string, baseUrl?: string) {
    if (!apiKey) throw new Error("THREE_D_API_KEY is required for Meshy multi-image generation");
    this.baseUrl = (baseUrl ?? DEFAULT_BASE_URL).replace(/\/$/, "");
  }

  private headers(): Record<string, string> {
    return {
      "content-type": "application/json",
      accept: "application/json",
      authorization: `Bearer ${this.apiKey}`,
    };
  }

  async createJob(input: AssetJobInput): Promise<AssetJob> {
    if (!input.imageUrls?.length) throw new Error("Meshy multi-image generation requires imageUrls");
    const response = await fetch(`${this.baseUrl}/openapi/v1/multi-image-to-3d`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({
        image_urls: input.imageUrls,
        ai_model: "meshy-7.1",
        geometry_resolution: "standard",
        should_texture: true,
        enable_pbr: true,
        target_formats: ["glb"],
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    const payload = (await response.json().catch(() => ({}))) as { result?: string; message?: string };
    if (!response.ok || !payload.result) {
      throw new Error(payload.message ?? `Meshy rejected the task (HTTP ${response.status})`);
    }
    return { provider: this.name, providerJobId: payload.result, state: "queued", progress: 0 };
  }

  async getJob(providerJobId: string): Promise<AssetJob> {
    const response = await fetch(
      `${this.baseUrl}/openapi/v1/multi-image-to-3d/${encodeURIComponent(providerJobId)}`,
      { headers: this.headers(), signal: AbortSignal.timeout(TIMEOUT_MS) },
    );
    if (!response.ok) throw new Error(`Meshy status lookup failed (HTTP ${response.status})`);
    const task = (await response.json()) as {
      status?: string;
      progress?: number;
      model_urls?: { glb?: string };
      task_error?: { message?: string };
    };
    const state = mapState(task.status);
    return {
      provider: this.name,
      providerJobId,
      state,
      ...(typeof task.progress === "number" ? { progress: task.progress } : {}),
      ...(state === "succeeded" && task.model_urls?.glb ? { modelUrl: task.model_urls.glb } : {}),
      ...(task.task_error?.message ? { error: task.task_error.message } : {}),
    };
  }

  async fetchModel(job: AssetJob): Promise<Response> {
    if (!job.modelUrl) throw new Error("Meshy did not provide a GLB URL");
    return fetch(job.modelUrl, { signal: AbortSignal.timeout(TIMEOUT_MS) });
  }
}
