/**
 * Predikt - a local-model prediction-market demo.
 *
 * The user enters a real-world event; the local Ollama model estimates the
 * market as an event with one or more outcomes, each priced as an implied
 * probability (a YES share from 1¢ to 99¢). The result is rendered as a market
 * card. For research / demo only.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  Search,
  Loader2,
  Square,
  BarChart3,
  Sparkles,
} from 'lucide-react';
import {
  streamChat,
  listModels,
  DEFAULT_MODEL,
  type ChatMessage,
} from '@/data/ollama';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/apps/predikt')({
  component: Predikt,
});

/** Predikt brand palette. */
const BLUE = '#1652F0';
const YES = '#27ae60';
const NO = '#e64800';

const CATEGORIES = [
  'Trending',
  'Politics',
  'Sports',
  'Crypto',
  'Geopolitics',
  'Finance',
  'Tech',
  'Culture',
] as const;

const EXAMPLES = [
  'Who will win the 2028 US presidential election?',
  'Will Bitcoin close above $100,000 by the end of the year?',
  'Will the Fed cut interest rates at its July meeting?',
];

/** Static trending markets — copy the look & feel of the real exchange. */
const TRENDING: {
  category: string;
  title: string;
  chance: number;
  vol: string;
  tag?: string;
}[] = [
  { category: 'POLITICS', title: 'Will the Democrats win the House in 2026?', chance: 81, vol: '$8M Vol.' },
  { category: 'CRYPTO', title: 'Bitcoin above $100k by year end?', chance: 64, vol: '$26M Vol.', tag: 'LIVE' },
  { category: 'GEOPOLITICS', title: 'US-Iran nuclear deal by August 31?', chance: 24, vol: '$2M Vol.' },
  { category: 'SPORTS', title: 'Will France win the 2026 World Cup?', chance: 19, vol: '$3B Vol.' },
];

interface Outcome {
  label: string;
  probability: number; // YES probability, 1-99
}

interface Market {
  title: string;
  category: string;
  outcomes: Outcome[];
  volume: string;
  closes: string;
  summary: string;
  drivers: string[];
}

const SYSTEM = [
  'You are a prediction-market analyst for an exchange where members trade YES shares on real-world outcomes. A share price in cents equals the implied probability (a 62¢ YES share means a 62% chance).',
  'Given the user event or question, respond with ONLY a single minified JSON object (no markdown, no commentary) using exactly these keys:',
  '"title": a clear, verifiable market question (the event headline);',
  '"category": one of Politics, Sports, Crypto, Geopolitics, Finance, Tech, Culture;',
  '"outcomes": an array of 1 to 5 objects, each {"label": short outcome name, "probability": integer 1-99}. For a simple yes/no question use a single outcome with label "Yes". For a "who/which" question, list the leading candidates as separate outcomes. Probabilities should be calibrated and need not sum to 100;',
  '"volume": a realistic dollar volume string such as "$2.4M Vol." or "$640K Vol.";',
  '"closes": a short human resolution date or window;',
  '"summary": one sentence of news-style context;',
  '"drivers": array of 3-5 short strings (key factors and base rates).',
  'Be calibrated and avoid overconfidence. Output JSON only.',
].join(' ');

function extractMarket(text: string): Market | null {
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end < start) return null;
  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];

  let outcomes: Outcome[] = [];
  if (Array.isArray(o.outcomes)) {
    outcomes = o.outcomes
      .map((x) => {
        const ox = x as Record<string, unknown>;
        let p = Math.round(Number(ox.probability ?? ox.yes ?? 50));
        if (!Number.isFinite(p)) p = 50;
        p = Math.min(99, Math.max(1, p));
        return { label: String(ox.label ?? 'Yes').trim() || 'Yes', probability: p };
      })
      .slice(0, 5);
  }
  if (outcomes.length === 0) {
    let p = Math.round(Number(o.probability ?? o.yes ?? 50));
    if (!Number.isFinite(p)) p = 50;
    p = Math.min(99, Math.max(1, p));
    outcomes = [{ label: 'Yes', probability: p }];
  }
  // Sort multi-outcome markets by probability, descending — Polymarket style.
  if (outcomes.length > 1) outcomes.sort((a, b) => b.probability - a.probability);

  return {
    title: String(o.title ?? '').trim() || 'Untitled market',
    category: String(o.category ?? 'Trending').trim(),
    outcomes,
    volume: String(o.volume ?? '').trim() || '$0 Vol.',
    closes: String(o.closes ?? '').trim(),
    summary: String(o.summary ?? '').trim(),
    drivers: arr(o.drivers),
  };
}

