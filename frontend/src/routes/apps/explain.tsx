import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { GraduationCap } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

const LEVELS = ['a 5-year-old', 'a high-school student', 'a college student', 'an expert'];

export const Route = createFileRoute('/apps/explain')({
  component: Explain,
});

function Explain() {
  const [level, setLevel] = useState('a 5-year-old');

  return (
    <TextToolApp
      title="Explainer"
      description="Explain any concept at the level you choose using a local model — fully offline and private."
      icon={GraduationCap}
      system={`You are a brilliant teacher. Explain the concept the user provides so that ${level} can understand it. Use clear language, helpful analogies, and a short example. Output only the explanation.`}
      inputLabel="Concept to explain"
      placeholder="e.g. How does HTTPS keep data secure?"
      runLabel="Explain"
      outputLabel="Explanation"
      accent="#06b6d4"
      controls={
        <select
          value={level}
          onChange={(e) => setLevel(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Audience level"
        >
          {LEVELS.map((l) => (
            <option key={l} value={l}>
              For {l}
            </option>
          ))}
        </select>
      }
    />
  );
}
