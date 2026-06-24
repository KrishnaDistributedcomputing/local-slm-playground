import { createFileRoute } from '@tanstack/react-router';
import { useState } from 'react';
import { Mail } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

const TONES = ['Professional', 'Friendly', 'Concise', 'Formal', 'Apologetic', 'Persuasive'];

export const Route = createFileRoute('/apps/email-writer')({
  component: EmailWriter,
});

function EmailWriter() {
  const [tone, setTone] = useState('Professional');

  return (
    <TextToolApp
      title="Email Writer"
      description="Turn a few notes into a polished email with a local model — fully offline and private."
      icon={Mail}
      system={`You are an expert email writer. Compose a well-structured ${tone.toLowerCase()} email based on the user's notes. Include a clear subject line, greeting, body, and sign-off. Output only the email.`}
      inputLabel="What is the email about?"
      placeholder="e.g. Ask the team to move tomorrow's standup to 11am…"
      runLabel="Write email"
      outputLabel={`Email (${tone})`}
      accent="#3b82f6"
      controls={
        <select
          value={tone}
          onChange={(e) => setTone(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-2 text-sm"
          aria-label="Tone"
        >
          {TONES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      }
    />
  );
}
