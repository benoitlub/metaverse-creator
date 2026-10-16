import { describe, expect, it, vi } from "vitest";
import type { Env } from "../index";
import { generationAccess, jobAccess, reservePaidJob, validateImageUrls } from "./generation";

const token = "some-very-long-private-token-123456";
const req = (auth?: string) => new Request("https://example.com/generate", {
  headers: auth ? { authorization: auth } : {},
});

describe("generation protection", () => {
  it("stays disabled by default", () => {
    expect(generationAccess(req(), {} as Env)?.status).toBe(503);
  });
  it("requires a configured secret and refuses unknown callers", () => {
    expect(generationAccess(req(), { GENERATION_ENABLED: "true" } as Env)?.status).toBe(503);
    const env = { GENERATION_ENABLED: "true", GENERATION_API_TOKEN: token } as Env;
    expect(generationAccess(req(), env)?.status).toBe(401);
    expect(generationAccess(req("Bearer "+token), env)).toBeNull();
    expect(jobAccess(req(), env)?.status).toBe(401);
    expect(jobAccess(req("Bearer "+token), env)).toBeNull();
  });
  it("validates exactly one to four supported references", () => {
    expect(validateImageUrls(["https://example.com/a.png"])).toHaveLength(1);
    expect(validateImageUrls(["data:image/png;base64,YWJj"])).toHaveLength(1);
    for (const invalid of [[], Array(5).fill("https://example.com/x.png"), ["http://example.com/x.png"], ["file:///x"], ["data:image/svg+xml;base64,YWJj"], ["https://localhost/x"]]) {
      expect(() => validateImageUrls(invalid)).toThrow();
    }
  });
  it("rejects any paid call unless explicitly enabled and quota binding exists", async () => {
    expect((await reservePaidJob({} as Env))?.status).toBe(403);
    expect((await reservePaidJob({ PAID_GENERATION_ENABLED: "true" } as Env))?.status).toBe(503);
  });
  it("fails closed on quota refusal", async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 429 }));
    const guard = { idFromName: () => ({}), get: () => ({ fetch }) };
    const env = { PAID_GENERATION_ENABLED: "true", PAID_GENERATION_GUARD: guard } as unknown as Env;
    expect((await reservePaidJob(env))?.status).toBe(429);
    expect(fetch).toHaveBeenCalledOnce();
  });
});
