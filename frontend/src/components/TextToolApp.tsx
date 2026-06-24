/**
 * TextToolApp - reusable single-shot "input -> model -> output" mini-app shell.
 *
 * Each app supplies a system prompt and labels; the shell handles the model
 * picker, streaming, stop, copy, and error states against the local Ollama
 * models. Used by the Summarizer, Translator, Code Reviewer and Data Extractor.
 */

import { useEffect, useRef, useState } from 'react';
import { Check, Copy, Play, Square } from 'lucide-react';
import {
  streamChat,
  listModels,
  DEFAULT_MODEL,
  type ChatMessage,
} from '@/data/ollama';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { modelColors } from '@/lib/modelColors';

export interface TextToolAppProps {
  title: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  /** System prompt that defines the app's behavior. */
  system: string;
  inputLabel: string;
  placeholder: string;
  runLabel?: string;
  outputLabel?: string;
  /** Optional extra controls (e.g. a target-language selector). */
  controls?: React.ReactNode;
  /** Optionally wrap the raw input before sending it to the model. */
  buildUserContent?: (input: string) => string;
  /** Optional brand accent color (hex) for the icon and run button. */
  accent?: string;
}

export function TextToolApp({
  title,
  description,
  icon: Icon,
  system,
  inputLabel,
  placeholder,
  runLabel = 'Run',
  outputLabel = 'Output',
  controls,
  buildUserContent,
  accent,
}: TextToolAppProps) {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [models, setModels] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listModels().then((m) => {
      if (m.length) setModels(m);
    });
  }, []);

  async function run() {
    const text = input.trim();
    if (!text || streaming) return;

    setError(null);
    setOutput('');
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const messages: ChatMessage[] = [
      { role: 'system', content: system },
      { role: 'user', content: buildUserContent ? buildUserContent(text) : text },
    ];

    try {
      await streamChat(messages, {
        model,
        signal: controller.signal,
        onToken: (t) => setOutput((prev) => prev + t),
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

  function stop() {
    abortRef.current?.abort();
    setStreaming(false);
  }

  async function copy() {
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  const colors = modelColors(model);
  const accentColor = accent ?? 'hsl(222.2 47.4% 11.2%)';
  const accentSoft = `color-mix(in srgb, ${accentColor} 12%, transparent)`;
  const accentEdge = `color-mix(in srgb, ${accentColor} 28%, transparent)`;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="relative overflow-hidden rounded-3xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur">
        <div
          className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full opacity-40 blur-3xl"
          style={{ background: accentSoft }}
        />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ring-1 ring-inset transition-transform duration-300 hover:scale-105"
              style={{
                backgroundColor: accentSoft,
                color: accentColor,
                boxShadow: `inset 0 0 0 1px ${accentEdge}`,
              }}
            >
              <Icon className="h-6 w-6" />
            </div>
            <div className="space-y-1.5">
              <h2 className="bg-gradient-to-br from-foreground to-foreground/60 bg-clip-text text-2xl font-bold tracking-tight text-transparent">
                {title}
              </h2>
              <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
                {description}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 shadow-sm">
            {controls}
            <span
              className="inline-block h-2.5 w-2.5 rounded-full ring-2 ring-background"
              style={{ backgroundColor: colors.dot }}
              title={model}
            />
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="h-7 cursor-pointer rounded-md bg-transparent px-1 text-sm font-medium outline-none focus:ring-0"
            >
              {(models.length ? models : [DEFAULT_MODEL]).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Input */}
        <Card className="group flex flex-col gap-4 rounded-2xl border-border/60 p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
          <label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
            <span
              className="h-4 w-1 rounded-full"
              style={{ backgroundColor: accentColor }}
            />
            {inputLabel}
          </label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-h-[260px] flex-1 resize-none rounded-xl border-border/60 bg-muted/30 text-sm leading-relaxed transition-colors focus-visible:bg-background"
          />
          <div className="flex items-center justify-between gap-2">
            {streaming ? (
              <Button
                variant="destructive"
                onClick={stop}
                className="rounded-xl shadow-sm transition-transform active:scale-95"
              >
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button
                onClick={run}
                disabled={!input.trim()}
                className="rounded-xl text-primary-foreground shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-95 disabled:opacity-50"
                style={
                  accent
                    ? {
                        backgroundImage: `linear-gradient(135deg, ${accentColor}, color-mix(in srgb, ${accentColor} 75%, black))`,
                      }
                    : undefined
                }
              >
                <Play className="h-4 w-4" />
                {runLabel}
              </Button>
            )}
            <span className="text-xs text-muted-foreground">
              {input.trim().length > 0
                ? `${input.trim().length} chars`
                : 'Ready'}
            </span>
          </div>
        </Card>

        {/* Output */}
        <Card className="flex flex-col gap-4 rounded-2xl border-border/60 p-5 shadow-sm transition-shadow duration-300 hover:shadow-md">
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm font-semibold tracking-tight">
              <span
                className="h-4 w-1 rounded-full"
                style={{ backgroundColor: accentColor }}
              />
              {outputLabel}
            </label>
            {output && (
              <button
                onClick={copy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border/60 px-2 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-emerald-500" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="min-h-[260px] flex-1 overflow-auto whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-4 text-sm leading-relaxed ring-1 ring-inset ring-border/40">
            {output || (
              <span className="text-muted-foreground">
                Output will appear here…
              </span>
            )}
            {streaming && (
              <span
                className="ml-0.5 inline-block animate-pulse"
                style={{ color: accentColor }}
              >
                ▍
              </span>
            )}
          </div>
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <span
              className="inline-block h-1.5 w-1.5 rounded-full"
              style={{ backgroundColor: colors.dot }}
            />
            Generated by{' '}
            <span style={{ color: colors.text }} className="font-semibold">
              {model}
            </span>
          </div>
        </Card>
      </div>

      {error && (
        <Card className="flex items-start gap-2 rounded-2xl border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive shadow-sm">
          {error}
        </Card>
      )}
    </div>
  );
}
