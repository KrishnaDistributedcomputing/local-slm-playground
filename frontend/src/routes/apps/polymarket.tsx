import { createFileRoute } from '@tanstack/react-router';
import { CircleDollarSign } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/polymarket')({
  component: Polymarket,
});

function Polymarket() {
  return (
    <TextToolApp
      title="Polymarket Analyst"
      description="Describe a real-world event and a local model estimates the market odds, Polymarket-style. For research only — not financial advice. Nothing leaves your machine."
      icon={CircleDollarSign}
      system={[
        'You are a prediction-market analyst in the style of Polymarket, where users trade YES/NO shares on real-world events priced from $0.00 to $1.00 (the implied probability).',
        "Given the user's event or question, respond in Markdown with:",
        '1. **Market** — restate the event as a clear YES/NO resolution question.',
        '2. **Estimated probability** — a single percentage for YES, plus the implied YES and NO share prices in dollars (e.g. YES $0.62 / NO $0.38).',
        '3. **Key drivers** — 3-5 bullet points of the most important factors for and against.',
        '4. **Edge & uncertainty** — note how confident this estimate is and what could move the market.',
        'Be calibrated and concise. Avoid false precision. Always end with the disclaimer: "Not financial advice — for research and entertainment only."',
      ].join('\n')}
      inputLabel="Event or question"
      placeholder="e.g. Will a new model beat GPT-4 on the LMArena leaderboard before the end of the quarter?"
      runLabel="Estimate odds"
      outputLabel="Market analysis"
    />
  );
}
