import { createFileRoute } from '@tanstack/react-router';
import { CandlestickChart } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/kalshi')({
  component: Kalshi,
});

function Kalshi() {
  return (
    <TextToolApp
      title="Kalshi Analyst"
      description="Turn an event question into a Kalshi-style contract with YES/NO pricing in cents, using a local model. For research only — not financial advice. Nothing leaves your machine."
      icon={CandlestickChart}
      system={[
        'You are an event-contracts analyst in the style of Kalshi, a regulated exchange where members trade YES/NO contracts that settle at 100¢ (true) or 0¢ (false). A contract price in cents equals the implied probability.',
        "Given the user's event or question, respond in Markdown with:",
        '1. **Contract** — restate it as a precise, verifiable YES/NO event with an implied resolution date/source if relevant.',
        '2. **Pricing** — YES and NO prices in cents that sum to 100 (e.g. YES 58¢ / NO 42¢), and the implied probability.',
        '3. **Rationale** — 3-5 bullet points covering base rates, recent signals, and risks.',
        '4. **What would change the price** — key upcoming catalysts.',
        'Be calibrated, cite base rates where possible, and avoid overconfidence. Always end with the disclaimer: "Not financial advice — for research and entertainment only."',
      ].join('\n')}
      inputLabel="Event or question"
      placeholder="e.g. Will the US Federal Reserve cut interest rates at its next meeting?"
      runLabel="Price contract"
      outputLabel="Contract analysis"
    />
  );
}
