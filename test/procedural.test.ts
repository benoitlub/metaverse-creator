import { afterEach, describe, expect, it, vi } from "vitest";
import app, { type Env } from "../src/index";

const env: Env = {
  OCTOPUS_ENGINE_URL: "http://octopus.test",
  THREE_D_PROVIDER: "procedural",
  LORE_PROVIDER: "none",
};

const generate = (intent: string) => app.request("/generate", {
  method: "POST",
  headers: { "content-type": "application/json" },
  body: JSON.stringify({ intent }),
}, env);

afterEach(() => vi.unstubAllGlobals());

describe("Octopus procedural assets", () => {
  it.each([
    ["Une caisse rouge", "Crate", 3],
    ["Un robot bleu", "Head", 9],
  ])("turns %s into a downloadable GLB", async (intent, name, nodeCount) => {
    vi.stubGlobal("fetch", async (url: string, options: RequestInit) => {
      expect(url).toBe("http://octopus.test/mission");
      const mission = JSON.parse(options.body as string);
      expect(mission).toMatchObject({
        prompt: intent,
        requiredCapabilities: ["asset.procedural.plan"],
        authorizedResources: [],
      });
      return app.request("/adapters/procedural/execute", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contract: "octopus-adapter-execution-v1", mission }),
      }, env);
    });

    const response = await generate(intent);
    expect(response.status).toBe(202);
    const result = await response.json() as { links: { status: string; model: string } };
    const status = await app.request(result.links.status, {}, env);
    expect(await status.json()).toMatchObject({ provider: "procedural", state: "succeeded", ready: true });

    const asset = await app.request(result.links.model, {}, env);
    expect(asset.headers.get("content-type")).toBe("model/gltf-binary");
    const data = await asset.arrayBuffer();
    const header = new DataView(data);
    expect(header.getUint32(0, true)).toBe(0x46546c67);
    expect(header.getUint32(8, true)).toBe(data.byteLength);
    const gltf = JSON.parse(new TextDecoder().decode(new Uint8Array(data, 20, header.getUint32(12, true))));
    expect(gltf.nodes).toHaveLength(nodeCount);
    expect(gltf.nodes[0].name).toBe(name);
  });

  it("rejects unsupported descriptions explicitly", async () => {
    const response = await app.request("/adapters/procedural/execute", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        contract: "octopus-adapter-execution-v1",
        mission: { requiredCapabilities: ["asset.procedural.plan"], prompt: "Un dragon" },
      }),
    }, env);
    expect(await response.json()).toMatchObject({ status: "failed" });
  });

  it("surfaces a missing executor without fabricating an asset", async () => {
    vi.stubGlobal("fetch", async () => Response.json({ status: "waiting-executor" }, { status: 202 }));
    const response = await generate("Un robot");
    expect(response.status).toBe(503);
    expect(await response.json()).toMatchObject({ status: "no-executor" });
  });
});
