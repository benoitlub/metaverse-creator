import { afterEach, describe, expect, it, vi } from "vitest";
import { MeshyMultiImageProvider } from "./meshy-multi";

afterEach(() => vi.unstubAllGlobals());

describe("Meshy multiview", () => {
  it("sends 1-4 views to the correct API with GLB output only", async () => {
    const fetch = vi.fn(async () => Response.json({ result: "job-123" }));
    vi.stubGlobal("fetch", fetch);
    const provider = new MeshyMultiImageProvider("test-only-key");
    const result = await provider.createJob({
      format: "glb", prompt: "Creature-Sync Console",
      imageUrls: ["https://example.com/front.png", "https://example.com/back.png"],
    });
    expect(result.provider).toBe("meshy-multi");
    expect(result.providerJobId).toBe("job-123");
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.meshy.ai/openapi/v1/multi-image-to-3d");
    const json = JSON.parse(String(init.body));
    expect(json.image_urls).toHaveLength(2);
    expect(json.target_formats).toEqual(["glb"]);
    expect(json.ai_model).toBe("meshy-7.1");
  });
  it("reads jobs from the multiview path, not text-to-3D", async () => {
    const fetch = vi.fn(async () => Response.json({
      status: "SUCCEEDED", progress: 100, model_urls: { glb: "https://example.com/console.glb" },
    }));
    vi.stubGlobal("fetch", fetch);
    const job = await new MeshyMultiImageProvider("test-only-key").getJob("job-123");
    expect(job.state).toBe("succeeded");
    expect(job.modelUrl).toContain("console.glb");
    expect(String(fetch.mock.calls[0][0])).toContain("/openapi/v1/multi-image-to-3d/job-123");
  });
  it("does not accept missing views or missing API keys", async () => {
    expect(() => new MeshyMultiImageProvider("")).toThrow();
    await expect(new MeshyMultiImageProvider("key").createJob({format:"glb",prompt:"test"})).rejects.toThrow();
  });
});
