import { createFileRoute } from '@tanstack/react-router';
import { FileText } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/summarizer')({
  component: Summarizer,
});

function Summarizer() {
  return (
    <TextToolApp
      title="Summarizer"
      description="Condense long text into clear bullet points using a local model. Nothing leaves your machine."
      icon={FileText}
      system="You are a precise summarization assistant. Summarize the user's text into 3-6 concise bullet points that capture the key information. Do not add facts that are not present in the text. Output only the bullet points."
      inputLabel="Text to summarize"
      placeholder="Paste an article, document, meeting notes…"
      runLabel="Summarize"
      outputLabel="Summary"
      accent="#0ea5e9"
    />
  );
}
