import { createFileRoute } from '@tanstack/react-router';
import { SpellCheck } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/proofreader')({
  component: Proofreader,
});

function Proofreader() {
  return (
    <TextToolApp
      title="Proofreader"
      description="Fix grammar, spelling, and punctuation with a local model. Nothing leaves your machine."
      icon={SpellCheck}
      system="You are a meticulous proofreader. Correct all grammar, spelling, and punctuation mistakes in the user's text while preserving the original meaning and tone. Output only the corrected text, with no commentary."
      inputLabel="Text to proofread"
      placeholder="Paste the text you want corrected…"
      runLabel="Proofread"
      outputLabel="Corrected text"
      accent="#14b8a6"
    />
  );
}
