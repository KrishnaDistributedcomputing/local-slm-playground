/**
 * Ollama endpoint selection.
 *
 * Lets the app target either the local Docker model server or a remote
 * Azure (ACI) deployment at runtime. The current choice is persisted in
 * localStorage; saved custom endpoints (e.g. an Azure FQDN) are merged with
 * the built-in defaults.
 */

export interface Endpoint {
  label: string;
  url: string;
}

const CURRENT_KEY = 'ollama.endpoint';
const SAVED_KEY = 'ollama.endpoints';

function defaultOllamaUrl(): string {
  if (import.meta.env.VITE_OLLAMA_URL) return import.meta.env.VITE_OLLAMA_URL;
  if (typeof window !== 'undefined' && isPublicHost()) {
    if (window.location.protocol === 'http:') return `http://${window.location.hostname}:11434`;
    return window.location.origin;
  }
  return 'http://localhost:11434';
}

function defaultEndpointLabel(): string {
  if (import.meta.env.VITE_OLLAMA_URL) return 'Configured endpoint';
  if (typeof window !== 'undefined' && isPublicHost()) return window.location.protocol === 'http:' ? 'Azure Ollama direct' : 'Azure proxy';
  return 'Local (Docker)';
}

function isPublicHost(): boolean {
  return typeof window !== 'undefined' && !['localhost', '127.0.0.1'].includes(window.location.hostname);
}

function isLocalEndpoint(url: string): boolean {
  return /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?/i.test(url);
}

function isSameHostEndpoint(url: string): boolean {
  try {
    return typeof window !== 'undefined' && new URL(url).hostname === window.location.hostname;
  } catch {
    return false;
  }
}

const DEFAULTS: Endpoint[] = [
  {
    label: defaultEndpointLabel(),
    url: defaultOllamaUrl(),
  },
];

const ENV_AZURE = import.meta.env.VITE_OLLAMA_AZURE_URL as string | undefined;
if (ENV_AZURE) {
  DEFAULTS.push({ label: 'Azure (ACI)', url: ENV_AZURE });
}

function readSaved(): Endpoint[] {
  try {
    const raw = localStorage.getItem(SAVED_KEY);
    return raw ? (JSON.parse(raw) as Endpoint[]) : [];
  } catch {
    return [];
  }
}

/** All selectable endpoints (defaults + any saved custom endpoints). */
export function getEndpoints(): Endpoint[] {
  const merged = [...DEFAULTS];
  for (const e of readSaved()) {
    if (!merged.some((m) => m.url === e.url)) merged.push(e);
  }
  return merged;
}

/** The currently selected Ollama base URL. */
export function getOllamaUrl(): string {
  try {
    const saved = localStorage.getItem(CURRENT_KEY);
    if (saved && isPublicHost() && window.location.protocol === 'http:' && isSameHostEndpoint(saved)) {
      localStorage.removeItem(CURRENT_KEY);
      return DEFAULTS[0].url;
    }
    if (saved && !(isPublicHost() && isLocalEndpoint(saved))) return saved;
    if (saved && isPublicHost() && isLocalEndpoint(saved)) localStorage.removeItem(CURRENT_KEY);
    return DEFAULTS[0].url;
  } catch {
    return DEFAULTS[0].url;
  }
}

/** Select an endpoint by URL. */
export function setOllamaUrl(url: string): void {
  try {
    localStorage.setItem(CURRENT_KEY, url);
  } catch {
    /* storage unavailable */
  }
}

/** Persist a new custom endpoint (e.g. an Azure deployment). */
export function addEndpoint(label: string, url: string): void {
  const saved = readSaved();
  if (!saved.some((e) => e.url === url)) {
    saved.push({ label, url });
    try {
      localStorage.setItem(SAVED_KEY, JSON.stringify(saved));
    } catch {
      /* storage unavailable */
    }
  }
}
