import { useCallback, useEffect, useRef, useState } from "react";
import {
  Boxes,
  Cable,
  Cpu,
  Download,
  FolderOpen,
  Gauge,
  History,
  Layers3,
  Settings,
  Sparkles,
  Workflow,
} from "lucide-react";
import { getApiBase, setApiBase, getApiToken, setApiToken } from "./services/config";
import {
  getHealth,
  getJob,
  downloadModel,
  startImageGeneration,
  startGeneration,
  type GenerationStarted,
  type Health,
  type Job,
} from "./services/api";

type Page =
  | "dashboard"
  | "worlds"
  | "scenes"
  | "bridge"
  | "operations"
  | "ai"
  | "providers"
  | "settings";

const nav: Array<{ id: Page; label: string; icon: typeof Gauge }> = [
  { id: "dashboard", label: "Dashboard", icon: Gauge },
  { id: "worlds", label: "Worlds & Scenes", icon: Layers3 },
  { id: "scenes", label: "Scene Inspector", icon: Boxes },
  { id: "bridge", label: "Unity Bridge", icon: Cable },
  { id: "operations", label: "Operations", icon: History },
  { id: "ai", label: "AI / Generation", icon: Sparkles },
  { id: "providers", label: "Providers", icon: Workflow },
  { id: "settings", label: "Settings", icon: Settings },
];

const errorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

export function App() {
  const [page, setPage] = useState<Page>("dashboard");
  const [apiBase, setApiBaseState] = useState(getApiBase());
  const [health, setHealth] = useState<Health | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);

  const refreshHealth = useCallback(() => {
    getHealth()
      .then((value) => {
        setHealth(value);
        setHealthError(null);
      })
      .catch((error: unknown) => {
        setHealth(null);
        setHealthError(errorMessage(error, "Service unreachable"));
      });
  }, []);

  useEffect(refreshHealth, [refreshHealth]);

  const saveApi = (token: string) => {
    setApiBase(apiBase);
    setApiToken(token);
    setApiBaseState(getApiBase());
    refreshHealth();
  };

  const online = health !== null;

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">◉</div>
          <div>
            <strong>Metaverse Creator</strong>
            <span>COCKPIT</span>
          </div>
        </div>
        <div className="nav-title">NAVIGATION</div>
        <nav>
          {nav.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              className={page === id ? "nav-item active" : "nav-item"}
              onClick={() => setPage(id)}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="source-card">
          <span className={online ? "status-dot live" : "status-dot"} />
          {online ? "SERVICE ONLINE" : "SERVICE OFFLINE"}
          <small>{healthError ?? getApiBase()}</small>
        </div>
      </aside>

      <main className="main">
        <header className="topbar">
          <div>
            <span className="eyebrow">METAVERSE CREATOR</span>
            <h1>{nav.find((item) => item.id === page)?.label}</h1>
          </div>
          <div className="toolbar">
            <button className="mode" onClick={refreshHealth}>
              REFRESH
            </button>
            <button className="primary" onClick={() => setPage("ai")}>
              New generation →
            </button>
          </div>
        </header>

        {page === "dashboard" && (
          <Dashboard health={health} healthError={healthError} onGenerate={() => setPage("ai")} />
        )}
        {page === "ai" && <GenerationPanel health={health} />}
        {page !== "dashboard" && page !== "ai" && page !== "settings" && <Workspace page={page} />}
        {page === "settings" && (
          <SettingsPanel apiBase={apiBase} setApiBase={setApiBaseState} saveApi={saveApi} />
        )}
      </main>
    </div>
  );
}

function MetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <section className="metric">
      <span className="eyebrow">{label}</span>
      <strong>{value}</strong>
      {hint !== undefined && <small>{hint}</small>}
    </section>
  );
}

/**
 * Every value here comes from `GET /health`. When the service is unreachable
 * the dashboard says so rather than showing plausible-looking numbers.
 */
