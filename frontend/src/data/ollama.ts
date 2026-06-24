/**
 * Minimal Ollama API client.
 *
 * Talks directly to the Ollama server (added as a Docker Compose service) or to
 * a remote Azure (ACI) deployment. The target is resolved at request time from
 * the endpoint store, so it can be switched at runtime.
 * Configure the default via VITE_OLLAMA_URL / VITE_OLLAMA_MODEL.
 */

import { getOllamaUrl } from './endpoint';
import { recordUsage } from './usage';

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
          model?: string;
          message?: { content?: string };
          done?: boolean;
          prompt_eval_count?: number;
          eval_count?: number;
          total_duration?: number;
          eval_duration?: number;
        };
        if (json.message?.content) onToken(json.message.content);
        if (json.done) {
          const promptTokens = json.prompt_eval_count ?? 0;
          const completionTokens = json.eval_count ?? 0;
          if (promptTokens || completionTokens) {
            recordUsage({
              at: Date.now(),
              model: json.model || model,
              promptTokens,
              completionTokens,
              totalTokens: promptTokens + completionTokens,
              durationMs: Math.round((json.total_duration ?? 0) / 1e6),
              evalMs: Math.round((json.eval_duration ?? 0) / 1e6),
            });
          }
        }
      } catch {
        // Ignore malformed/partial lines.
      }
    }
  }
}

export interface ChatMetrics {
  model: string;
  /** Generated assistant text. */
  text: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  /** Total wall-clock time for the call (ms), including model load. */
  totalMs: number;
  /** Pure generation time (ms). */
  evalMs: number;
  /** Model load time (ms). */
  loadMs: number;
  /** Generation throughput: completion tokens per second of eval time. */
  tokensPerSec: number;
}

/**
 * Run a single, non-streaming chat completion and return timing/token metrics.
 * Used by the model efficiency calculator. Also records a usage event so the
 * monitoring app reflects the benchmark traffic.
 */
export async function chatMetrics(
  messages: ChatMessage[],
  options: { model: string; signal?: AbortSignal },
): Promise<ChatMetrics> {
  const { model, signal } = options;

  const response = await fetch(`${getOllamaUrl()}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model, messages, stream: false }),
    signal,
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Ollama request failed (${response.status}). ${detail || 'Is the model pulled?'}`,
    );
  }

  const json = (await response.json()) as {
    model?: string;
    message?: { content?: string };
    prompt_eval_count?: number;
    eval_count?: number;
    total_duration?: number;
    eval_duration?: number;
    load_duration?: number;
  };

  const promptTokens = json.prompt_eval_count ?? 0;
  const completionTokens = json.eval_count ?? 0;
  const totalMs = Math.round((json.total_duration ?? 0) / 1e6);
  const evalMs = Math.round((json.eval_duration ?? 0) / 1e6);
  const loadMs = Math.round((json.load_duration ?? 0) / 1e6);
  const tokensPerSec = evalMs > 0 ? completionTokens / (evalMs / 1000) : 0;

  if (promptTokens || completionTokens) {
    recordUsage({
      at: Date.now(),
      model: json.model || model,
      promptTokens,
      completionTokens,
      totalTokens: promptTokens + completionTokens,
      durationMs: totalMs,
      evalMs,
    });
  }

  return {
    model: json.model || model,
    text: json.message?.content ?? '',
    promptTokens,
    completionTokens,
    totalTokens: promptTokens + completionTokens,
    totalMs,
    evalMs,
    loadMs,
    tokensPerSec,
  };
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
