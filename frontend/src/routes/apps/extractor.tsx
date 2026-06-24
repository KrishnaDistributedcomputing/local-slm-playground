import { createFileRoute } from '@tanstack/react-router';
import { Braces } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/extractor')({
  component: Extractor,
});

function Extractor() {
  return (
    <TextToolApp
      title="Data Extractor"
      description="Turn unstructured text — emails, invoices, notes — into structured JSON with a local model."
      icon={Braces}
      system="You extract structured data from unstructured text. Return ONLY valid JSON with sensible keys for the entities, attributes, dates, amounts, and names you find. Use nested objects and arrays where appropriate. Do not include explanations or markdown code fences."
      inputLabel="Unstructured text"
      placeholder="Paste an email, invoice, receipt, or note…"
      runLabel="Extract JSON"
      outputLabel="Structured JSON"
    />
  );
}
