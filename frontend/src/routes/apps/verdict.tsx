/**
 * Verdict Markets - a local-model prediction-market demo.
 *
 * The user enters a real-world event question; the local Ollama model prices it
 * as a YES/NO event contract (cents = implied probability) and the result is
 * rendered as a market card. For research / demo only.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  TrendingUp,
  Search,
  Loader2,
  Square,
  BarChart3,
  Activity,
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

export const Route = createFileRoute('/apps/verdict')({
  component: Verdict,
});

/** Verdict Markets brand palette. */
const MINT = '#00D09C';
const YES = '#16a34a';
const NO = '#ef4444';

const CATEGORIES = [
  'Trending',
  'Politics',
  'Economics',
  'Crypto',
  'Sports',
  'Climate',
  'Culture',
  'Tech',
] as const;

const EXAMPLES = [
  'Will the US Federal Reserve cut interest rates at its next meeting?',
  'Will Bitcoin close above $100,000 by the end of the year?',
  'Will US CPI inflation come in below 3% year-over-year next month?',
];

/** Static trending markets — copy the look & feel of the real exchange. */
const TRENDING: {
  category: string;
  title: string;
  yes: number;
  vol: string;
  tag?: string;
}[] = [
  { category: 'ECONOMICS', title: 'Fed cuts rates at the next meeting?', yes: 38, vol: '$2.4M vol', tag: 'LIVE' },
  { category: 'CRYPTO', title: 'Bitcoin above $100k by year end?', yes: 64, vol: '$8.1M vol' },
  { category: 'POLITICS', title: 'Government shutdown before October?', yes: 21, vol: '$1.2M vol', tag: 'NEW' },
  { category: 'CLIMATE', title: '2026 is the hottest year on record?', yes: 72, vol: '$640K vol' },
];

interface Contract {
  title: string;
  category: string;
  yes: number;
  no: number;
  probability: number;
  resolution: string;
  closes: string;
  drivers: string[];
  catalysts: string[];
  summary: string;
}

const SYSTEM = [
  'You are an event-contracts analyst for a YES/NO prediction market, an exchange where members trade YES/NO contracts that settle at 100 cents (true) or 0 cents (false). A contract price in cents equals the implied probability.',
  'Given the user event or question, respond with ONLY a single minified JSON object (no markdown, no commentary) using exactly these keys:',
  '"title": a precise, verifiable YES/NO question;',
  '"category": one of Politics, Economics, Crypto, Sports, Climate, Culture, Tech;',
  '"yes": integer cents 1-99;',
  '"no": integer = 100 minus yes;',
  '"probability": integer percent equal to yes;',
  '"resolution": one sentence describing exactly how the market resolves YES;',
  '"closes": a short human resolution date or window;',
  '"drivers": array of 3-5 short strings (key factors and base rates);',
  '"catalysts": array of 2-3 short strings (upcoming events that move the price);',
  '"summary": one sentence of news-style context.',
  'Be calibrated and avoid overconfidence. Ensure yes + no = 100. Output JSON only.',
].join(' ');

function extractContract(text: string): Contract | null {
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
  let yes = Math.round(Number(o.yes ?? o.probability ?? 50));
  if (!Number.isFinite(yes)) yes = 50;
  yes = Math.min(99, Math.max(1, yes));
  const no = 100 - yes;
  const arr = (v: unknown): string[] =>
    Array.isArray(v) ? v.map((x) => String(x)).filter(Boolean) : [];
  return {
    title: String(o.title ?? '').trim() || 'Untitled market',
    category: String(o.category ?? 'Trending').trim(),
    yes,
    no,
    probability: yes,
    resolution: String(o.resolution ?? '').trim(),
    closes: String(o.closes ?? '').trim(),
    drivers: arr(o.drivers),
    catalysts: arr(o.catalysts),
    summary: String(o.summary ?? '').trim(),
  };
}

function ProbabilityBar({ yes }: { yes: number }) {
  return (
    <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
      <div style={{ width: `${yes}%`, backgroundColor: YES }} />
      <div style={{ width: `${100 - yes}%`, backgroundColor: NO }} />
    </div>
  );
}

