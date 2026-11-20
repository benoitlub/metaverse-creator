import {
  InstancedMesh,
  Line,
  LoadingManager,
  type Material,
  Mesh,
  type Object3D,
  Points,
  type Skeleton,
  SkinnedMesh,
  Texture,
} from "three";

export async function loadGlbPreview(url: string, signal: AbortSignal) {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch {
    throw new Error("Unable to reach the model endpoint.");
  }
  if (!response.ok) throw new Error(`Model download failed (HTTP ${response.status}).`);

  const buffer = await response.arrayBuffer();
  const header = new DataView(buffer);
  if (buffer.byteLength < 12 || header.getUint32(0, true) !== 0x46546c67 ||
      header.getUint32(4, true) !== 2 || header.getUint32(8, true) !== buffer.byteLength) {
    throw new Error("The model endpoint returned an invalid GLB 2.0 file.");
  }

  // A GLB preview uses embedded assets. Reject references outside the file.
  const manager = new LoadingManager().setURLModifier((uri) => {
    if (/^(blob|data):/i.test(uri)) return uri;
    throw new Error("External GLB resources are unsupported.");
  });
  try {
    const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
    signal.throwIfAborted();
    const loader = new GLTFLoader(manager).register((parser) => ({
      name: "self-contained-preview",
      async beforeRoot() {
        const sources = [...(parser.json.buffers ?? []), ...(parser.json.images ?? [])];
        if (sources.some(({ uri }) => uri !== undefined && !/^data:/i.test(uri))) {
          throw new Error("External GLB resources are unsupported.");
        }
      },
    }));
    return await loader.parseAsync(buffer, "");
  } catch {
    throw new Error("Unable to read the GLB. It may be corrupt or use unsupported resources.");
  }
}

export function disposeGlbScenes(scenes: Object3D[]) {
  const geometries = new Set<Mesh["geometry"]>();
  const materials = new Set<Material>();
  const textures = new Set<Texture>();
  const skeletons = new Set<Skeleton>();
  const bitmaps = new Set<ImageBitmap>();
  for (const scene of scenes) {
    scene.traverse((object) => {
      if (object instanceof SkinnedMesh) skeletons.add(object.skeleton);
      if (object instanceof InstancedMesh) object.dispose();
      if (!(object instanceof Mesh || object instanceof Line || object instanceof Points)) return;
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (value instanceof Texture) textures.add(value);
        }
      }
    });
  }
  for (const skeleton of skeletons) skeleton.dispose();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  for (const texture of textures) {
    if (typeof ImageBitmap !== "undefined" && texture.image instanceof ImageBitmap) {
      bitmaps.add(texture.image);
    }
    texture.dispose();
  }
  for (const bitmap of bitmaps) bitmap.close();
}
