import { describe, expect, it } from "vitest";
import app from "../index";
import type { Env } from "../index";
const token = "long-enough-private-token-for-testing";
const body = JSON.stringify({ imageUrls: ["https://example.com/front.png"], intent: "Creature-Sync" });
const request = (headers?: Record<string,string>) => app.request("/generate", {
  method: "POST", headers: { "content-type": "application/json", ...headers }, body,
}, { GENERATION_ENABLED: "true", GENERATION_API_TOKEN: token, THREE_D_PROVIDER: "mock", OCTOPUS_ENGINE_MOCK: "true" } as Env);
describe("generate route access", () => {
  it("refuses generation without authorization", async () => {
    expect((await request()).status).toBe(401);
  });
  it("accepts authorized mock multi-image test without billing", async () => {
    const response = await request({ authorization: "Bearer "+token });
    expect(response.status).toBe(202);
    const result = await response.json() as { provider: string; job: { id: string } };
    expect(result.provider).toBe("mock");
    expect(result.job.id).toBeTruthy();
  });
});
