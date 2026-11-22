import { useEffect, useRef, useState } from "react";
import {
  AxesHelper,
  Color,
  DirectionalLight,
  GridHelper,
  HemisphereLight,
  Mesh,
  MeshStandardMaterial,
  PerspectiveCamera,
  Scene,
  TorusKnotGeometry,
  WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

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

  const geometry = new TorusKnotGeometry(0.9, 0.27, 96, 12);
  const material = new MeshStandardMaterial({ color: "#11cddd", roughness: 0.35 });
  const demo = new Mesh(geometry, material);
  demo.position.y = 1.5;
  scene.add(demo);

  const render = () => {
    if (!context.isContextLost()) renderer.render(scene, camera);
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
    resetView: () => controls.reset(),
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
      renderer.dispose();
      canvas.remove();
    },
  };
}

export default function Studio() {
  const host = useRef<HTMLDivElement>(null);
  const viewport = useRef<ReturnType<typeof createViewport> | null>(null);
  const [error, setError] = useState<string | null>(null);
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
    viewport.current?.updateDemo(showDemo, rotation);
  }, [showDemo, rotation]);

  const toggleDemo = () => {
    setShowDemo(!showDemo);
    setRotation(0);
  };

  return (
    <div className="content">
      <section className="panel">
        <h2><span lang="fr">Démo locale</span> · Procedural knot</h2>
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
          <button className="secondary" onClick={toggleDemo} disabled={!!error}>
            {showDemo ? "Remove demo object" : "Add demo object"}
          </button>
          {showDemo && (
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
      </section>
    </div>
  );
}
