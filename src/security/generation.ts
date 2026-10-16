import type { Env } from "../index";

/** Fail-closed protection for every asset generation request. */
export function generationAccess(request: Request, env: Env): Response | null {
  if (env.GENERATION_ENABLED !== "true") {
    return Response.json({ error: "Generation is disabled (GENERATION_ENABLED != true)" }, { status: 503 });
  }
  if (!env.GENERATION_API_TOKEN || env.GENERATION_API_TOKEN.length < 24) {
    return Response.json({ error: "Generation API token is not configured securely" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.GENERATION_API_TOKEN}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Read-only job endpoints remain accessible after generation is switched off. */
export function jobAccess(request: Request, env: Env): Response | null {
  if (!env.GENERATION_API_TOKEN || env.GENERATION_API_TOKEN.length < 24) {
    return Response.json({ error: "Generation API token is not configured securely" }, { status: 503 });
  }
  if (request.headers.get("authorization") !== `Bearer ${env.GENERATION_API_TOKEN}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

/** Meshy accepts public HTTPS image URLs and base64 image data URIs. */
export function validateImageUrls(value: unknown): string[] {
  if (!Array.isArray(value) || value.length < 1 || value.length > 4) {
    throw new Error("imageUrls must contain 1 to 4 images");
  }
  let total = 0;
  return value.map((item) => {
    if (typeof item !== "string") throw new Error("Every image must be a string");
    const image = item.trim();
    if (image.startsWith("data:")) {
      if (!/^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(image)) {
        throw new Error("Only PNG, JPEG and WebP base64 data URIs are allowed");
      }
      if (image.length > 7_000_000) throw new Error("Image exceeds the 5 MB inline limit");
    } else {
      let url: URL;
      try { url = new URL(image); }
      catch { throw new Error("Images must use HTTPS URLs or supported data URIs"); }
      if (url.protocol !== "https:" || !url.hostname || url.username || url.password || image.length > 2048) {
        throw new Error("Images must use public HTTPS URLs without credentials");
      }
      if (url.hostname === "localhost" || url.hostname.endsWith(".local")) {
        throw new Error("Local image addresses are not public");
      }
    }
    total += image.length;
    if (total > 20_000_000) throw new Error("Combined image payload exceeds 20 MB");
    return image;
  });
}

/** Reserve one paid task BEFORE contacting the provider. This is intentionally
 * conservative: failed tasks still count against the daily budget. */
export async function reservePaidJob(env: Env): Promise<Response | null> {
  if (env.PAID_GENERATION_ENABLED !== "true") {
    return Response.json({ error: "Paid generation is disabled" }, { status: 403 });
  }
  if (!env.PAID_GENERATION_GUARD) {
    return Response.json({ error: "Persistent paid-generation quota is not configured" }, { status: 503 });
  }
  const limitValue = Number(env.MAX_PAID_JOBS_PER_DAY ?? "1");
  const limit = Number.isInteger(limitValue) && limitValue >= 1 && limitValue <= 10 ? limitValue : 1;
  try {
    const id = env.PAID_GENERATION_GUARD.idFromName("metaverse-creator-global-paid-quota");
    const guard = env.PAID_GENERATION_GUARD.get(id);
    const response = await guard.fetch("https://internal/consume", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ limit }),
    });
    if (!response.ok) {
      return Response.json({ error: "Paid task limit reached or quota unavailable" }, { status: response.status === 429 ? 429 : 503 });
    }
    return null;
  } catch {
    return Response.json({ error: "Paid task quota unavailable: request blocked" }, { status: 503 });
  }
}

export class PaidGenerationLimiter {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    if (request.method !== "POST" || new URL(request.url).pathname !== "/consume") {
      return new Response("Not found", { status: 404 });
    }
    let limit: number;
    try {
      const body = await request.json() as { limit?: unknown };
      if (!Number.isInteger(body.limit) || (body.limit as number) < 1 || (body.limit as number) > 10) {
        return new Response("Invalid quota", { status: 400 });
      }
      limit = body.limit as number;
    } catch {
      return new Response("Invalid quota", { status: 400 });
    }
    const key = `paid:${new Date().toISOString().slice(0, 10)}`;
    const permitted = await this.state.storage.transaction(async (storage) => {
      const spent = (await storage.get<number>(key)) ?? 0;
      if (spent >= limit) return false;
      await storage.put(key, spent + 1);
      return true;
    });
    return Response.json({ allowed: permitted }, { status: permitted ? 200 : 429 });
  }
}
