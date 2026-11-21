export interface Placement {
  id: string;
  jobId: string;
  x: number;
  z: number;
  rotation: number;
}

const STORAGE_KEY = "metaverse-creator.studio-layout.v1";
export const MAX_PLACEMENTS = 12;
export const PLACEMENT_LIMIT = 5;

export function readLayout(): Placement[] {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (!stored) return [];
  const value: unknown = JSON.parse(stored);
  if (!Array.isArray(value) || value.length > MAX_PLACEMENTS || !value.every((item) =>
    item && typeof item.id === "string" && typeof item.jobId === "string" &&
    /^[\w-]{1,100}$/.test(item.jobId) &&
    Number.isFinite(item.x) && Math.abs(item.x) <= PLACEMENT_LIMIT &&
    Number.isFinite(item.z) && Math.abs(item.z) <= PLACEMENT_LIMIT &&
    Number.isFinite(item.rotation) && item.rotation >= 0 && item.rotation < 360
  ) || new Set(value.map(({ id }) => id)).size !== value.length) {
    throw new Error("The saved Studio scene is invalid.");
  }
  return value;
}

export function writeLayout(layout: Placement[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(layout));
}