/** Polymarket-style donut showing the YES probability of a binary market. */
function ChanceDonut({ chance }: { chance: number }) {
  const r = 26;
  const c = 2 * Math.PI * r;
  const dash = (chance / 100) * c;
  return (
    <div className="relative h-[68px] w-[68px] shrink-0">
      <svg viewBox="0 0 68 68" className="h-full w-full -rotate-90">
        <circle cx="34" cy="34" r={r} fill="none" stroke="currentColor" strokeWidth="7" className="text-muted" />
        <circle
          cx="34"
          cy="34"
          r={r}
          fill="none"
          stroke={chance >= 50 ? YES : NO}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${c}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center leading-none">
        <span className="text-base font-extrabold">{chance}%</span>
        <span className="text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
          chance
        </span>
      </div>
    </div>
  );
}

function Predikt() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [models, setModels] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('Trending');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [market, setMarket] = useState<Market | null>(null);
  const [rawFallback, setRawFallback] = useState('');
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    listModels().then((m) => {
      if (m.length) setModels(m);
    });
  }, []);

  async function price() {
    const text = input.trim();
    if (!text || loading) return;
    setError(null);
    setMarket(null);
    setRawFallback('');
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    const messages: ChatMessage[] = [
      { role: 'system', content: SYSTEM },
      {
        role: 'user',
        content:
          category === 'Trending' ? text : `[Category: ${category}] ${text}`,
      },
    ];

    let buffer = '';
    try {
      await streamChat(messages, {
        model,
        signal: controller.signal,
        onToken: (t) => {
          buffer += t;
        },
      });
      const parsed = extractMarket(buffer);
      if (parsed) setMarket(parsed);
      else setRawFallback(buffer.trim());
    } catch (err) {
      if ((err as Error).name !== 'AbortError') {
        setError((err as Error).message);
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }

  function stop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  const isBinary = market?.outcomes.length === 1;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Brand bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-5 py-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-white"
            style={{ backgroundColor: BLUE }}
          >
            P
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight">
                Predikt
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: BLUE,
                  backgroundColor: `color-mix(in srgb, ${BLUE} 14%, transparent)`,
                }}
              >
                demo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Prediction market for real-world events — priced by a local model
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 shadow-sm">
          <Sparkles className="h-3.5 w-3.5" style={{ color: BLUE }} />
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

      {/* Category pills */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map((c) => {
          const active = category === c;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                'rounded-full border px-3 py-1.5 text-sm font-semibold transition-colors',
                active
                  ? 'text-white'
                  : 'border-border/70 text-muted-foreground hover:bg-muted',
              )}
              style={
                active ? { backgroundColor: BLUE, borderColor: BLUE } : undefined
              }
            >
              {c}
            </button>
          );
        })}
      </div>

      {/* Create a market */}
      <div className="rounded-2xl border border-border/60 bg-card/60 p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Search className="h-4 w-4" style={{ color: BLUE }} />
          <h2 className="text-sm font-bold tracking-tight">Price a market</h2>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about a future event — e.g. Who will win the 2028 US presidential election?"
          className="min-h-[88px] resize-none rounded-xl border-border/60 bg-muted/30 text-sm leading-relaxed focus-visible:bg-background"
        />
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-medium text-muted-foreground">Try:</span>
          {EXAMPLES.map((ex, i) => (
            <button
              key={i}
              type="button"
              onClick={() => {
                setInput(ex);
                setMarket(null);
                setRawFallback('');
                setError(null);
              }}
              className="rounded-full border border-border/70 bg-background/80 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {ex.length > 42 ? `${ex.slice(0, 42)}…` : ex}
            </button>
          ))}
        </div>
        <div className="mt-4 flex items-center justify-between gap-2">
          {loading ? (
            <Button
              variant="destructive"
              onClick={stop}
              className="rounded-xl shadow-sm"
            >
              <Square className="h-4 w-4" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={price}
              disabled={!input.trim()}
              className="rounded-xl text-white shadow-sm transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
              style={{
                backgroundImage: `linear-gradient(135deg, ${BLUE}, color-mix(in srgb, ${BLUE} 70%, black))`,
              }}
            >
              <BarChart3 className="h-4 w-4" />
              Get odds
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {loading ? 'Pricing the market…' : 'Prices = implied probability'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !market && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: BLUE }} />
          Estimating the market and pricing the outcomes…
        </div>
      )}

      {/* Result market card */}
      {market && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: BLUE,
                  backgroundColor: `color-mix(in srgb, ${BLUE} 14%, transparent)`,
                }}
              >
                {market.category}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {market.closes || 'Open'}
              </span>
            </div>

            {/* Title row — binary markets show the chance donut on the right. */}
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-lg font-bold leading-snug tracking-tight">
                {market.title}
              </h3>
              {isBinary && <ChanceDonut chance={market.outcomes[0].probability} />}
            </div>

            {/* Outcomes */}
            {isBinary ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-transform hover:scale-[1.01]"
                  style={{
                    color: YES,
                    borderColor: `color-mix(in srgb, ${YES} 35%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${YES} 10%, transparent)`,
                  }}
                >
                  Buy Yes
                  <span className="font-extrabold">
                    {market.outcomes[0].probability}¢
                  </span>
                </button>
                <button
                  type="button"
                  className="flex items-center justify-center gap-2 rounded-xl border px-4 py-3 text-sm font-bold transition-transform hover:scale-[1.01]"
                  style={{
                    color: NO,
                    borderColor: `color-mix(in srgb, ${NO} 35%, transparent)`,
                    backgroundColor: `color-mix(in srgb, ${NO} 10%, transparent)`,
                  }}
                >
                  Buy No
                  <span className="font-extrabold">
                    {100 - market.outcomes[0].probability}¢
                  </span>
                </button>
              </div>
            ) : (
              <ul className="divide-y divide-border/60">
                {market.outcomes.map((o, i) => (
                  <li
                    key={i}
                    className="flex items-center justify-between gap-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="truncate text-sm font-semibold">
                        {o.label}
                      </span>
                      <span className="text-sm font-extrabold tabular-nums">
                        {o.probability}%
                      </span>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold"
                        style={{
                          color: YES,
                          backgroundColor: `color-mix(in srgb, ${YES} 12%, transparent)`,
                        }}
                      >
                        Yes {o.probability}¢
                      </span>
                      <span
                        className="rounded-lg px-2.5 py-1 text-xs font-bold"
                        style={{
                          color: NO,
                          backgroundColor: `color-mix(in srgb, ${NO} 12%, transparent)`,
                        }}
                      >
                        No {100 - o.probability}¢
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}

            <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
              <span>{market.volume}</span>
              <span className="flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" />
                Live odds
              </span>
            </div>

            {market.summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">News · </span>
                {market.summary}
              </p>
            )}

            {market.drivers.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Why these odds
                </h4>
                <ul className="space-y-1">
                  {market.drivers.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: BLUE }}>•</span>
                      <span className="text-muted-foreground">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          <div className="border-t border-border/60 bg-muted/30 px-5 py-2.5 text-[11px] text-muted-foreground">
            Not financial advice — for research and entertainment only. Priced by{' '}
            <span className="font-semibold">{model}</span>, running locally.
          </div>
        </div>
      )}

      {/* Raw fallback if the model didn't return valid JSON */}
      {rawFallback && !market && (
        <div className="rounded-2xl border border-border/60 bg-card/60 p-5 text-sm shadow-sm">
          <h4 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
            Analyst notes
          </h4>
          <div className="whitespace-pre-wrap break-words text-muted-foreground">
            {rawFallback}
          </div>
        </div>
      )}

      {/* Trending markets — static, to copy the exchange look & feel */}
      <div>
        <div className="mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4" style={{ color: BLUE }} />
          <h2 className="text-sm font-bold tracking-tight">Trending markets</h2>
          <span className="text-xs text-muted-foreground">(sample)</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          {TRENDING.map((m, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border/60 bg-card p-4 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="mb-2 flex items-center gap-2">
                <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                  {m.category}
                </span>
                {m.tag && (
                  <span
                    className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white"
                    style={{ backgroundColor: BLUE }}
                  >
                    {m.tag}
                  </span>
                )}
              </div>
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold leading-snug">{m.title}</p>
                <ChanceDonut chance={m.chance} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{
                      color: YES,
                      backgroundColor: `color-mix(in srgb, ${YES} 12%, transparent)`,
                    }}
                  >
                    Buy Yes
                  </span>
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{
                      color: NO,
                      backgroundColor: `color-mix(in srgb, ${NO} 12%, transparent)`,
                    }}
                  >
                    Buy No
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">{m.vol}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
