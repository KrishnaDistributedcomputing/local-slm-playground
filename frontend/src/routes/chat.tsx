/**
 * Chat Route - Local LLM playground (Ollama)
 *
 * Talks to the `ollama` Docker service running qwen2.5:0.5b.
 * Includes preset "use case" prompts: general chat, summarization,
 * Q&A over pasted data, and code help.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Bot, User, Send, Square, Trash2, Sparkles } from 'lucide-react';
import {
  streamChat,
  listModels,
  DEFAULT_MODEL,
  type ChatMessage,
} from '@/data/ollama';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/chat')({
  validateSearch: (search: Record<string, unknown>): { model?: string } => ({
    model: typeof search.model === 'string' ? search.model : undefined,
  }),
  component: ChatPage,
});

interface Preset {
  id: string;
  label: string;
  system: string;
  placeholder: string;
}

const PRESETS: Preset[] = [
  {
    id: 'chat',
    label: 'General chat',
    system: 'You are a helpful, concise assistant.',
    placeholder: 'Ask anything…',
  },
  {
    id: 'summarize',
    label: 'Summarize',
    system:
      'You are a summarization assistant. Summarize the text the user provides into clear, concise bullet points. Do not add information that is not present.',
    placeholder: 'Paste the text you want summarized…',
  },
  {
    id: 'qa',
    label: 'Q&A over data',
    system:
      'You answer questions strictly based on the data the user provides. If the answer is not in the data, say you do not know. Paste your data, then ask a question.',
    placeholder: 'Paste data, then ask a question about it…',
  },
  {
    id: 'code',
    label: 'Code help',
    system:
      'You are an expert programming assistant. Provide correct, idiomatic code with brief explanations. Use fenced code blocks.',
    placeholder: 'Describe the coding task or paste code to review…',
  },
];

interface UIMessage extends ChatMessage {
  id: string;
  /** Model that generated this message (assistant only). */
  model?: string;
}

/** Deterministic hue (0-359) derived from the model name. */
function modelHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return h;
}

/** Stable color palette for a given model name. */
function modelColors(name: string): {
  dot: string;
  bg: string;
  border: string;
  text: string;
} {
  const hue = modelHue(name);
  return {
    dot: `hsl(${hue} 70% 45%)`,
    bg: `hsl(${hue} 70% 96%)`,
    border: `hsl(${hue} 55% 80%)`,
    text: `hsl(${hue} 55% 32%)`,
  };
}

function ChatPage() {
  const { model: modelParam } = Route.useSearch();
  const [preset, setPreset] = useState<Preset>(PRESETS[0]);
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [model, setModel] = useState<string>(modelParam ?? DEFAULT_MODEL);
  const [availableModels, setAvailableModels] = useState<string[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listModels().then((m) => {
      if (m.length) setAvailableModels(m);
    });
  }, []);

  useEffect(() => {
    if (modelParam) setModel(modelParam);
  }, [modelParam]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: 'smooth',
    });
  }, [messages]);

  function reset() {
    abortRef.current?.abort();
    setMessages([]);
    setError(null);
    setStreaming(false);
  }

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  async function send() {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    setInput('');

    const userMsg: UIMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: text,
    };
    const assistantId = crypto.randomUUID();
    const assistantMsg: UIMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      model,
    };

    const history = [...messages, userMsg];
    setMessages([...history, assistantMsg]);
    setStreaming(true);

    const payload: ChatMessage[] = [
      { role: 'system', content: preset.system },
      ...history.map(({ role, content }) => ({ role, content })),
    ];

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      await streamChat(payload, {
        model,
        signal: controller.signal,
        onToken: (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? { ...m, content: m.content + token }
                : m,
            ),
          );
        },
      });
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-7rem)] max-w-4xl flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Sparkles className="h-5 w-5 text-primary" />
            Local LLM Playground
          </h2>
          <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
            Running
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: modelColors(model).dot }}
            />
            <code>{model}</code> via Ollama
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: modelColors(model).dot }}
            title={model}
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(availableModels.length
              ? availableModels
              : [DEFAULT_MODEL]
            ).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            disabled={!messages.length && !streaming}
          >
            <Trash2 className="h-4 w-4" />
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => {
              setPreset(p);
              reset();
            }}
            className={cn(
              'rounded-full border px-3 py-1 text-sm transition-colors',
              preset.id === p.id
                ? 'border-primary bg-primary text-primary-foreground'
                : 'hover:bg-muted',
            )}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card className="flex flex-1 flex-col overflow-hidden">
        <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-4">
          {messages.length === 0 && (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <Bot className="mb-2 h-10 w-10 opacity-40" />
              <p className="font-medium">{preset.label}</p>
              <p className="text-sm">{preset.placeholder}</p>
            </div>
          )}

          {messages.map((m) => (
            <div
              key={m.id}
              className={cn(
                'flex gap-3',
                m.role === 'user' && 'flex-row-reverse',
              )}
            >
              <div
                className={cn(
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                  m.role === 'user'
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted',
                )}
              >
                {m.role === 'user' ? (
                  <User className="h-4 w-4" />
                ) : (
                  <Bot className="h-4 w-4" />
                )}
              </div>
              <div
                className={cn(
                  'flex min-w-0 max-w-[80%] flex-col gap-1',
                  m.role === 'user' ? 'items-end' : 'items-start',
                )}
              >
                <div
                  className={cn(
                    'whitespace-pre-wrap break-words rounded-lg px-3 py-2 text-sm',
                    m.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-muted',
                  )}
                >
                  {m.content || (
                    <span className="inline-flex gap-1">
                      <span className="animate-pulse">●</span>
                    </span>
                  )}
                </div>
                {m.role === 'assistant' && m.model && (
                  <span
                    className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      backgroundColor: modelColors(m.model).bg,
                      borderColor: modelColors(m.model).border,
                      color: modelColors(m.model).text,
                    }}
                  >
                    <span
                      className="inline-block h-1.5 w-1.5 rounded-full"
                      style={{ backgroundColor: modelColors(m.model).dot }}
                    />
                    Generated by {m.model}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="border-t bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <div className="flex items-end gap-2 border-t p-3">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={preset.placeholder}
            rows={1}
            className="max-h-40 min-h-[44px] flex-1 resize-none"
          />
          {streaming ? (
            <Button variant="destructive" size="icon" onClick={stop}>
              <Square className="h-4 w-4" />
            </Button>
          ) : (
            <Button size="icon" onClick={send} disabled={!input.trim()}>
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
