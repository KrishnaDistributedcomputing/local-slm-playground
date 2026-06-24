/**
 * Root Route - App Shell
 */

import { createRootRoute, Outlet, Link, useLocation } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { TanStackRouterDevtools } from '@tanstack/router-devtools';
import { cn } from '@/lib/utils';
import {
  Home,
  Sparkles,
  FileText,
  Languages,
  Code2,
  Braces,
  Server,
  Check,
  Minus,
  Mail,
  SpellCheck,
  Wand2,
  Lightbulb,
  GraduationCap,
  Database,
  FileJson,
  CloudCog,
  CircleDollarSign,
  CandlestickChart,
} from 'lucide-react';
import {
  getEndpoints,
  getOllamaUrl,
  setOllamaUrl,
  addEndpoint,
  type Endpoint,
} from '@/data/endpoint';
import { listModelDetails, type ModelInfo } from '@/data/ollama';
import { getModelProfile } from '@/data/modelProfiles';
import { modelColors } from '@/lib/modelColors';

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <div className="min-h-screen bg-background">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
      {import.meta.env.DEV && (
        <TanStackRouterDevtools position="bottom-right" />
      )}
    </div>
  );
}

function Header() {
  return (
    <header className="h-16 border-b bg-card flex items-center justify-between px-6">
      <h1 className="text-xl font-semibold">Local Models Playground</h1>
      <EndpointSelector />
    </header>
  );
}

function EndpointSelector() {
  const [endpoints, setEndpoints] = useState<Endpoint[]>(() => getEndpoints());
  const [current, setCurrent] = useState<string>(() => getOllamaUrl());

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value;
    if (value === '__add__') {
      const url = window.prompt(
        'Remote Ollama endpoint (e.g. an Azure ACI URL): http://<fqdn>:11434',
      );
      if (url && url.trim()) {
        const trimmed = url.trim();
        addEndpoint('Azure (ACI)', trimmed);
        setOllamaUrl(trimmed);
        setEndpoints(getEndpoints());
        setCurrent(trimmed);
        window.location.reload();
      }
      return;
    }
    setOllamaUrl(value);
    setCurrent(value);
    window.location.reload();
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <Server className="h-4 w-4 text-muted-foreground" />
      <select
        value={current}
        onChange={handleChange}
        className="h-9 max-w-[260px] rounded-md border border-input bg-background px-2"
        title={current}
        aria-label="Model endpoint"
      >
        {endpoints.map((ep) => (
          <option key={ep.url} value={ep.url}>
            {ep.label}
          </option>
        ))}
        <option value="__add__">+ Add Azure endpoint…</option>
      </select>
    </div>
  );
}

function Sidebar() {
  const location = useLocation();

  return (
    <aside className="w-64 border-r bg-card min-h-[calc(100vh-4rem)]">
      <nav className="p-4 space-y-2">
        <Link
          to="/"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            location.pathname === '/'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          <Home className="h-4 w-4" />
          Models
        </Link>

        <Link
          to="/chat"
          className={cn(
            'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
            location.pathname === '/chat'
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'
          )}
        >
          <Sparkles className="h-4 w-4" />
          AI Chat
        </Link>

        <div className="pt-4">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Apps
          </h3>
          <div className="mt-2 space-y-1">
            <Link
              to="/apps/summarizer"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/summarizer'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <FileText className="h-4 w-4" />
              Summarizer
            </Link>
            <Link
              to="/apps/translator"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/translator'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Languages className="h-4 w-4" />
              Translator
            </Link>
            <Link
              to="/apps/code-reviewer"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/code-reviewer'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Code2 className="h-4 w-4" />
              Code Reviewer
            </Link>
            <Link
              to="/apps/extractor"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/extractor'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Braces className="h-4 w-4" />
              Data Extractor
            </Link>
            <Link
              to="/apps/email-writer"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/email-writer'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Mail className="h-4 w-4" />
              Email Writer
            </Link>
            <Link
              to="/apps/proofreader"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/proofreader'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <SpellCheck className="h-4 w-4" />
              Proofreader
            </Link>
            <Link
              to="/apps/rewriter"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/rewriter'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Wand2 className="h-4 w-4" />
              Tone Rewriter
            </Link>
            <Link
              to="/apps/brainstorm"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/brainstorm'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Lightbulb className="h-4 w-4" />
              Brainstormer
            </Link>
            <Link
              to="/apps/explain"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/explain'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <GraduationCap className="h-4 w-4" />
              Explainer
            </Link>
            <Link
              to="/apps/sql"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/sql'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <Database className="h-4 w-4" />
              SQL Generator
            </Link>
            <Link
              to="/apps/json-builder"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/json-builder'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <FileJson className="h-4 w-4" />
              JSON Builder
            </Link>
            <Link
              to="/apps/azure-architecture"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/azure-architecture'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <CloudCog className="h-4 w-4" />
              Azure Architecture
            </Link>
            <Link
              to="/apps/polymarket"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/polymarket'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <CircleDollarSign className="h-4 w-4" />
              Polymarket
            </Link>
            <Link
              to="/apps/kalshi"
              className={cn(
                'flex items-center gap-3 px-3 py-2 rounded-lg transition-colors',
                location.pathname === '/apps/kalshi'
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted'
              )}
            >
              <CandlestickChart className="h-4 w-4" />
              Kalshi
            </Link>
          </div>
        </div>

        <div className="pt-4">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Which model should I use?
          </h3>
          <p className="mt-1 px-3 text-xs text-muted-foreground">
            Strengths and trade-offs of each installed model.
          </p>
          <ModelGuide />
        </div>
      </nav>
    </aside>
  );
}

function ModelGuide() {
  const [models, setModels] = useState<ModelInfo[]>([]);

  useEffect(() => {
    let active = true;
    listModelDetails()
      .then((m) => {
        if (active) setModels(m);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  if (models.length === 0) return null;

  return (
    <div className="mt-2 space-y-2 px-1">
      {models.map((m) => {
        const profile = getModelProfile(m.name);
        const c = modelColors(m.name);
        return (
          <div
            key={m.name}
            className="rounded-lg border p-2"
            style={{ borderColor: c.border }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 shrink-0 rounded-full"
                style={{ background: c.dot }}
              />
              <span className="break-all text-xs font-semibold">{m.name}</span>
            </div>
            <p
              className="mt-0.5 text-[11px] font-medium"
              style={{ color: c.text }}
            >
              {profile.bestFor}
            </p>
            <ul className="mt-1 space-y-0.5">
              {profile.strengths.map((s) => (
                <li
                  key={s}
                  className="flex items-start gap-1 text-[11px] text-muted-foreground"
                >
                  <Check className="mt-0.5 h-2.5 w-2.5 shrink-0 text-green-600" />
                  {s}
                </li>
              ))}
              {profile.weaknesses.map((w) => (
                <li
                  key={w}
                  className="flex items-start gap-1 text-[11px] text-muted-foreground"
                >
                  <Minus className="mt-0.5 h-2.5 w-2.5 shrink-0 text-amber-600" />
                  {w}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
