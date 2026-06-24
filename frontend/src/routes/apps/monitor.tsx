/**
 * Monitoring App - System health & token usage
 *
 * A single-pane dashboard for the local stack:
 *  - System health: live reachability + latency for Ollama, the CRM API, the
 *    frontend, Temporal and Mailpit (plus Temporal/Supabase checked server-side
 *    via the CRM API `/api/health` endpoint), with optional auto-refresh.
 *  - Token usage: cumulative prompt / completion / total tokens and throughput
 *    captured from every `streamChat` call across the playground apps, broken
 *    down by model with a recent-request log.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Activity,
  RefreshCw,
  Cpu,
  Server,
  Gauge,
  Coins,
  ArrowDownToLine,
  ArrowUpFromLine,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
} from 'lucide-react';
import { collectHealth, type SystemHealth, type HealthStatus } from '@/data/monitor';
import {
  getUsageEvents,
  subscribeUsage,
  summarizeUsage,
  clearUsage,
  type UsageEvent,
} from '@/data/usage';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/apps/monitor')({
  component: MonitorApp,
});

const ACCENT = '#16a34a';
const REFRESH_MS = 10000;

const STATUS_META: Record<
  HealthStatus,
  { color: string; label: string; Icon: typeof CheckCircle2 }
> = {
  up: { color: '#16a34a', label: 'Operational', Icon: CheckCircle2 },
  degraded: { color: '#f59e0b', label: 'Degraded', Icon: AlertTriangle },
  down: { color: '#ef4444', label: 'Down', Icon: XCircle },
};

function fmt(n: number): string {
  return Math.round(n).toLocaleString();
}

function timeAgo(ts: number): string {
  const s = Math.max(0, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  return `${m}m ${s % 60}s ago`;
}

function MonitorApp() {
  const [health, setHealth] = useState<SystemHealth | null>(null);
  const [checking, setChecking] = useState(false);
  const [auto, setAuto] = useState(true);
  const [events, setEvents] = useState<UsageEvent[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const refreshHealth = useCallback(async () => {
    setChecking(true);
    try {
      setHealth(await collectHealth());
    } finally {
      setChecking(false);
    }
  }, []);

  // Token usage: load + live subscribe.
  useEffect(() => {
    setEvents(getUsageEvents());
    return subscribeUsage(() => setEvents(getUsageEvents()));
  }, []);

  // Initial health check.
  useEffect(() => {
    void refreshHealth();
  }, [refreshHealth]);

  // Auto-refresh loop.
  useEffect(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    if (auto) {
      timerRef.current = setInterval(() => void refreshHealth(), REFRESH_MS);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [auto, refreshHealth]);

  const summary = summarizeUsage(events);
  const recent = [...events].slice(-12).reverse();
  const maxModelTokens = Math.max(1, ...summary.byModel.map((m) => m.totalTokens));
  const overall = health?.overall ?? 'down';
  const overallMeta = STATUS_META[overall];

  return (
    <div className="space-y-6">
      {/* Hero */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-2xl font-bold tracking-tight">
            <Activity className="h-6 w-6" style={{ color: ACCENT }} />
            System Monitoring
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Live health of every service in the stack and cumulative{' '}
            <strong>token usage</strong> captured from each local model request.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={() => setAuto((v) => !v)}
            className={cn(
              'inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition',
              auto ? 'text-foreground' : 'text-muted-foreground',
            )}
            style={
              auto
                ? {
                    borderColor: `color-mix(in srgb, ${ACCENT} 45%, transparent)`,
                    background: `color-mix(in srgb, ${ACCENT} 10%, transparent)`,
                  }
                : undefined
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ background: auto ? ACCENT : '#94a3b8' }}
            />
            Auto-refresh
          </button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void refreshHealth()}
            disabled={checking}
            className="h-9"
          >
            <RefreshCw className={cn('mr-1.5 h-4 w-4', checking && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {/* Overall status banner */}
      <Card
        className="flex flex-wrap items-center justify-between gap-3 p-4"
        style={{
          borderColor: `color-mix(in srgb, ${overallMeta.color} 40%, transparent)`,
          background: `color-mix(in srgb, ${overallMeta.color} 7%, transparent)`,
        }}
      >
        <div className="flex items-center gap-3">
          <overallMeta.Icon
            className="h-6 w-6"
            style={{ color: overallMeta.color }}
          />
          <div>
            <div className="text-sm font-semibold">
              {health ? `System ${overallMeta.label.toLowerCase()}` : 'Checking…'}
            </div>
            <div className="text-xs text-muted-foreground">
              {health
                ? `${health.services.filter((s) => s.status === 'up').length}/${health.services.length} services up`
                : 'Probing services…'}
            </div>
          </div>
        </div>
        {health && (
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            Checked {timeAgo(health.checkedAt)}
          </div>
        )}
      </Card>

      {/* System health grid */}
      <section className="space-y-3">
        <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          <Server className="h-4 w-4" />
          Service health
        </h3>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {(health?.services ?? []).map((svc) => {
            const meta = STATUS_META[svc.status];
            return (
              <Card key={svc.name} className="flex flex-col gap-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex min-w-0 items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: meta.color }}
                    />
                    <span className="truncate text-sm font-semibold">
                      {svc.name}
                    </span>
                  </div>
                  <span
                    className="shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{
                      color: meta.color,
                      background: `color-mix(in srgb, ${meta.color} 12%, transparent)`,
                    }}
                  >
                    {meta.label}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="truncate">{svc.detail || svc.error || svc.url}</span>
                  {svc.latencyMs != null && (
                    <span className="shrink-0 font-mono">{svc.latencyMs} ms</span>
                  )}
                </div>
              </Card>
            );
          })}
          {!health &&
            Array.from({ length: 5 }).map((_, i) => (
              <Card key={i} className="h-[76px] animate-pulse bg-muted/40 p-4" />
            ))}
        </div>
      </section>

      {/* Token usage */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Coins className="h-4 w-4" />
            Token usage
          </h3>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs text-muted-foreground"
            onClick={() => clearUsage()}
            disabled={events.length === 0}
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            Reset
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <StatTile icon={Cpu} label="Requests" value={fmt(summary.requests)} accent={ACCENT} />
          <StatTile
            icon={ArrowUpFromLine}
            label="Prompt tokens"
            value={fmt(summary.promptTokens)}
            accent="#0ea5e9"
          />
          <StatTile
            icon={ArrowDownToLine}
            label="Completion tokens"
            value={fmt(summary.completionTokens)}
            accent="#8b5cf6"
          />
          <StatTile
            icon={Coins}
            label="Total tokens"
            value={fmt(summary.totalTokens)}
            accent="#f59e0b"
          />
          <StatTile
            icon={Gauge}
            label="Avg throughput"
            value={`${summary.avgTokensPerSec.toFixed(1)} tok/s`}
            accent="#16a34a"
          />
        </div>

        {events.length === 0 ? (
          <Card className="p-6 text-center text-sm text-muted-foreground">
            No model requests recorded yet. Use any app (Chat, CRM, Summarizer…)
            and token usage will appear here.
          </Card>
        ) : (
          <div className="grid gap-3 lg:grid-cols-[1fr_1fr]">
            {/* By model */}
            <Card className="overflow-hidden p-0">
              <div className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                By model
              </div>
              <div className="divide-y">
                {summary.byModel.map((m) => (
                  <div key={m.model} className="space-y-1.5 px-4 py-2.5">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="truncate font-mono text-xs">{m.model}</span>
                      <div className="flex shrink-0 items-center gap-3 text-xs text-muted-foreground">
                        <span>{fmt(m.requests)} reqs</span>
                        <span className="font-semibold text-foreground">
                          {fmt(m.totalTokens)} tok
                        </span>
                      </div>
                    </div>
                    {/* Prompt vs completion split bar */}
                    <div
                      className="flex h-1.5 overflow-hidden rounded-full bg-muted"
                      style={{ width: `${(m.totalTokens / maxModelTokens) * 100}%` }}
                      title={`${fmt(m.promptTokens)} prompt + ${fmt(m.completionTokens)} completion`}
                    >
                      <span
                        className="h-full"
                        style={{
                          width: `${(m.promptTokens / Math.max(1, m.totalTokens)) * 100}%`,
                          background: '#0ea5e9',
                        }}
                      />
                      <span
                        className="h-full"
                        style={{
                          width: `${(m.completionTokens / Math.max(1, m.totalTokens)) * 100}%`,
                          background: '#8b5cf6',
                        }}
                      />
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: '#0ea5e9' }} />
                        {fmt(m.promptTokens)} prompt
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full" style={{ background: '#8b5cf6' }} />
                        {fmt(m.completionTokens)} completion
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            {/* Recent requests */}
            <Card className="overflow-hidden p-0">
              <div className="border-b px-4 py-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Recent requests
              </div>
              <div className="max-h-[280px] divide-y overflow-y-auto">
                {recent.map((e, i) => (
                  <div
                    key={`${e.at}-${i}`}
                    className="flex items-center justify-between gap-3 px-4 py-2 text-xs"
                  >
                    <span className="truncate font-mono">{e.model}</span>
                    <div className="flex shrink-0 items-center gap-2 text-muted-foreground">
                      <span title="prompt → completion">
                        {fmt(e.promptTokens)} → {fmt(e.completionTokens)}
                      </span>
                      {e.evalMs > 0 && (
                        <span className="font-mono">
                          {(e.completionTokens / (e.evalMs / 1000)).toFixed(0)} t/s
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}
      </section>
    </div>
  );
}

function StatTile({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Cpu;
  label: string;
  value: string;
  accent: string;
}) {
  return (
    <Card className="flex flex-col gap-1 p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-4 w-4" style={{ color: accent }} />
        {label}
      </div>
      <div className="text-xl font-bold tracking-tight">{value}</div>
    </Card>
  );
}
