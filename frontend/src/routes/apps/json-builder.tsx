import { createFileRoute } from '@tanstack/react-router';
import { FileJson } from 'lucide-react';
import { TextToolApp } from '@/components/TextToolApp';

export const Route = createFileRoute('/apps/json-builder')({
  component: JsonBuilder,
});

function JsonBuilder() {
  return (
    <TextToolApp
      title="JSON Builder"
      description="Describe the data you need and a local model turns it into well-formed JSON. Nothing leaves your machine."
      icon={FileJson}
      system="You are a JSON generator. Convert the user's description into a single, valid JSON document that best represents the requested data. Infer sensible field names, nesting, and data types, and include realistic example values. Output ONLY the JSON inside a ```json code block, with no commentary before or after."
      inputLabel="Describe the data"
      placeholder="e.g. A user profile with name, email, age, a list of roles, and an address with city and country…"
      runLabel="Generate JSON"
      outputLabel="JSON"
    />
  );
}
