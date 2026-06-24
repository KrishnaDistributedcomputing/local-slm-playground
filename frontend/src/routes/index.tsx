/**
 * Home Route - Local Models Playground
 *
 * Showcases the small language models running locally in Docker (via Ollama).
 * Live model gallery with connection status, sizes and parameter counts,
 * each launching the interactive chat playground.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Boxes, Cpu, HardDrive, Plug, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import { getOllamaUrl, listModelDetails, pingOllama, type ModelInfo } from '@/data/ollama';
import { modelColors } from '@/lib/modelColors';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/')({
  component: HomePage,
});

function formatBytes(bytes: number): string {
  if (!bytes) return '—';
  const gb = bytes / 1024 ** 3;
  if (gb >= 1) return `${gb.toFixed(1)} GB`;
  const mb = bytes / 1024 ** 2;
  return `${Math.round(mb)} MB`;
}

function HomePage() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [models, setModels] = useState<ModelInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const mounted = useRef(true);

  async function refresh() {
    setLoading(true);
    const up = await pingOllama();
    if (!mounted.current) return;
    setOnline(up);
    setModels(up ? await listModelDetails() : []);
    if (mounted.current) setLoading(false);
  }

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <h2 className="flex items-center gap-2 text-3xl font-bold">
            <Boxes className="h-7 w-7 text-primary" />
            Local Models Playground
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            Small language models running entirely on your machine in{' '}
            <strong>Docker</strong> via{' '}
            <a
              href="https://ollama.com"
              target="_blank"
              rel="noreferrer"
              className="underline underline-offset-2"
            >
              Ollama
            </a>
            . No API keys, no per-token cost, fully private. Pick a model below
            and start chatting.
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} disabled={loading}>
          <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          Refresh
        </Button>
      </div>

      {/* Connection status */}
      <Card className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4 text-sm">
        <span className="flex items-center gap-2 font-medium">
          <Plug className="h-4 w-4" />
          Docker / Ollama
        </span>
        <span className="flex items-center gap-2">
          <span
            className={cn(
              'h-2.5 w-2.5 rounded-full',
              online === null
                ? 'bg-muted-foreground'
                : online
                  ? 'bg-green-500'
                  : 'bg-red-500',
            )}
          />
          {online === null ? 'Checking…' : online ? 'Online' : 'Offline'}
        </span>
        <span className="text-muted-foreground">
          Endpoint: <code>{getOllamaUrl()}</code>
        </span>
        <span className="text-muted-foreground">
          {models.length} model{models.length === 1 ? '' : 's'} available
        </span>
      </Card>

      {/* Offline guidance */}
      {online === false && (
        <Card className="space-y-3 border-destructive/40 bg-destructive/5 p-5">
          <p className="font-medium text-destructive">
            Can&apos;t reach the Ollama service.
          </p>
          <p className="text-sm text-muted-foreground">
            Start the local model stack with Docker, then click Refresh:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
            docker compose up -d ollama ollama-pull
          </pre>
        </Card>
      )}

      {/* Empty guidance */}
      {online && models.length === 0 && !loading && (
        <Card className="space-y-3 p-5">
          <p className="font-medium">No models pulled yet.</p>
          <p className="text-sm text-muted-foreground">
            Pull a small model into the running container:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
            docker exec ollama ollama pull qwen2.5:0.5b
          </pre>
        </Card>
      )}

      {/* Model gallery */}
      {models.length > 0 && (
        <div>
          <h3 className="mb-3 text-lg font-semibold">Available models</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {models.map((m) => (
              <Card key={m.name} className="flex flex-col gap-4 p-5">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: modelColors(m.name).dot }}
                    />
                    <span className="break-all font-semibold">{m.name}</span>
                  </div>
                  {m.family && (
                    <span className="text-xs text-muted-foreground">
                      {m.family}
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <Cpu className="h-3.5 w-3.5" />
                    {m.parameterSize ?? '—'}
                  </span>
                  <span className="flex items-center gap-1.5 text-muted-foreground">
                    <HardDrive className="h-3.5 w-3.5" />
                    {formatBytes(m.size)}
                  </span>
                  {m.quantization && (
                    <span className="col-span-2 text-xs text-muted-foreground">
                      Quantization: {m.quantization}
                    </span>
                  )}
                </div>

                <Button asChild size="sm" className="mt-auto">
                  <Link to="/chat" search={{ model: m.name }}>
                    <Sparkles className="h-4 w-4" />
                    Open in Playground
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Pull-more hint */}
      {online && (
        <Card className="space-y-2 p-5">
          <h3 className="flex items-center gap-2 font-semibold">
            <Terminal className="h-4 w-4" />
            Add more models
          </h3>
          <p className="text-sm text-muted-foreground">
            Pull additional models into the Docker container, then refresh:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
            docker exec ollama ollama pull llama3.2:1b{'\n'}docker exec ollama ollama pull gemma2:2b
          </pre>
        </Card>
      )}
    </div>
  );
}
