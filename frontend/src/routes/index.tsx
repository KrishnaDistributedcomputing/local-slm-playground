/**
 * Home Route - Local Models Playground
 *
 * Showcases the small language models running locally in Docker (via Ollama).
 * Live model gallery with connection status, sizes and parameter counts,
 * each launching the interactive chat playground.
 */

import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import { Boxes, Check, Copy, Cpu, ExternalLink, HardDrive, Layers, Plug, RefreshCw, Sparkles, Terminal } from 'lucide-react';
import { getOllamaUrl, listModelDetails, pingOllama, type ModelInfo } from '@/data/ollama';
import { modelColors } from '@/lib/modelColors';
import { getModelBrand } from '@/data/modelBrands';
import { getModelProfile } from '@/data/modelProfiles';
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
      {models.length > 0 && (() => {
        const bySize = (a: ModelInfo, b: ModelInfo) =>
          (a.size || 0) - (b.size || 0);
        const isMicrosoft = (m: ModelInfo) =>
          getModelBrand(m.name).vendor.startsWith('Microsoft');
        const microsoft = models.filter(isMicrosoft).sort(bySize);
        const others = models.filter((m) => !isMicrosoft(m)).sort(bySize);

        return (
          <div className="space-y-6">
            <div className="flex items-baseline justify-between">
              <h3 className="text-lg font-semibold">Available models</h3>
              <span className="text-xs text-muted-foreground">
                {models.length} ready · Microsoft grouped first
              </span>
            </div>

            {/* Microsoft group — boxed */}
            {microsoft.length > 0 && (
              <div
                className="rounded-2xl border-2 border-dashed p-4 sm:p-5"
                style={{
                  borderColor: 'color-mix(in srgb, #0078d4 35%, transparent)',
                  background: 'color-mix(in srgb, #0078d4 5%, transparent)',
                }}
              >
                <div className="mb-3 flex items-center gap-2">
                  <span
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-base font-semibold ring-1 ring-inset"
                    style={{
                      color: '#0078d4',
                      backgroundColor: 'color-mix(in srgb, #0078d4 14%, transparent)',
                      boxShadow: 'inset 0 0 0 1px color-mix(in srgb, #0078d4 28%, transparent)',
                    }}
                    aria-hidden
                  >
                    φ
                  </span>
                  <h4 className="text-sm font-semibold tracking-tight">
                    Microsoft Phi models
                  </h4>
                  <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
                    {microsoft.length}
                  </span>
                </div>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {microsoft.map((m) => (
                    <ModelCard key={m.name} model={m} />
                  ))}
                </div>
              </div>
            )}

            {/* Other models */}
            {others.length > 0 && (
              <div>
                <h4 className="mb-3 text-sm font-semibold tracking-tight text-muted-foreground">
                  Other community models
                </h4>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {others.map((m) => (
                    <ModelCard key={m.name} model={m} />
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* Pull-more hint */}
      {online && (
        <Card className="space-y-4 p-5">
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <span className="text-lg leading-none">φ</span>
              Microsoft Phi family — free to download
            </h3>
            <p className="text-sm text-muted-foreground">
              Microsoft’s open Phi models punch well above their size on
              reasoning and coding. Pull one into the Docker container, then
              refresh:
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
              docker exec ollama ollama pull phi3:mini{'\n'}docker exec ollama ollama pull phi4-mini{'\n'}docker exec ollama ollama pull phi4
            </pre>
          </div>
          <div className="space-y-2">
            <h3 className="flex items-center gap-2 font-semibold">
              <Terminal className="h-4 w-4" />
              More small models
            </h3>
            <p className="text-sm text-muted-foreground">
              Other lightweight community models that run comfortably locally:
            </p>
            <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
              docker exec ollama ollama pull llama3.2:1b{'\n'}docker exec ollama ollama pull gemma2:2b
            </pre>
          </div>
        </Card>
      )}
    </div>
  );
}

function ModelCard({ model: m }: { model: ModelInfo }) {
  const brand = getModelBrand(m.name);
  const profile = getModelProfile(m.name);
  const c = modelColors(m.name);
  const [copied, setCopied] = useState(false);

  async function copyName() {
    try {
      await navigator.clipboard.writeText(m.name);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <Card
      className="group relative flex flex-col gap-4 overflow-hidden p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lg"
      style={{
        boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.dot} 16%, transparent)`,
      }}
    >
      {/* Accent glow */}
      <div
        className="pointer-events-none absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-90"
        style={{ background: `color-mix(in srgb, ${c.dot} 22%, transparent)` }}
        aria-hidden
      />

      {/* Header */}
      <div className="flex items-start gap-3">
        <span
          className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-2xl ring-1 ring-inset transition-transform duration-300 group-hover:scale-110"
          style={{
            backgroundColor: `color-mix(in srgb, ${c.dot} 14%, transparent)`,
            boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${c.dot} 28%, transparent)`,
          }}
          aria-hidden
        >
          {brand.logo}
        </span>
        <div className="min-w-0 flex-1 space-y-0.5">
          <span className="block break-all font-semibold leading-tight">
            {m.name}
          </span>
          <span className="text-xs text-muted-foreground">{brand.vendor}</span>
        </div>
      </div>

      {/* Best for */}
      <p className="text-sm leading-snug">
        <span
          className="font-medium"
          style={{ color: `color-mix(in srgb, ${c.dot} 65%, var(--foreground))` }}
        >
          Best for:{' '}
        </span>
        <span className="text-muted-foreground">{profile.bestFor}</span>
      </p>

      {/* Stat chips */}
      <div className="flex flex-wrap gap-1.5">
        <StatChip icon={<Cpu className="h-3.5 w-3.5" />}>
          {m.parameterSize ?? '—'} params
        </StatChip>
        <StatChip icon={<HardDrive className="h-3.5 w-3.5" />}>
          {formatBytes(m.size)}
        </StatChip>
        {m.quantization && (
          <StatChip icon={<Layers className="h-3.5 w-3.5" />}>
            {m.quantization}
          </StatChip>
        )}
      </div>

      {/* Strengths */}
      <ul className="space-y-1.5">
        {profile.strengths.slice(0, 3).map((s) => (
          <li key={s} className="flex items-start gap-2 text-xs text-muted-foreground">
            <Check
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              style={{ color: c.dot }}
            />
            <span className="leading-snug">{s}</span>
          </li>
        ))}
      </ul>

      {/* Actions */}
      <div className="mt-auto flex flex-col gap-2 pt-1">
        <Button
          asChild
          size="sm"
          className="h-8 w-full text-xs text-white shadow-sm transition-all hover:brightness-110 hover:shadow-md active:scale-[0.98]"
          style={{
            backgroundImage: `linear-gradient(135deg, ${c.dot}, color-mix(in srgb, ${c.dot} 72%, black))`,
          }}
        >
          <Link to="/chat" search={{ model: m.name }}>
            <Sparkles className="h-3.5 w-3.5" />
            Open in Playground
          </Link>
        </Button>
        <div className="grid grid-cols-2 gap-2">
          <Button asChild variant="outline" size="sm" className="h-8 w-full text-xs">
            <a
              href={brand.url}
              target="_blank"
              rel="noreferrer"
              aria-label={`View ${m.name} on Ollama`}
            >
              <ExternalLink className="h-3.5 w-3.5" />
              Ollama
            </a>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 w-full text-xs"
            onClick={copyName}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-emerald-500" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? 'Copied' : 'Copy name'}
          </Button>
        </div>
      </div>
    </Card>
  );
}

function StatChip({
  icon,
  children,
}: {
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {icon}
      {children}
    </span>
  );
}
