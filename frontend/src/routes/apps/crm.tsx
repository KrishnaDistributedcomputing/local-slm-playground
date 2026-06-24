/**
 * CRM App - Sales Force Automation
 *
 * A sales pipeline backed by Temporal (each lead is a durable
 * `CrmLeadWorkflow`) and Supabase, with the local Ollama language model layered
 * on top for sales automation: drafting outreach, suggesting the next best
 * action, summarizing the activity timeline and qualifying leads.
 *
 * - Pipeline actions (advance / win / disqualify / note) are Temporal signals.
 * - AI output can be saved straight back to the lead's durable timeline.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  Briefcase,
  Sparkles,
  RefreshCw,
  Plus,
  ChevronRight,
  Trophy,
  XCircle,
  StickyNote,
  Mail,
  Lightbulb,
  ScrollText,
  Gauge,
  Save,
  Square,
  Building2,
  CircleUser,
} from 'lucide-react';
import {
  listContacts,
  createContact,
  getContact,
  advanceContact,
  winContact,
  disqualifyContact,
  addContactNote,
  pingCrm,
  CRM_STAGES,
  type CrmContact,
  type CrmDetail,
} from '@/data/crm';
import { streamChat, listModels, DEFAULT_MODEL } from '@/data/ollama';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/apps/crm')({
  component: CrmApp,
});

const ACCENT = '#2563eb';

const STAGE_COLOR: Record<string, string> = {
  New: '#64748b',
  Contacted: '#0ea5e9',
  Qualified: '#8b5cf6',
  Proposal: '#f59e0b',
  Won: '#10b981',
};

type AiTask = 'email' | 'action' | 'summary' | 'qualify';

const AI_SYSTEM =
  'You are an expert B2B sales assistant embedded in a CRM. You help sales reps ' +
  'move deals forward. Be concise, practical and professional. Never invent facts ' +
  'about the customer beyond what you are given.';

function money(value: number): string {
  if (!value) return '$0';
  return `$${value.toLocaleString()}`;
}

function statusBadge(status: string): { label: string; color: string } {
  if (status === 'won') return { label: 'Won', color: '#10b981' };
  if (status === 'lost') return { label: 'Lost', color: '#ef4444' };
  return { label: 'Active', color: '#2563eb' };
}

function leadContext(d: CrmDetail): string {
  const s = d.state;
  const timeline = (d.timeline ?? [])
    .slice(0, 12)
    .map((t) => `- [${t.kind}] ${t.detail}`)
    .join('\n');
  return [
    `Name: ${s.name}`,
    `Company: ${s.company || '—'}`,
    `Email: ${s.email || '—'}`,
    `Owner (sales rep): ${s.owner || '—'}`,
    `Deal value: ${money(s.value)}`,
    `Pipeline stage: ${s.stage}`,
    `Status: ${s.status}`,
    timeline ? `\nRecent activity:\n${timeline}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildAiPrompt(task: AiTask, d: CrmDetail): string {
  const ctx = leadContext(d);
  switch (task) {
    case 'email':
      return (
        `Write a short, friendly but professional outreach email to move this ` +
        `deal to the next stage. Include a subject line. Keep it under 150 words.\n\n${ctx}`
      );
    case 'action':
      return (
        `Based on the deal state and recent activity, recommend the single best ` +
        `next action for the sales rep, then list 2-3 concrete follow-up steps.\n\n${ctx}`
      );
    case 'summary':
      return (
        `Summarize the current state of this deal for a sales manager in 3-4 ` +
        `bullet points: where it stands, risks, and what's needed to close.\n\n${ctx}`
      );
    case 'qualify':
      return (
        `Qualify this lead using BANT (Budget, Authority, Need, Timeline). For each, ` +
        `state what we know, what's missing, and give an overall qualification ` +
        `verdict (Hot / Warm / Cold).\n\n${ctx}`
      );
  }
}

const AI_TASKS: {
  id: AiTask;
  label: string;
  icon: typeof Mail;
}[] = [
  { id: 'email', label: 'Draft outreach email', icon: Mail },
  { id: 'action', label: 'Next best action', icon: Lightbulb },
  { id: 'summary', label: 'Summarize deal', icon: ScrollText },
  { id: 'qualify', label: 'Qualify (BANT)', icon: Gauge },
];

function CrmApp() {
  const [online, setOnline] = useState<boolean | null>(null);
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CrmDetail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New-lead form
  const [form, setForm] = useState({
    name: '',
    company: '',
    email: '',
    value: '',
    owner: '',
  });

  // Notes + AI
  const [noteText, setNoteText] = useState('');
  const [model, setModel] = useState<string>(DEFAULT_MODEL);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [aiOutput, setAiOutput] = useState('');
  const [aiTask, setAiTask] = useState<AiTask | null>(null);
  const [aiStreaming, setAiStreaming] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function refresh() {
    const up = await pingCrm();
    setOnline(up);
    if (!up) return;
    try {
      const rows = await listContacts();
      setContacts(rows);
      if (!selectedId && rows.length) selectLead(rows[0].id);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  useEffect(() => {
    refresh();
    listModels().then((m) => {
      if (m.length) setAvailableModels(m);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function selectLead(id: string) {
    setSelectedId(id);
    setAiOutput('');
    setAiTask(null);
    try {
      const d = await getContact(id);
      setDetail(d);
    } catch (e) {
      setError((e as Error).message);
    }
  }

  async function reloadDetail(id: string) {
    try {
      const d = await getContact(id);
      setDetail(d);
      setContacts((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ...d.state } : c)),
      );
    } catch {
      /* ignore */
    }
  }

  async function onCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await createContact({
        name: form.name.trim(),
        company: form.company.trim() || undefined,
        email: form.email.trim() || undefined,
        owner: form.owner.trim() || undefined,
        value: form.value ? Number(form.value) : 0,
      });
      setForm({ name: '', company: '', email: '', value: '', owner: '' });
      await refresh();
      await selectLead(res.id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function runAction(
    fn: () => Promise<unknown>,
  ): Promise<void> {
    if (!selectedId || busy) return;
    setBusy(true);
    setError(null);
    try {
      await fn();
      await reloadDetail(selectedId);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function onAddNote() {
    if (!selectedId || !noteText.trim()) return;
    const text = noteText.trim();
    setNoteText('');
    await runAction(() => addContactNote(selectedId, text));
  }

  function stopAi() {
    abortRef.current?.abort();
    setAiStreaming(false);
  }

  async function runAi(task: AiTask) {
    if (!detail || aiStreaming) return;
    setAiTask(task);
    setAiOutput('');
    setAiStreaming(true);
    setError(null);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      await streamChat(
        [
          { role: 'system', content: AI_SYSTEM },
          { role: 'user', content: buildAiPrompt(task, detail) },
        ],
        {
          model,
          signal: controller.signal,
          onToken: (t) => setAiOutput((prev) => prev + t),
        },
      );
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setError((e as Error).message);
    } finally {
      setAiStreaming(false);
      abortRef.current = null;
    }
  }

  async function saveAiAsNote() {
    if (!selectedId || !aiOutput.trim()) return;
    const label = AI_TASKS.find((t) => t.id === aiTask)?.label ?? 'AI note';
    await runAction(() =>
      addContactNote(selectedId, `[AI · ${label}] ${aiOutput.trim()}`),
    );
  }

  const s = detail?.state;
  const stageIdx = s ? CRM_STAGES.indexOf(s.stage as never) : -1;
  const terminal = s?.status === 'won' || s?.status === 'lost';

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Hero */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-1">
          <h2 className="flex items-center gap-2 text-3xl font-bold">
            <span
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white"
              style={{ backgroundColor: ACCENT }}
            >
              <Briefcase className="h-5 w-5" />
            </span>
            Sales Force Automation CRM
          </h2>
          <p className="max-w-2xl text-muted-foreground">
            A durable sales pipeline powered by{' '}
            <strong>Temporal</strong> workflows and{' '}
            <strong>Supabase</strong>, with a local{' '}
            <strong>language model</strong> for drafting outreach, next-best
            actions, deal summaries and lead qualification.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm"
            title="Language model"
          >
            {(availableModels.length ? availableModels : [DEFAULT_MODEL]).map(
              (m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ),
            )}
          </select>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {online === false && (
        <Card className="space-y-2 border-destructive/40 bg-destructive/5 p-5">
          <p className="font-medium text-destructive">
            Can&apos;t reach the CRM service.
          </p>
          <p className="text-sm text-muted-foreground">
            Start the Temporal-backed CRM stack, then click Refresh:
          </p>
          <pre className="overflow-x-auto rounded-md bg-muted px-3 py-2 text-sm">
            docker compose up -d temporal temporal-worker crm-web
          </pre>
        </Card>
      )}

      {error && (
        <Card className="border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
          {error}
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        {/* Left: create + pipeline list */}
        <div className="space-y-4">
          <Card className="space-y-3 p-4">
            <h3 className="flex items-center gap-2 text-sm font-semibold">
              <Plus className="h-4 w-4" style={{ color: ACCENT }} />
              New lead
            </h3>
            <form onSubmit={onCreate} className="space-y-2">
              <div className="space-y-1">
                <Label className="text-xs">Name *</Label>
                <Input
                  value={form.name}
                  onChange={(e) =>
                    setForm({ ...form, name: e.target.value })
                  }
                  placeholder="Jane Doe"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-xs">Company</Label>
                  <Input
                    value={form.company}
                    onChange={(e) =>
                      setForm({ ...form, company: e.target.value })
                    }
                    placeholder="Acme Inc"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Deal value</Label>
                  <Input
                    type="number"
                    value={form.value}
                    onChange={(e) =>
                      setForm({ ...form, value: e.target.value })
                    }
                    placeholder="5000"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) =>
                    setForm({ ...form, email: e.target.value })
                  }
                  placeholder="jane@acme.com"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Owner (rep)</Label>
                <Input
                  value={form.owner}
                  onChange={(e) =>
                    setForm({ ...form, owner: e.target.value })
                  }
                  placeholder="You"
                />
              </div>
              <Button
                type="submit"
                disabled={!form.name.trim() || busy}
                className="w-full text-white"
                style={{ backgroundColor: ACCENT }}
              >
                <Plus className="h-4 w-4" />
                Add to pipeline
              </Button>
            </form>
          </Card>

          <Card className="p-2">
            <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">
              Pipeline · {contacts.length}
            </div>
            <div className="max-h-[420px] space-y-1 overflow-y-auto">
              {contacts.length === 0 && (
                <p className="px-2 py-4 text-center text-sm text-muted-foreground">
                  No leads yet. Add one to start the workflow.
                </p>
              )}
              {contacts.map((c) => {
                const stColor = STAGE_COLOR[c.stage] ?? '#64748b';
                const active = c.id === selectedId;
                return (
                  <button
                    key={c.id}
                    onClick={() => selectLead(c.id)}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors',
                      active ? 'bg-muted' : 'hover:bg-muted/60',
                    )}
                  >
                    <span
                      className="h-8 w-1 shrink-0 rounded-full"
                      style={{ backgroundColor: stColor }}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-medium">
                        {c.name}
                      </div>
                      <div className="truncate text-xs text-muted-foreground">
                        {c.company || '—'} · {money(c.value)}
                      </div>
                    </div>
                    <span
                      className="shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-medium"
                      style={{
                        color: stColor,
                        backgroundColor: `color-mix(in srgb, ${stColor} 14%, transparent)`,
                      }}
                    >
                      {c.status === 'active' ? c.stage : c.status}
                    </span>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: lead detail + AI */}
        {!s ? (
          <Card className="flex min-h-[300px] items-center justify-center p-6 text-muted-foreground">
            Select a lead to view the deal and AI assistant.
          </Card>
        ) : (
          <div className="space-y-4">
            {/* Lead header */}
            <Card className="space-y-4 p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1">
                  <h3 className="text-xl font-semibold">{s.name}</h3>
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1.5">
                      <Building2 className="h-3.5 w-3.5" />
                      {s.company || '—'}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <CircleUser className="h-3.5 w-3.5" />
                      {s.owner || '—'}
                    </span>
                    <span className="font-medium text-foreground">
                      {money(s.value)}
                    </span>
                  </div>
                </div>
                <span
                  className="rounded-full px-2.5 py-1 text-xs font-semibold"
                  style={{
                    color: statusBadge(s.status).color,
                    backgroundColor: `color-mix(in srgb, ${statusBadge(s.status).color} 14%, transparent)`,
                  }}
                >
                  {statusBadge(s.status).label}
                </span>
              </div>

              {/* Pipeline progress */}
              <div className="flex items-center gap-1">
                {CRM_STAGES.map((stage, i) => {
                  const reached = stageIdx >= i && s.status !== 'lost';
                  const color = STAGE_COLOR[stage];
                  return (
                    <div key={stage} className="flex flex-1 flex-col gap-1">
                      <div
                        className="h-1.5 rounded-full"
                        style={{
                          backgroundColor: reached
                            ? color
                            : 'color-mix(in srgb, var(--foreground) 12%, transparent)',
                        }}
                      />
                      <span
                        className={cn(
                          'text-[10px]',
                          stageIdx === i
                            ? 'font-semibold'
                            : 'text-muted-foreground',
                        )}
                        style={stageIdx === i ? { color } : undefined}
                      >
                        {stage}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Pipeline actions (Temporal signals) */}
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  onClick={() =>
                    runAction(() => advanceContact(selectedId!))
                  }
                  disabled={busy || terminal}
                  style={{ backgroundColor: ACCENT }}
                  className="text-white"
                >
                  <ChevronRight className="h-4 w-4" />
                  Advance stage
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => runAction(() => winContact(selectedId!))}
                  disabled={busy || terminal}
                >
                  <Trophy className="h-4 w-4 text-emerald-500" />
                  Mark won
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    runAction(() => disqualifyContact(selectedId!, ''))
                  }
                  disabled={busy || terminal}
                >
                  <XCircle className="h-4 w-4 text-red-500" />
                  Disqualify
                </Button>
              </div>
            </Card>

            {/* AI assistant */}
            <Card className="space-y-3 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4" style={{ color: ACCENT }} />
                AI sales assistant
                <span className="text-xs font-normal text-muted-foreground">
                  · {model}
                </span>
              </h3>
              <div className="flex flex-wrap gap-2">
                {AI_TASKS.map((t) => (
                  <Button
                    key={t.id}
                    size="sm"
                    variant={aiTask === t.id ? 'default' : 'outline'}
                    onClick={() => runAi(t.id)}
                    disabled={aiStreaming}
                    style={
                      aiTask === t.id
                        ? { backgroundColor: ACCENT }
                        : undefined
                    }
                    className={aiTask === t.id ? 'text-white' : undefined}
                  >
                    <t.icon className="h-4 w-4" />
                    {t.label}
                  </Button>
                ))}
                {aiStreaming && (
                  <Button size="sm" variant="ghost" onClick={stopAi}>
                    <Square className="h-4 w-4" />
                    Stop
                  </Button>
                )}
              </div>

              {(aiOutput || aiStreaming) && (
                <div className="space-y-2">
                  <div className="whitespace-pre-wrap break-words rounded-xl bg-muted/40 p-4 text-sm leading-relaxed ring-1 ring-inset ring-border/40">
                    {aiOutput}
                    {aiStreaming && (
                      <span
                        className="ml-0.5 inline-block animate-pulse"
                        style={{ color: ACCENT }}
                      >
                        ▍
                      </span>
                    )}
                  </div>
                  {aiOutput && !aiStreaming && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={saveAiAsNote}
                      disabled={busy}
                    >
                      <Save className="h-4 w-4" />
                      Save to timeline
                    </Button>
                  )}
                </div>
              )}
            </Card>

            {/* Add note */}
            <Card className="space-y-2 p-5">
              <h3 className="flex items-center gap-2 text-sm font-semibold">
                <StickyNote className="h-4 w-4" style={{ color: ACCENT }} />
                Log activity
              </h3>
              <Textarea
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder="Add a call note, email recap, next step…"
                className="min-h-[72px]"
              />
              <Button
                size="sm"
                onClick={onAddNote}
                disabled={!noteText.trim() || busy}
                style={{ backgroundColor: ACCENT }}
                className="text-white"
              >
                <Plus className="h-4 w-4" />
                Add note
              </Button>
            </Card>

            {/* Timeline */}
            <Card className="space-y-3 p-5">
              <h3 className="text-sm font-semibold">Activity timeline</h3>
              <ol className="space-y-2">
                {(detail?.timeline ?? []).length === 0 && (
                  <li className="text-sm text-muted-foreground">
                    No activity yet.
                  </li>
                )}
                {(detail?.timeline ?? []).map((t, i) => (
                  <li key={i} className="flex gap-3 text-sm">
                    <span
                      className="mt-0.5 h-fit shrink-0 rounded-full px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
                      style={{
                        color: ACCENT,
                        backgroundColor: `color-mix(in srgb, ${ACCENT} 12%, transparent)`,
                      }}
                    >
                      {t.kind}
                    </span>
                    <span className="break-words text-muted-foreground">
                      {t.detail}
                    </span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}
