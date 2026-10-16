import type { Env } from "../../index";
import type { ThreeDProvider } from "../../types";
import { MeshyProvider } from "./meshy";
import { MeshyMultiImageProvider } from "./meshy-multi";
import { MockThreeDProvider } from "./mock";
import { TripoProvider } from "./tripo";

export const SUPPORTED_PROVIDERS = ["mock", "meshy", "meshy-multi", "tripo"] as const;

/**
 * Single switching point between asset providers.
 * Selecting a provider is a binding change; no application code moves.
 */
export function createThreeDProvider(env: Env, override?: string): ThreeDProvider {
  const provider = (override ?? env.THREE_D_PROVIDER ?? "mock").trim().toLowerCase();

  switch (provider) {
    case "mock":
      return new MockThreeDProvider();
    case "meshy":
      return new MeshyProvider(env.THREE_D_API_KEY ?? "", env.THREE_D_API_URL);
    case "meshy-multi":
      return new MeshyMultiImageProvider(env.THREE_D_API_KEY ?? "", env.THREE_D_API_URL);
    case "tripo":
      return new TripoProvider(env.THREE_D_API_KEY ?? "", env.THREE_D_API_URL);
    default:
      throw new Error(
        `Unknown asset provider "${provider}". Supported: ${SUPPORTED_PROVIDERS.join(", ")}`,
      );
  }
}

/**
 * Resolves the provider a job was created with.
 *
 * The job id carries the provider name, so a job created on one provider keeps
 * being polled on that provider even if the binding changed in between.
 */
export function createProviderForJob(env: Env, provider: string): ThreeDProvider {
  if (!(SUPPORTED_PROVIDERS as readonly string[]).includes(provider)) {
    throw new Error(`Job id refers to an unknown asset provider "${provider}"`);
  }
  return createThreeDProvider(env, provider);
}

export { MockThreeDProvider } from "./mock";
export { MeshyProvider } from "./meshy";
export { MeshyMultiImageProvider } from "./meshy-multi";
export { TripoProvider } from "./tripo";
