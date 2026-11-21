import { useEffect, useRef, useState } from "react";
import {
  AnimationMixer,
  type AnimationClip,
  AxesHelper,
  Box3,
  Group,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  type Object3D,
  PerspectiveCamera,
  Scene,
  TorusKnotGeometry,
  Vector3,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { disposeGlbScenes, loadGlbPreview } from "./glbPreview";
import { modelUrl, type Job } from "./services/api";
import { MAX_PLACEMENTS, PLACEMENT_LIMIT, readLayout, writeLayout, type Placement } from "./studioLayout";

const blacklaceDemoUrl = `${import.meta.env.BASE_URL}models/blacklace-dolmen.glb`;

function createViewport(host: HTMLDivElement, setError: (error: string | null) => void) {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("webgl2", { antialias: true });
  if (!context) throw new Error("WebGL 2 is unavailable on this device or browser.");

  canvas.setAttribute("aria-label", "3D scene preview");
  const renderer = new WebGLRenderer({ canvas, context, antialias: true });
  host.append(canvas);

  const scene = new Scene();
  scene.background = new Color("#0b0f15");
  const camera = new PerspectiveCamera(48, 1, 0.1, 60);
  camera.position.set(5, 4, 6);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 1, 0);
  controls.minDistance = 3;
  controls.maxDistance = 20;
  controls.maxPolarAngle = Math.PI / 2 - 0.025;
  controls.update();
  controls.saveState();

  const grid = new GridHelper(20, 20, "#445265", "#293544");
  const axes = new AxesHelper(2);
  axes.position.y = 0.01;
  const keyLight = new DirectionalLight("#fff3e5", 3);
  keyLight.position.set(4, 6, 3);
  scene.add(grid, axes, keyLight, new HemisphereLight("#d6e9ff", "#414457", 1.6));

  const rimLight = new DirectionalLight("#a6d7ff", 2);
  rimLight.position.set(-3, 2, -4);
  rimLight.visible = false;
  scene.add(rimLight);

  const geometry = new TorusKnotGeometry(0.9, 0.27, 96, 12);
  const material = new MeshStandardMaterial({ color: "#11cddd", roughness: 0.35 });
  const demo = new Mesh(geometry, material);
  demo.position.y = 1.5;
  scene.add(demo);
  const preview = new Group();
  const layout = new Group();
  scene.add(preview, layout);

  let mixer: AnimationMixer | null = null;
  let lastFrame: number | null = null;
  const render = () => {
    if (!context.isContextLost()) renderer.render(scene, camera);
  };
  const animate = (now: number) => {
    if (!mixer) return;
    mixer.update(lastFrame === null ? 0 : Math.min((now - lastFrame) / 1000, 0.1));
    lastFrame = now;
    render();
  };
  let previewCenterY = 1.25;
  const framePreview = () => {
    const halfFov = Math.atan(Math.tan(camera.fov * Math.PI / 360) * Math.min(1, camera.aspect));
    const distance = 1.85 / Math.sin(halfFov);
    controls.target.set(0, previewCenterY, 0);
    camera.position.copy(new Vector3(1, 0.45, 1.55).normalize().multiplyScalar(distance).add(controls.target));
    controls.update();
  };
  const resize = () => {
    const { clientWidth: width, clientHeight: height } = host;
    if (!width || !height) return;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(width, height, false);
    render();
  };
  const onLost = () => setError("The WebGL context was lost. Waiting for it to recover…");
  const onRestored = () => {
    resize();
    setError(null);
  };

  canvas.addEventListener("webglcontextlost", onLost);
  canvas.addEventListener("webglcontextrestored", onRestored);
  controls.addEventListener("change", render);
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  resize();

  return {
    updateDemo(visible: boolean, rotation: number) {
      if (visible && !demo.parent) scene.add(demo);
      if (!visible) demo.removeFromParent();
      demo.rotation.y = (rotation * Math.PI) / 180;
      render();
    },
    showModel(model: Object3D, clip?: AnimationClip) {
      const bounds = new Box3().setFromObject(model);
      const size = bounds.getSize(new Vector3());
      const extent = Math.max(size.x, size.y, size.z);
      if (!Number.isFinite(extent) || extent <= 0) throw new Error("The GLB has no visible bounds.");

      const center = bounds.getCenter(new Vector3());
      const scale = 2.5 / extent;
      previewCenterY = 0.02 + size.y * scale / 2;
      preview.scale.setScalar(scale);
      preview.position.set(-center.x * scale, 0.02 - bounds.min.y * scale, -center.z * scale);
      preview.add(model);
      rimLight.visible = true;
      framePreview();
      if (clip) {
        mixer = new AnimationMixer(model);
        mixer.clipAction(clip).play();
        renderer.setAnimationLoop(animate);
      }
      render();
    },
    clearModel() {
      renderer.setAnimationLoop(null);
      mixer?.stopAllAction();
      mixer = null;
      lastFrame = null;
      preview.clear();
      rimLight.visible = false;
      controls.reset();
      render();
    },
    setLayoutVisible(visible: boolean) {
      layout.visible = visible;
      render();
    },
    attachPlacement(id: string, model: Object3D) {
      const group = new Group();
      group.name = id;
      group.add(model);
      layout.add(group);
      return group;
    },
    positionPlacements(placements: Placement[]) {
      for (const placement of placements) {
        const group = layout.getObjectByName(placement.id);
        if (!group) continue;
        group.position.set(placement.x, 0.02, placement.z);
        group.rotation.y = placement.rotation * Math.PI / 180;
      }
      render();
    },
    clearLayout() {
      layout.clear();
      render();
    },
    resetView: () => preview.children.length ? framePreview() : controls.reset(),
    dispose() {
      observer.disconnect();
      controls.removeEventListener("change", render);
      controls.dispose();
      canvas.removeEventListener("webglcontextlost", onLost);
      canvas.removeEventListener("webglcontextrestored", onRestored);
      geometry.dispose();
      material.dispose();
      grid.dispose();
      axes.dispose();
      renderer.setAnimationLoop(null);
      mixer?.stopAllAction();
      renderer.dispose();
      canvas.remove();
    },
  };
}

