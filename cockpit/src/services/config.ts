const STORAGE_KEY = "metaverse-creator.cockpit.api-base";

export function getApiBase(): string {
  return localStorage.getItem(STORAGE_KEY) ?? "http://127.0.0.1:8787";
}

export function setApiBase(value: string): void {
  localStorage.setItem(STORAGE_KEY, value.replace(/\/$/, ""));
}

/** Token lives only for the browser tab; never put it in a shared URL. */
const TOKEN_KEY = "metaverse-creator.cockpit.api-token";
export function getApiToken(): string {
  return sessionStorage.getItem(TOKEN_KEY) ?? "";
}
export function setApiToken(value: string): void {
  if (value.trim()) sessionStorage.setItem(TOKEN_KEY, value.trim());
  else sessionStorage.removeItem(TOKEN_KEY);
}
