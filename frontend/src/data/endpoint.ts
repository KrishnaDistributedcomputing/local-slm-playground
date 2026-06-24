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

const DEFAULTS: Endpoint[] = [
  {
    label: 'Local (Docker)',
    url: import.meta.env.VITE_OLLAMA_URL || 'http://localhost:11434',
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
    return localStorage.getItem(CURRENT_KEY) || DEFAULTS[0].url;
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
