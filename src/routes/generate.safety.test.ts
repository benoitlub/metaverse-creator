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
  it("executes an authenticated multiview mock job through to downloadable GLB", async () => {
    const auth = { authorization: "Bearer " + token };
    const env = {
      GENERATION_ENABLED: "true",
      GENERATION_API_TOKEN: token,
      THREE_D_PROVIDER: "mock",
      OCTOPUS_ENGINE_MOCK: "true",
      PAID_GENERATION_ENABLED: "false",
    } as Env;
    // This is deliberately a simulated provider; no network, key, or paid credit.
    const created = await app.request("/generate", {
      method: "POST",
      headers: { "content-type": "application/json", ...auth },
      body: JSON.stringify({
        intent: "Creature-Sync Console",
        imageUrls: [
          "https://example.com/front.png",
          "https://example.com/rear.png",
          "https://example.com/left.png",
          "https://example.com/right.png",
        ],
      }),
    }, env);
    expect(created.status).toBe(202);
    const result = await created.json() as {
      provider: string;
      job: { id: string };
      trace: { loreSource: string; backendStatus: string };
    };
    expect(result.provider).toBe("mock");
    expect(result.trace.loreSource).toBe("image-views");
    expect(result.trace.backendStatus).toBe("not-needed");
    expect(result.job.id).toBeTruthy();

    const url = "/jobs/" + encodeURIComponent(result.job.id);
    const unauthenticated = await app.request(url, {}, env);
    expect(unauthenticated.status).toBe(401);

    const pending = await app.request(url + "/model.glb", { headers: auth }, env);
    expect(pending.status).toBe(409);

    // The stateless mock intentionally models asynchronous job completion.
    await new Promise((resolve) => setTimeout(resolve, 1550));

    const status = await app.request(url, { headers: auth }, env);
    expect(status.status).toBe(200);
    const statusJson = await status.json() as { state: string; ready: boolean };
    expect(statusJson.state).toBe("succeeded");
    expect(statusJson.ready).toBe(true);

    const download = await app.request(url + "/model.glb", { headers: auth }, env);
    expect(download.status).toBe(200);
    expect(download.headers.get("content-type")).toBe("model/gltf-binary");
    const glb = new DataView(await download.arrayBuffer());
    expect(glb.getUint32(0, true)).toBe(0x46546c67); // binary glTF magic
    expect(glb.getUint32(4, true)).toBe(2);
    expect(glb.getUint32(8, true)).toBe(glb.byteLength);
  }, 8_000);
});
