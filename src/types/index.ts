export interface GenerateRequest {
  intent?: string;
  /** Ordered views: front first. Use HTTPS URLs or PNG/JPEG/WebP base64 data URIs. */
  imageUrls?: string[];
}

export interface LoreContext {
  source: string;
  context: string;
}

export interface LoreProvider {
  getContext(intent: string): Promise<LoreContext>;
}

/**
 * Response envelope of the generation backend's mission route.
 * The backend leaves the exact shape of `output` to whichever executor handled
 * the mission, so consumers must read it defensively.
 */
export interface MissionResponse {
  status?: string;
  operationId?: string;
  missionId?: string;
  contextId?: string;
  summary?: string;
  output?: Record<string, unknown>;
  artifacts?: unknown[];
}

/** Trace kept on every generation so a result stays auditable over time. */
export interface GenerationTrace {
  generatedAt: string;
  loreSource: string;
  backendStatus?: string;
  operationId?: string;
}

export type AssetJobState = "queued" | "running" | "succeeded" | "failed";

export interface AssetJobInput {
  prompt: string;
  negativePrompt?: string;
  seed?: number;
  format: "glb";
  imageUrls?: string[];
}

/** Normalised view of a job held by an external asset provider. */
export interface AssetJob {
  provider: string;
  providerJobId: string;
  state: AssetJobState;
  /** 0..100 when the provider reports it. */
  progress?: number;
  /** Only meaningful once `state` is "succeeded". */
  modelUrl?: string;
  error?: string;
}

/**
 * Asset generation boundary.
 *
 * The interface is job-based because real providers are asynchronous: a
 * generation takes minutes, which is longer than a Worker request may last.
 * A provider that answers synchronously returns an already-succeeded job.
 */
export interface ThreeDProvider {
  readonly name: string;
  createJob(input: AssetJobInput): Promise<AssetJob>;
  getJob(providerJobId: string): Promise<AssetJob>;
  /** Returns the asset as a stream. Callers never assume where it is stored. */
  fetchModel(job: AssetJob): Promise<Response>;
}

export interface GenerateResult {
  status: "accepted";
  intent: string;
  prompt: string;
  provider: string;
  job: {
    id: string;
    state: AssetJobState;
    progress?: number;
  };
  links: {
    status: string;
    model: string;
  };
  trace: GenerationTrace;
}
