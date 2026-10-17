import type { AssetJob, AssetJobInput, ThreeDProvider } from "../../types";
import { buildCreatureSyncProceduralGlb } from "./procedural-glb";

const ID = "creature-sync-console-v01";

/** Creates one explicitly named reproducible asset, never invents 3D from arbitrary text. */
export class ProceduralThreeDProvider implements ThreeDProvider {
  readonly name = "procedural";
  async createJob(input: AssetJobInput): Promise<AssetJob> {
    if (!/creature[ -]?sync/i.test(input.prompt)) {
      throw new Error("Procedural mode currently supports only Creature-Sync Console");
    }
    return { provider:this.name,providerJobId:ID,state:"succeeded",progress:100,modelUrl:"internal:procedural" };
  }
  async getJob(id:string):Promise<AssetJob> {
    if (id!==ID) throw new Error("Unknown procedural asset id");
    return { provider:this.name,providerJobId:ID,state:"succeeded",progress:100,modelUrl:"internal:procedural" };
  }
  async fetchModel(job:AssetJob):Promise<Response> {
    if(job.providerJobId!==ID)throw new Error("Unknown procedural asset id");
    return new Response(buildCreatureSyncProceduralGlb(),{
      headers:{"content-type":"model/gltf-binary"}
    });
  }
}