function Dashboard({
  health,
  healthError,
  onGenerate,
}: {
  health: Health | null;
  healthError: string | null;
  onGenerate: () => void;
}) {
  if (!health) {
    return (
      <div className="content">
        <section className="panel empty">
          <FolderOpen size={28} />
          <strong>Service unreachable</strong>
          <span>{healthError ?? "No response from the configured API base."}</span>
          <span>Start the Worker with `npm run dev`, or change the base URL in Settings.</span>
        </section>
      </div>
    );
  }

  const { context, generation, asset } = health.providers;

  return (
    <div className="content">
      <div className="metrics">
        <MetricCard label="SERVICE" value={health.status.toUpperCase()} hint={health.service} />
        <MetricCard
          label="GENERATION"
          value={generation.mode.toUpperCase()}
          hint={generation.capability}
        />
        <MetricCard
          label="CONTEXT"
          value={context.name.toUpperCase()}
          hint={context.endpointConfigured ? "Endpoint configured" : "No endpoint"}
        />
        <MetricCard
          label="ASSET PROVIDER"
          value={asset.name.toUpperCase()}
          hint={asset.credentialConfigured ? "Credential configured" : "No credential"}
        />
      </div>

      <div className="grid">
        <section className="panel">
          <div className="panel-head">
            <span>PIPELINE</span>
            <Sparkles size={16} />
          </div>
          <h2>Creative intent to GLB</h2>
          <p className="muted">
            The service turns an intention into a prompt through the generation backend, then hands
            that prompt to the asset provider and streams back a GLB.
          </p>
          <div className="pipeline">
            <span>intent</span>
            <i />
            <span>{context.name}</span>
            <i />
            <span>{generation.mode === "mock" ? "generation (mock)" : "generation"}</span>
            <i />
            <span>{asset.name}</span>
            <i />
            <span>GLB</span>
          </div>
          <div className="actions">
            <button className="primary" onClick={onGenerate}>
              Start a generation →
            </button>
          </div>
        </section>

        <section className="panel">
          <div className="panel-head">
            <span>BOUNDARIES</span>
            <Workflow size={16} />
          </div>
          <div className="operation">
            <span>
              Context provider<small>{context.name}</small>
            </span>
            <b className={context.name === "none" ? "warn" : "good"}>
              {context.name === "none" ? "NONE" : "SET"}
            </b>
          </div>
          <div className="operation">
            <span>
              Generation backend<small>{generation.capability}</small>
            </span>
            <b className={generation.mode === "live" ? "good" : "warn"}>
              {generation.mode.toUpperCase()}
            </b>
          </div>
          <div className="operation">
            <span>
              Asset provider<small>{asset.name}</small>
            </span>
            <b className={asset.name === "mock" ? "warn" : "good"}>
              {asset.name === "mock" ? "MOCK" : "LIVE"}
            </b>
          </div>
        </section>
      </div>
    </div>
  );
}

const POLL_INTERVAL_MS = 1_500;

function toDataUri(file: File): Promise<string> {
  if (!["image/png", "image/jpeg", "image/webp"].includes(file.type) || file.size > 5_000_000) {
    return Promise.reject(new Error("Choose PNG, JPEG or WebP files smaller than 5 MB each"));
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string" ? resolve(reader.result) : reject(new Error("Image conversion failed"));
    reader.onerror = () => reject(new Error("Cannot read image"));
    reader.readAsDataURL(file);
  });
}


