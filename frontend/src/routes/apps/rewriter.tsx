import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Wand2 } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

const STYLES = [
  'More formal',
  'More casual',
  'More concise',
  'More detailed',
  'Friendlier',
  'More confident',
];

export const Route = createFileRoute('/apps/rewriter')({
  component: Rewriter,
});

function Rewriter() {
  const [style, setStyle] = useState('More formal');

  return (
    <TextToolApp
      title="Tone Rewriter"
      description="Rewrite text in a different tone or style using a local model — fully offline and private."
      icon={Wand2}
      system={`You are an expert editor. Rewrite the user's text to be ${style.toLowerCase()}. Preserve the original meaning and key facts. Output only the rewritten text, with no commentary.`}
      inputLabel="Text to rewrite"
      placeholder="Paste the text you want to rephrase…"
      runLabel="Rewrite"
      outputLabel={`Rewritten (${style})`}
      accent="#d946ef"
      controls={
        <select
          value={style}
          onChange={(e) => setStyle(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Style"
        >
          {STYLES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      }
    />
  );
}
