import { describe, expect, it } from "vitest";
import { buildCreatureSyncProceduralGlb } from "./procedural-glb";
import { ProceduralThreeDProvider } from "./procedural";

function gltfFrom(buffer:ArrayBuffer) {
  const view=new DataView(buffer);
  expect(view.getUint32(0,true)).toBe(0x46546c67);
  expect(view.getUint32(4,true)).toBe(2);
  expect(view.getUint32(8,true)).toBe(buffer.byteLength);
  const jsonLen=view.getUint32(12,true);
  expect(view.getUint32(16,true)).toBe(0x4e4f534a);
  const json=new TextDecoder().decode(new Uint8Array(buffer,20,jsonLen)).trim();
  return JSON.parse(json) as { accessors: { count:number }[]; asset:{version:string}; meshes:unknown[] };
}
describe("offline Creature-Sync GLB",()=>{
  it("has real 3D geometry, not a mock triangle, deterministically",()=>{
    const a=buildCreatureSyncProceduralGlb(), b=buildCreatureSyncProceduralGlb();
    expect(new Uint8Array(a)).toEqual(new Uint8Array(b));
    expect(a.byteLength).toBeGreaterThan(18_000);
    const gltf=gltfFrom(a);
    expect(gltf.asset.version).toBe("2.0");
    expect(gltf.meshes).toHaveLength(1);
    expect(gltf.accessors[0].count).toBeGreaterThan(900);
  });
  it("only generates the allowlisted console; no network or credits",async()=>{
    const provider=new ProceduralThreeDProvider();
    const job=await provider.createJob({prompt:"Creature-Sync Console",format:"glb"});
    expect(job.state).toBe("succeeded");
    expect((await provider.fetchModel(job)).status).toBe(200);
    await expect(provider.createJob({prompt:"whole island",format:"glb"})).rejects.toThrow("Creature-Sync");
    await expect(provider.getJob("arbitrary")).rejects.toThrow();
  });
});