/** Intent form, then live job polling through to the downloadable model. */
function GenerationPanel({ health }: { health: Health | null }) {
  const [intent, setIntent] = useState("");
  const [mode, setMode] = useState<"text" | "images">("text");
  const [images, setImages] = useState<File[]>([]);
  const [started, setStarted] = useState<GenerationStarted | null>(null);
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const stopPolling = () => {
    if (timer.current !== null) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
  };

  useEffect(() => stopPolling, []);

  const submit = async () => {
    const trimmed = intent.trim();
    if (busy || (mode === "text" && !trimmed) || (mode === "images" && images.length === 0)) return;

    stopPolling();
    setBusy(true);
    setError(null);
    setStarted(null);
    setJob(null);

    try {
      const response = mode === "images"
        ? await startImageGeneration(await Promise.all(images.map(toDataUri)), trimmed)
        : await startGeneration(trimmed);
      setStarted(response);
      setJob({
        id: response.job.id,
        provider: response.provider,
        state: response.job.state,
        ready: false,
        links: response.links,
        ...(response.job.progress !== undefined ? { progress: response.job.progress } : {}),
      });

      timer.current = window.setInterval(() => {
        getJob(response.job.id)
          .then((next) => {
            setJob(next);
            if (next.state === "succeeded" || next.state === "failed") stopPolling();
          })
          .catch((pollError: unknown) => {
            setError(errorMessage(pollError, "Unable to read job state"));
            stopPolling();
          });
      }, POLL_INTERVAL_MS);
    } catch (submitError: unknown) {
      setError(errorMessage(submitError, "Generation failed"));
    } finally {
      setBusy(false);
    }
  };

  const state = job?.state;
  const badge =
    state === "succeeded" ? "good" : state === "failed" ? "bad" : state ? "warn" : "warn";

  return (
    <div className="content">
      <section className="panel settings">
        <span className="eyebrow">CREATIVE INTENT</span>
        <h2>Generate an asset</h2>
        <p>
          {health
            ? `Prompt through ${health.providers.generation.mode} generation, model from the ${health.providers.asset.name} provider.`
            : "The service is unreachable — check the base URL in Settings."}
        </p>
        <label>
          Mode
          <select value={mode} onChange={(event) => setMode(event.target.value as "text" | "images")}>
            <option value="text">Text-to-3D</option>
            <option value="images">Multi-view image-to-3D (Meshy)</option>
          </select>
        </label>
        {mode === "images" && <label>
          Reference images (1–4; FRONT first, PNG/JPEG/WebP, max 5 MB per image)
          <input type="file" accept="image/png,image/jpeg,image/webp" multiple
            onChange={(event) => setImages(Array.from(event.target.files ?? []).slice(0, 4))} />
          <small>{images.length} reference image(s) selected. Paid generation requires explicit server opt-in.</small>
        </label>}
        <label>
          Intention
          <textarea
            rows={3}
            value={intent}
            placeholder="Place du Marché de Rotas, fontaine centrale, pierre chaude et cuivre patiné"
            onChange={(event) => setIntent(event.target.value)}
          />
        </label>
        <div className="actions">
          <button className="primary" onClick={submit} disabled={busy || (mode === "text" ? !intent.trim() : images.length === 0)}>
            {busy ? "Starting…" : "Generate"}
          </button>
        </div>
      </section>

      {error !== null && (
        <section className="panel error-panel">
          <div className="panel-head">
            <span>FAILED</span>
          </div>
          <strong>{error}</strong>
          <p className="muted">
            The service reports integration failures explicitly instead of substituting a
            placeholder result.
          </p>
        </section>
      )}

      {started !== null && job !== null && (
        <div className="grid">
          <section className="panel">
            <div className="panel-head">
              <span>JOB</span>
              <b className={badge}>{job.state.toUpperCase()}</b>
            </div>
            <h2>{started.intent}</h2>
            <div className="progress">
              <i style={{ width: `${job.progress ?? 0}%` }} />
            </div>
            <p className="muted">
              {job.progress ?? 0}% · provider {job.provider}
            </p>
            {job.error !== undefined && <p className="muted">{job.error}</p>}
            <div className="actions">
              <button
                className={job.ready ? "primary" : "secondary disabled"}
                disabled={!job.ready}
                onClick={() => void downloadModel(job.id).catch((downloadError: unknown) =>
                  setError(errorMessage(downloadError, "GLB download failed")))}
              >
                <Download size={14} /> {job.ready ? "Download GLB" : "Waiting for the model…"}
              </button>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <span>TRACE</span>
              <History size={16} />
            </div>
            <div className="operation">
              <span>
                Context source<small>{started.trace.loreSource}</small>
              </span>
            </div>
            <div className="operation">
              <span>
                Backend status<small>{started.trace.backendStatus ?? "—"}</small>
              </span>
            </div>
            <div className="operation">
              <span>
                Generated at<small>{new Date(started.trace.generatedAt).toLocaleString()}</small>
              </span>
            </div>
            <h2>Prompt</h2>
            <pre className="prompt">{started.prompt}</pre>
          </section>
        </div>
      )}
    </div>
  );
}

function Workspace({ page }: { page: Page }) {
  const data: Record<
    Exclude<Page, "dashboard" | "settings" | "ai">,
    { title: string; description: string }
  > = {
    worlds: { title: "Worlds & Scenes", description: "Organize worlds and inspect their scene graph." },
    scenes: {
      title: "Scene Inspector",
      description: "Inspect and prepare operations against the active scene.",
    },
    bridge: {
      title: "Unity Bridge",
      description: "Monitor the configurable Unity connection and protocol.",
    },
    operations: {
      title: "Operations",
      description: "Review scene, asset and synchronization operations.",
    },
    providers: {
      title: "Providers",
      description: "External capabilities are adapters, not hard-coded vendors.",
    },
  };

  const current = data[page as Exclude<Page, "dashboard" | "settings" | "ai">];

  return (
    <div className="content">
      <section className="hero panel">
        <Cpu size={24} />
        <div>
          <h2>{current.title}</h2>
          <p>{current.description}</p>
        </div>
      </section>
      <section className="panel empty">
        <FolderOpen size={28} />
        <strong>No contract yet</strong>
        <span>This view stays empty until the service exposes the matching route.</span>
      </section>
    </div>
  );
}

function SettingsPanel({
  apiBase,
  setApiBase: setValue,
  saveApi,
}: {
  apiBase: string;
  setApiBase: (value: string) => void;
  saveApi: (token: string) => void;
}) {
  const [token, setToken] = useState(getApiToken());
  return (
    <div className="content">
      <section className="panel settings">
        <span className="eyebrow">CONNECTION</span>
        <h2>Backend API</h2>
        <p>Configure the service endpoint without embedding secrets or providers in the UI.</p>
        <label>
          API base URL
          <input value={apiBase} onChange={(event) => setValue(event.target.value)} />
        </label>
        <label>
          Generation token (stored for this tab only)
          <input type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} />
        </label>
        <div className="actions">
          <button className="primary" onClick={() => saveApi(token)}>
            Save &amp; test
          </button>
        </div>
      </section>
    </div>
  );
}
