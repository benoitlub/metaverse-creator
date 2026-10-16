import { getApiBase, getApiToken } from "./config";

/**
 * Carries the response body alongside the status.
 *
 * The service reports failures explicitly — a missing binding, an asset
 * provider error, or a generation backend with no registered executor. The UI
 * must be able to show what actually went wrong instead of a generic message.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly payload: Record<string, unknown>;

  constructor(status: number, payload: Record<string, unknown>, fallback: string) {
    super(typeof payload.error === "string" ? payload.error : fallback);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...init,
      headers: {
        Accept: "application/json",
        ...(getApiToken() ? { Authorization: `Bearer ${getApiToken()}` } : {}),
        ...(init?.body ? { "Content-Type": "application/json" } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error(`Cannot reach the service at ${getApiBase()}`);
  }

  const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;

  if (!response.ok) {
    throw new ApiError(response.status, payload, `${response.status} ${response.statusText}`);
  }

  return payload as T;
}
