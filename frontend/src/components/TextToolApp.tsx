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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-2xl font-semibold">
            <Icon className="h-5 w-5 text-primary" />
            {title}
          </h2>
          <p className="max-w-2xl text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {controls}
          <span
            className="inline-block h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: colors.dot }}
            title={model}
          />
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          >
            {(models.length ? models : [DEFAULT_MODEL]).map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {/* Input */}
        <Card className="flex flex-col gap-3 p-4">
          <label className="text-sm font-medium">{inputLabel}</label>
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={placeholder}
            className="min-h-[260px] flex-1 resize-none"
          />
          <div className="flex gap-2">
            {streaming ? (
              <Button variant="destructive" onClick={stop}>
                <Square className="h-4 w-4" />
                Stop
              </Button>
            ) : (
              <Button onClick={run} disabled={!input.trim()}>
                <Play className="h-4 w-4" />
                {runLabel}
              </Button>
            )}
          </div>
        </Card>

        {/* Output */}
        <Card className="flex flex-col gap-3 p-4">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium">{outputLabel}</label>
            {output && (
              <button
                onClick={copy}
                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                {copied ? 'Copied' : 'Copy'}
              </button>
            )}
          </div>
          <div className="min-h-[260px] flex-1 overflow-auto whitespace-pre-wrap rounded-md bg-muted p-3 text-sm">
            {output || (
              <span className="text-muted-foreground">
                Output will appear here…
              </span>
            )}
            {streaming && <span className="animate-pulse">▍</span>}
          </div>
          <div className="text-xs text-muted-foreground">
            Generated by{' '}
            <span style={{ color: colors.text }} className="font-medium">
              {model}
            </span>
          </div>
        </Card>
      </div>

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
          {error}
        </Card>
      )}
    </div>
  );
}