function Verdict() {
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [models, setModels] = useState<string[]>([]);
  const [category, setCategory] = useState<string>('Trending');
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [contract, setContract] = useState<Contract | null>(null);
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
    setContract(null);
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
      const parsed = extractContract(buffer);
      if (parsed) setContract(parsed);
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

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Brand bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/60 bg-card/60 px-5 py-4 shadow-sm backdrop-blur">
        <div className="flex items-center gap-3">
          <div
            className="flex h-10 w-10 items-center justify-center rounded-xl font-black text-white"
            style={{ backgroundColor: MINT }}
          >
            V
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl font-extrabold tracking-tight">
                Verdict Markets
              </span>
              <span
                className="rounded-full px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: MINT,
                  backgroundColor: `color-mix(in srgb, ${MINT} 14%, transparent)`,
                }}
              >
                demo
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Prediction market for trading the future — priced by a local model
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/70 bg-background/80 px-3 py-1.5 shadow-sm">
          <Activity className="h-3.5 w-3.5" style={{ color: MINT }} />
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
                active
                  ? { backgroundColor: MINT, borderColor: MINT }
                  : undefined
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
          <Search className="h-4 w-4" style={{ color: MINT }} />
          <h2 className="text-sm font-bold tracking-tight">Price a market</h2>
        </div>
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask a yes/no question about a future event — e.g. Will the Fed cut rates at its next meeting?"
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
                setContract(null);
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
                backgroundImage: `linear-gradient(135deg, ${MINT}, color-mix(in srgb, ${MINT} 70%, black))`,
              }}
            >
              <BarChart3 className="h-4 w-4" />
              Price contract
            </Button>
          )}
          <span className="text-xs text-muted-foreground">
            {loading ? 'Pricing the market…' : 'YES + NO always = 100¢'}
          </span>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading && !contract && (
        <div className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card/60 p-6 text-sm text-muted-foreground shadow-sm">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: MINT }} />
          Building the contract and pricing YES/NO…
        </div>
      )}

      {/* Result market card */}
      {contract && (
        <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
          <div className="space-y-4 p-5">
            <div className="flex items-center gap-2">
              <span
                className="rounded-md px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  color: MINT,
                  backgroundColor: `color-mix(in srgb, ${MINT} 14%, transparent)`,
                }}
              >
                {contract.category}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
                {contract.closes || 'Open'}
              </span>
            </div>

            <h3 className="text-lg font-bold leading-snug tracking-tight">
              {contract.title}
            </h3>

            {/* Probability + price buttons */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                <span>Implied probability</span>
                <span style={{ color: YES }}>{contract.probability}%</span>
              </div>
              <ProbabilityBar yes={contract.yes} />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-transform hover:scale-[1.01]"
                style={{
                  borderColor: `color-mix(in srgb, ${YES} 35%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${YES} 8%, transparent)`,
                }}
              >
                <span className="text-sm font-bold" style={{ color: YES }}>
                  Yes
                </span>
                <span className="text-lg font-extrabold" style={{ color: YES }}>
                  {contract.yes}¢
                </span>
              </button>
              <button
                type="button"
                className="flex items-center justify-between rounded-xl border px-4 py-3 text-left transition-transform hover:scale-[1.01]"
                style={{
                  borderColor: `color-mix(in srgb, ${NO} 35%, transparent)`,
                  backgroundColor: `color-mix(in srgb, ${NO} 8%, transparent)`,
                }}
              >
                <span className="text-sm font-bold" style={{ color: NO }}>
                  No
                </span>
                <span className="text-lg font-extrabold" style={{ color: NO }}>
                  {contract.no}¢
                </span>
              </button>
            </div>

            {contract.summary && (
              <p className="text-sm leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">News · </span>
                {contract.summary}
              </p>
            )}

            {contract.drivers.length > 0 && (
              <div>
                <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  Why this price
                </h4>
                <ul className="space-y-1">
                  {contract.drivers.map((d, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: MINT }}>•</span>
                      <span className="text-muted-foreground">{d}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {contract.catalysts.length > 0 && (
              <div>
                <h4 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  <TrendingUp className="h-3.5 w-3.5" />
                  What moves the price
                </h4>
                <ul className="space-y-1">
                  {contract.catalysts.map((c, i) => (
                    <li key={i} className="flex gap-2 text-sm">
                      <span style={{ color: MINT }}>•</span>
                      <span className="text-muted-foreground">{c}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {contract.resolution && (
              <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
                <span className="font-semibold text-foreground">
                  Resolution ·{' '}
                </span>
                {contract.resolution}
              </p>
            )}
          </div>
          <div className="border-t border-border/60 bg-muted/30 px-5 py-2.5 text-[11px] text-muted-foreground">
            Not financial advice — for research and entertainment only. Priced by{' '}
            <span className="font-semibold">{model}</span>, running locally.
          </div>
        </div>
      )}

      {/* Raw fallback if the model didn't return valid JSON */}
      {rawFallback && !contract && (
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
          <TrendingUp className="h-4 w-4" style={{ color: MINT }} />
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
                    style={{ backgroundColor: m.tag === 'LIVE' ? NO : MINT }}
                  >
                    {m.tag}
                  </span>
                )}
              </div>
              <p className="mb-3 text-sm font-semibold leading-snug">
                {m.title}
              </p>
              <ProbabilityBar yes={m.yes} />
              <div className="mt-3 flex items-center justify-between">
                <div className="flex gap-2">
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{
                      color: YES,
                      backgroundColor: `color-mix(in srgb, ${YES} 10%, transparent)`,
                    }}
                  >
                    Yes {m.yes}¢
                  </span>
                  <span
                    className="rounded-lg px-2.5 py-1 text-xs font-bold"
                    style={{
                      color: NO,
                      backgroundColor: `color-mix(in srgb, ${NO} 10%, transparent)`,
                    }}
                  >
                    No {100 - m.yes}¢
                  </span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  {m.vol}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
