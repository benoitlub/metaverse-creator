/**
 * Builds a minimal but valid GLB (binary glTF 2.0): a single triangle.
 *
 * The mock provider therefore returns a real file that Unity can import, not a
 * placeholder descriptor. That keeps the whole chain — route, job, download,
 * import — testable without any external credential.
 *
 * All values are written little-endian through a DataView, as the glTF
 * specification requires.
 */

import { align4, packGlb } from "./glb";

const POSITIONS = [0, 0, 0, 1, 0, 0, 0, 1, 0];
const INDICES = [0, 1, 2];

export function buildMockGlb(name = "GeneratedAsset"): ArrayBuffer {
  const positionsBytes = POSITIONS.length * 4;
  const indicesBytes = INDICES.length * 2;
  const indicesOffset = align4(positionsBytes);
  const binLength = align4(indicesOffset + indicesBytes);

  const gltf = {
    asset: { version: "2.0", generator: "metaverse-creator (mock)" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name }],
    meshes: [{ name, primitives: [{ attributes: { POSITION: 0 }, indices: 1 }] }],
    buffers: [{ byteLength: binLength }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: positionsBytes, target: 34962 },
      { buffer: 0, byteOffset: indicesOffset, byteLength: indicesBytes, target: 34963 },
    ],
    accessors: [
      {
        bufferView: 0,
        componentType: 5126, // FLOAT
        count: 3,
        type: "VEC3",
        min: [0, 0, 0],
        max: [1, 1, 0],
      },
      {
        bufferView: 1,
        componentType: 5123, // UNSIGNED_SHORT
        count: 3,
        type: "SCALAR",
      },
    ],
  };

  const binary = new Uint8Array(binLength);
  const view = new DataView(binary.buffer);
  POSITIONS.forEach((value, index) => view.setFloat32(index * 4, value, true));
  INDICES.forEach((value, index) => view.setUint16(indicesOffset + index * 2, value, true));
  return packGlb(gltf, binary);
}
