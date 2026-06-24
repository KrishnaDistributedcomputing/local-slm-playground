import { createFileRoute } from '@tanstack/react-router';
import { Database } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/sql')({
  component: SqlGenerator,
});

function SqlGenerator() {
  return (
    <TextToolApp
      title="SQL Generator"
      description="Turn a plain-English request into a SQL query with a local model. Nothing leaves your machine."
      icon={Database}
      system="You are an expert SQL engineer. Convert the user's plain-English request into a correct, well-formatted SQL query. If table or column names are not given, choose sensible ones and note any assumptions in a brief comment. Output the SQL in a code block followed by a one-sentence explanation."
      inputLabel="Describe the query"
      placeholder="e.g. Top 5 customers by total order value in 2024…"
      runLabel="Generate SQL"
      outputLabel="SQL query"
      accent="#f97316"
    />
  );
}