export default function Studio({ job, onClosePreview }: {
  job: Job | null;
  onClosePreview: () => void;
}) {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<ReturnType<typeof createViewport> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [modelStatus, setModelStatus] = useState<{
    source: string | File;
    state: "ready" | "error";
    message?: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const url = job?.state === "succeeded" && job.ready ? modelUrl(job.id) : null;
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [showBlacklaceDemo, setShowBlacklaceDemo] = useState(false);
  const source = url ?? (showBlacklaceDemo ? blacklaceDemoUrl : localFile);
  const blacklacePreview = source === blacklaceDemoUrl;
  const status = modelStatus?.source === source ? modelStatus : null;
  const [layoutState, setLayoutState] = useState(() => {
    try {
      return { placements: readLayout(), error: null };
    } catch {
      return { placements: [] as Placement[], error: "Unable to read the saved Studio scene." };
    }
  });
  const { placements, error: storageError } = layoutState;
  const [layoutError, setLayoutError] = useState<string | null>(null);
  const layoutRef = useRef(placements);
  const modelKeys = JSON.stringify(placements.map(({ id, jobId }) => ({ id, jobId })));
  const [showDemo, setShowDemo] = useState(true);
  const [rotation, setRotation] = useState(0);

  useEffect(() => {
    if (!host.current) return;
    let scene: ReturnType<typeof createViewport>;
    try {
      scene = createViewport(host.current, setError);
      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Unable to initialize the 3D scene.");
      return;
    }

    viewport.current = scene;
    return () => {
      viewport.current = null;
      scene.dispose();
    };
  }, []);

  useEffect(() => {
    viewport.current?.updateDemo(!source && placements.length === 0 && showDemo, rotation);
    viewport.current?.setLayoutVisible(!source);
  }, [source, placements.length, showDemo, rotation]);

  useEffect(() => {
    layoutRef.current = placements;
    viewport.current?.positionPlacements(placements);
  }, [placements]);

  useEffect(() => {
    const scene = viewport.current;
    if (!scene) return;
    const models: Pick<Placement, "id" | "jobId">[] = JSON.parse(modelKeys);
    const controller = new AbortController();
    const loaded: Object3D[] = [];
    setLayoutError(null);

    for (const { id, jobId } of models) {
      loadGlbPreview(modelUrl(jobId), controller.signal).then((gltf) => {
        if (controller.signal.aborted) {
          disposeGlbScenes(gltf.scenes);
          return;
        }
        loaded.push(...gltf.scenes);
        scene.attachPlacement(id, gltf.scene);
        scene.positionPlacements(layoutRef.current);
      }).catch(() => {
        if (!controller.signal.aborted) setLayoutError("One or more saved assets could not be loaded.");
      });
    }

    return () => {
      controller.abort();
      if (viewport.current === scene) scene.clearLayout();
      disposeGlbScenes(loaded);
    };
  }, [modelKeys]);

  useEffect(() => {
    const scene = viewport.current;
    if (!source || !scene) return;
    const controller = new AbortController();
    const { signal } = controller;
    let scenes: Object3D[] = [];

    loadGlbPreview(source, signal).then((gltf) => {
      if (signal.aborted) {
        disposeGlbScenes(gltf.scenes);
        return;
      }
      scenes = gltf.scenes;
      scene.showModel(gltf.scene, gltf.animations[0]);
      setModelStatus({ source, state: "ready" });
    }).catch((failure: unknown) => {
      if (!signal.aborted) {
        setModelStatus({
          source,
          state: "error",
          message: failure instanceof Error ? failure.message : "Unable to preview the model.",
        });
      }
    });

    return () => {
      controller.abort();
      if (viewport.current === scene) scene.clearModel();
      disposeGlbScenes(scenes);
    };
  }, [source, attempt]);

  const save = (next: Placement[]) => {
    try {
      writeLayout(next);
      setLayoutState({ placements: next, error: null });
      return true;
    } catch {
      setLayoutState({ placements, error: "Unable to save the Studio scene on this device." });
      return false;
    }
  };

  const closePreview = () => {
    setModelStatus(null);
    if (url) onClosePreview();
    setLocalFile(null);
    setShowBlacklaceDemo(false);
  };

  const insert = () => {
    if (job?.provider !== "procedural" || status?.state !== "ready" || placements.length >= MAX_PLACEMENTS) return;
    if (save([...placements, {
      id: crypto.randomUUID(), jobId: job.id,
      x: (placements.length % 4 - 1.5) * 1.6, z: Math.floor(placements.length / 4) * 1.6, rotation: 0,
    }])) closePreview();
  };

  const move = (id: string, x: number, z: number, angle: number) => {
    save(placements.map((item) => item.id === id ? {
      ...item,
      x: Math.max(-PLACEMENT_LIMIT, Math.min(PLACEMENT_LIMIT, item.x + x)),
      z: Math.max(-PLACEMENT_LIMIT, Math.min(PLACEMENT_LIMIT, item.z + z)),
      rotation: (item.rotation + angle) % 360,
    } : item));
  };

  const toggleDemo = () => {
    setShowDemo(!showDemo);
    setRotation(0);
  };

  return (
    <div className="content">
      <section className="panel">
        {source ? (
          <>
            <h2>{blacklacePreview ? "Blacklace Island · Le dolmen" : "GLB preview"}</h2>
            <p className="muted">
              {url && job
                ? `Asset provider ${job.provider} · ${job.provider === "mock" ? "Mock asset" : job.provider === "procedural" ? "Procedural asset" : "Real asset"}`
                : blacklacePreview
                  ? <span lang="fr">Clairière circulaire, mousse phosphorescente et carré SATOR.</span>
                  : localFile?.name}
            </p>
            {!error && (
              <p className="muted" role="status">
                {status?.state === "ready" ? "Model loaded." : status?.message ?? "Loading model…"}
              </p>
            )}
          </>
        ) : placements.length ? (
          <h2>Local scene</h2>
        ) : (
          <h2><span lang="fr">Démo locale</span> · Procedural knot</h2>
        )}
        {storageError && <p role="status">{storageError}</p>}
        {!source && layoutError && <p role="status">{layoutError}</p>}
        <p id="studio-help" className="muted">
          Drag to orbit. Scroll or pinch to zoom. Right-drag or drag with two fingers to pan.
        </p>
        <div className="studio-viewport" ref={host} aria-describedby="studio-help">
          {error && <p className="studio-error" role="status">{error}</p>}
        </div>
        <div className="actions studio-actions">
          <button className="secondary" onClick={() => viewport.current?.resetView()} disabled={!!error}>
            Reset view
          </button>
          {!source && (
            <button className="primary" onClick={() => setShowBlacklaceDemo(true)} disabled={!!error}>
              Explorer le dolmen
            </button>
          )}
          {!source && (
            <label>
              Open a local GLB
              <input type="file" accept=".glb,model/gltf-binary" disabled={!!error}
                onChange={(event) => setLocalFile(event.target.files?.[0] ?? null)} />
            </label>
          )}
          {source ? (
            <>
              {url && <a className="secondary" href={url} download>Download GLB</a>}
              {job?.provider === "procedural" && status?.state === "ready" && (
                placements.length >= MAX_PLACEMENTS
                  ? <p className="muted">The local scene is full (12 assets).</p>
                  : <button className="primary" onClick={insert} disabled={!!error}>Insert into local scene</button>
              )}
              <button className="secondary" onClick={closePreview}>
                {placements.length ? "Return to local scene" : "Return to local demo"}
              </button>
              {status?.state === "error" && !error && (
                <button className="secondary" onClick={() => {
                  setModelStatus(null);
                  setAttempt((value) => value + 1);
                }}>Retry preview</button>
              )}
            </>
          ) : placements.length === 0 && (
            <button className="secondary" onClick={toggleDemo} disabled={!!error}>
              {showDemo ? "Remove demo object" : "Add demo object"}
            </button>
          )}
          {!source && placements.length === 0 && showDemo && (
            <label className="studio-rotation">
              Object rotation
              <input
                type="range" min="0" max="360" value={rotation} disabled={!!error}
                onChange={(event) => setRotation(event.target.valueAsNumber)}
              />
              <output>{rotation}°</output>
            </label>
          )}
        </div>
        {!source && placements.length > 0 && (
          <div className="studio-placements">
            <p className="muted">Placement saved in this browser.</p>
            {placements.map((item, index) => (
              <fieldset key={item.id}>
                <legend>Asset {index + 1}</legend>
                <div className="actions studio-actions">
                  <button className="secondary" onClick={() => move(item.id, -0.5, 0, 0)}>Left</button>
                  <button className="secondary" onClick={() => move(item.id, 0.5, 0, 0)}>Right</button>
                  <button className="secondary" onClick={() => move(item.id, 0, -0.5, 0)}>Back</button>
                  <button className="secondary" onClick={() => move(item.id, 0, 0.5, 0)}>Forward</button>
                  <button className="secondary" onClick={() => move(item.id, 0, 0, 45)}>Rotate</button>
                  <button className="secondary" onClick={() => save(placements.filter(({ id }) => id !== item.id))}>Remove</button>
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
