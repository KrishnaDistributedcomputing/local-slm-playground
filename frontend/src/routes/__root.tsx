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
  Briefcase,
  Activity,
  ClipboardList,
  LifeBuoy,
  UserPlus,
  UserSearch,
  Megaphone,
  Scale,
  TrendingUp,
  Star,
  ExternalLink,
  BookOpen,
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
import { getModelBrand } from '@/data/modelBrands';
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
        <main className="min-w-0 flex-1 p-6">
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
    <header className="sticky top-0 z-30 h-16 border-b bg-gradient-to-r from-indigo-50 via-card to-violet-50 flex items-center justify-between px-6">
      <h1 className="flex items-center gap-2 text-xl font-bold">
        <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-sm">
          <Sparkles className="h-4 w-4" />
        </span>
        <span className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent">
          Local Models Playground
        </span>
      </h1>
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
  return (
    <aside className="sticky top-16 h-[calc(100vh-4rem)] w-64 shrink-0 overflow-y-auto border-r bg-card">
      <nav className="p-4 space-y-1.5">
        {PRIMARY_NAV.map((item) => (
          <NavItem key={item.to} {...item} />
        ))}

        <ExternalNavItem
          href="https://github.com/KrishnaDistributedcomputing/local-slm-playground/tree/main/docs"
          label="Documentation"
          icon={BookOpen}
          color="#64748b"
        />

        <div className="pt-4">
          <h3 className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Apps
          </h3>
          <div className="mt-2 space-y-1">
            {APP_NAV.map((item) => (
              <NavItem key={item.to} {...item} />
            ))}
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

interface NavLink {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const PRIMARY_NAV: NavLink[] = [
  { to: '/', label: 'Models', icon: Home, color: '#6366f1' },
  { to: '/chat', label: 'AI Chat', icon: Sparkles, color: '#8b5cf6' },
];

const APP_NAV: NavLink[] = [
  { to: '/apps/crm', label: 'CRM (Sales)', icon: Briefcase, color: '#2563eb' },
  { to: '/apps/monitor', label: 'Monitoring', icon: Activity, color: '#16a34a' },
  { to: '/apps/summarizer', label: 'Summarizer', icon: FileText, color: '#0ea5e9' },
  { to: '/apps/translator', label: 'Translator', icon: Languages, color: '#10b981' },
  { to: '/apps/code-reviewer', label: 'Code Reviewer', icon: Code2, color: '#f59e0b' },
  { to: '/apps/extractor', label: 'Data Extractor', icon: Braces, color: '#f43f5e' },
  { to: '/apps/email-writer', label: 'Email Writer', icon: Mail, color: '#3b82f6' },
  { to: '/apps/proofreader', label: 'Proofreader', icon: SpellCheck, color: '#14b8a6' },
  { to: '/apps/rewriter', label: 'Tone Rewriter', icon: Wand2, color: '#d946ef' },
  { to: '/apps/brainstorm', label: 'Brainstormer', icon: Lightbulb, color: '#eab308' },
  { to: '/apps/explain', label: 'Explainer', icon: GraduationCap, color: '#06b6d4' },
  { to: '/apps/sql', label: 'SQL Generator', icon: Database, color: '#f97316' },
  { to: '/apps/json-builder', label: 'JSON Builder', icon: FileJson, color: '#84cc16' },
  { to: '/apps/azure-architecture', label: 'Azure Architecture', icon: CloudCog, color: '#0078d4' },
  { to: '/apps/predikt', label: 'Predikt', icon: CircleDollarSign, color: '#1652F0' },
  { to: '/apps/verdict', label: 'Verdict Markets', icon: CandlestickChart, color: '#00D09C' },
  { to: '/apps/meeting-notes', label: 'Meeting Assistant', icon: ClipboardList, color: '#4f46e5' },
  { to: '/apps/support-reply', label: 'Support Reply', icon: LifeBuoy, color: '#0891b2' },
  { to: '/apps/job-description', label: 'Job Description', icon: UserPlus, color: '#7c3aed' },
  { to: '/apps/resume-screener', label: 'Resume Screener', icon: UserSearch, color: '#9333ea' },
  { to: '/apps/ad-copy', label: 'Ad Copy', icon: Megaphone, color: '#ec4899' },
  { to: '/apps/contract-analyzer', label: 'Contract Analyzer', icon: Scale, color: '#b45309' },
  { to: '/apps/finance-summary', label: 'Finance Summary', icon: TrendingUp, color: '#059669' },
  { to: '/apps/review-analyzer', label: 'Review Analyzer', icon: Star, color: '#ca8a04' },
];

function NavItem({ to, label, icon: Icon, color }: NavLink) {
  const location = useLocation();
  const active = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        'group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium transition-all',
        active ? 'shadow-sm ring-1' : 'text-foreground/80 hover:bg-muted hover:text-foreground',
      )}
      style={
        active
          ? {
              backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
              color,
              boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 30%, transparent)`,
            }
          : undefined
      }
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
          color,
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      {label}
    </Link>
  );
}

function ExternalNavItem({
  href,
  label,
  icon: Icon,
  color,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="group flex items-center gap-3 rounded-xl px-2.5 py-2 text-sm font-medium text-foreground/80 transition-all hover:bg-muted hover:text-foreground"
    >
      <span
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg transition-transform duration-200 group-hover:scale-110"
        style={{
          backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
          color,
        }}
      >
        <Icon className="h-4 w-4" />
      </span>
      {label}
      <ExternalLink className="ml-auto h-3.5 w-3.5 text-muted-foreground" />
    </a>
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
        const brand = getModelBrand(m.name);
        const c = modelColors(m.name);
        return (
          <div
            key={m.name}
            className="rounded-lg border p-2"
            style={{ borderColor: c.border }}
          >
            <div className="flex items-center gap-1.5">
              <span
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-xs"
                style={{
                  backgroundColor: `color-mix(in srgb, ${c.dot} 16%, transparent)`,
                }}
                aria-hidden
              >
                {brand.logo}
              </span>
              <span className="break-all text-xs font-semibold">{m.name}</span>
              <a
                href={brand.url}
                target="_blank"
                rel="noreferrer"
                title={`View ${m.name} on Ollama`}
                className="ml-auto text-muted-foreground hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" />
              </a>
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
