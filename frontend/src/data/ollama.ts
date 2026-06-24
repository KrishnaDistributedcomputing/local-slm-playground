/**
 * Minimal Ollama API client.
 *
 * Talks directly to the Ollama server (added as a Docker Compose service) or to
 * a remote Azure (ACI) deployment. The target is resolved at request time from
 * the endpoint store, so it can be switched at runtime.
 * Configure the default via VITE_OLLAMA_URL / VITE_OLLAMA_MODEL.
 */

import { getOllamaUrl } from './endpoint';

export { getOllamaUrl } from './endpoint';

export const DEFAULT_MODEL =
  import.meta.env.VITE_OLLAMA_MODEL || 'qwen2.5:0.5b';

export type ChatRole = 'system' | 'user' | 'assistant';

export interface ChatMessage {
  role: ChatRole;
  content: string;
}

/**
 * Stream a chat completion from Ollama.
 *
 * Ollama returns newline-delimited JSON objects when `stream: true`.
 * `onToken` is called with each incremental chunk of assistant text.
 */
export async function streamChat(
  messages: ChatMessage[],
  options: {
    model?: string;
    signal?: AbortSignal;
    onToken: (token: string) => void;
  },
): Promise<void> {
  const { model = DEFAULT_MODEL, signal, onToken } = options;

  const response = await fetch(`${getOllamaUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: true }),
    signal,
  });

  if (!response.ok || !response.body) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Ollama request failed (${response.status}). ${detail || 'Is the model pulled?'}`,
    );
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    // Keep the last partial line in the buffer.
    buffer = lines.pop() ?? '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        const json = JSON.parse(trimmed) as {
          message?: { content?: string };
          done?: boolean;
        };
        if (json.message?.content) onToken(json.message.content);
      } catch {
        // Ignore malformed/partial lines.
      }
    }
  }
}

/**
 * List models currently available on the Ollama server.
 */
export async function listModels(): Promise<string[]> {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/tags`);
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: { name: string }[] };
    return (data.models ?? []).map((m) => m.name);
  } catch {
    return [];
  }
}

export interface ModelInfo {
  name: string;
  /** On-disk size in bytes. */
  size: number;
  parameterSize?: string;
  family?: string;
  quantization?: string;
}

/**
 * List models with size/parameter metadata for the playground gallery.
 */
export async function listModelDetails(): Promise<ModelInfo[]> {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/tags`);
    if (!res.ok) return [];
    const data = (await res.json()) as {
      models?: Array<{
        name: string;
        size?: number;
        details?: {
          parameter_size?: string;
          family?: string;
          quantization_level?: string;
        };
      }>;
    };
    return (data.models ?? []).map((m) => ({
      name: m.name,
      size: m.size ?? 0,
      parameterSize: m.details?.parameter_size,
      family: m.details?.family,
      quantization: m.details?.quantization_level,
    }));
  } catch {
    return [];
  }
}

/**
 * Check whether the Ollama Docker service is reachable.
 */
export async function pingOllama(signal?: AbortSignal): Promise<boolean> {
  try {
    const res = await fetch(`${getOllamaUrl()}/api/tags`, { signal });
    return res.ok;
  } catch {
    return false;
  }
}
