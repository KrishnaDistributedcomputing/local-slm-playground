/**
 * Support Ticket Desk - Customer Support automation
 *
 * Every ticket is a durable Temporal `SupportTicketWorkflow` persisted to
 * Supabase. The pipeline (New -> Triaged -> Replied -> Escalated -> Resolved)
 * is driven by signals, an SLA timer nudges stale tickets, and the local Ollama
 * model auto-triages (category / priority / sentiment) and drafts replies.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  Ticket as TicketIcon,
  Sparkles,
  RefreshCw,
  Plus,
  ChevronRight,
  CheckCircle2,
  AlertTriangle,
  StickyNote,
  Mail,
  Tags,
  Square,
  Save,
  LifeBuoy,
  Clock,
} from 'lucide-react';
import {
  listTickets,
  createTicket,
  getTicket,
  advanceTicket,
  resolveTicket,
  escalateTicket,
  addTicketNote,
  pingOps,
  TICKET_STAGES,
  type Ticket,
  type TicketDetail,
} from '@/data/tickets';
import {
  streamChat,
  listModels,
  DEFAULT_MODEL,
  type ChatMessage,
} from '@/data/ollama';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/apps/support')({
  component: SupportDeskApp,
});

const ACCENT = '#0891b2';

const STAGE_COLOR: Record<string, string> = {
  New: '#64748b',
  Triaged: '#0ea5e9',
  Replied: '#8b5cf6',
  Escalated: '#f59e0b',
  Resolved: '#10b981',
};

const PRIORITY_COLOR: Record<string, string> = {
  Low: '#64748b',
  Normal: '#0ea5e9',
  High: '#f59e0b',
  Urgent: '#ef4444',
};

type AiTask = 'triage' | 'reply' | 'summary';

const AI_SYSTEM =
  'You are an expert customer support agent embedded in a help desk. You are ' +
  'concise, empathetic and professional. Never invent facts about the customer ' +
  'or product beyond what you are given.';

function formatDateTime(iso?: string): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function statusBadge(status: string): { label: string; color: string } {
  if (status === 'resolved') return { label: 'Resolved', color: '#10b981' };
  if (status === 'closed') return { label: 'Closed', color: '#ef4444' };
  return { label: 'Open', color: ACCENT };
}

function SupportDeskApp() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TicketDetail | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New ticket form
  const [subject, setSubject] = useState('');
  const [requester, setRequester] = useState('');
  const [channel, setChannel] = useState('Email');
  const [priority, setPriority] = useState('Normal');

  // Notes
  const [noteText, setNoteText] = useState('');

  // AI
  const [models, setModels] = useState<string[]>([]);
  const [model, setModel] = useState(DEFAULT_MODEL);
  const [aiTask, setAiTask] = useState<AiTask | null>(null);
  const [aiOut, setAiOut] = useState('');
  const [aiBusy, setAiBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  async function refreshList() {
    setLoading(true);
    try {
      const rows = await listTickets();
      setTickets(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    try {
      const d = await getTicket(id);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    pingOps().then(setOnline);
    refreshList();
    listModels()
      .then((m) => {
        if (m.length) {
          setModels(m);
          if (!m.includes(model)) setModel(m[0]);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (selectedId) loadDetail(selectedId);
    else setDetail(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  async function handleCreate() {
    if (!subject.trim()) return;
    setBusy(true);
    try {
      const res = await createTicket({
        subject: subject.trim(),
        requester: requester.trim() || undefined,
        channel: channel || undefined,
        priority,
      });
      setSubject('');
      setRequester('');
      await refreshList();
      setSelectedId(res.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(fn: () => Promise<{ state: Ticket }>) {
    if (!selectedId) return;
    setBusy(true);
    try {
      await fn();
      await loadDetail(selectedId);
      await refreshList();
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function handleAddNote() {
    if (!selectedId || !noteText.trim()) return;
    const text = noteText.trim();
    setNoteText('');
    await runAction(() => addTicketNote(selectedId, text));
  }

  function buildPrompt(task: AiTask, t: Ticket): ChatMessage[] {
    const ctx =
      `Ticket subject: ${t.subject}\n` +
      `Requester: ${t.requester || 'unknown'}\n` +
      `Channel: ${t.channel || 'unknown'}\n` +
      `Priority: ${t.priority}\n` +
      `Current stage: ${t.stage}`;
    let user = '';
    if (task === 'triage') {
      user =
        `Triage this support ticket. Respond in 3 short lines exactly:\n` +
        `Category: <one of Billing, Bug, How-to, Feature request, Outage, Other>\n` +
        `Priority: <Low, Normal, High, Urgent>\n` +
        `Sentiment: <Positive, Neutral, Negative, Angry>\n\n${ctx}`;
    } else if (task === 'reply') {
      user =
        `Draft a warm, professional reply to the customer for this ticket. ` +
        `Keep it under 120 words and end with a clear next step.\n\n${ctx}`;
    } else {
      user =
        `Summarize this ticket and its timeline in 2-3 sentences for a handoff.\n\n${ctx}\n\n` +
        `Timeline:\n` +
        (detail?.timeline || [])
          .map((e) => `- ${e.kind}: ${e.detail}`)
          .join('\n');
    }
    return [
      { role: 'system', content: AI_SYSTEM },
      { role: 'user', content: user },
    ];
  }

  async function runAi(task: AiTask) {
    if (!detail) return;
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    setAiTask(task);
    setAiOut('');
    setAiBusy(true);
    try {
      await streamChat(buildPrompt(task, detail.state), {
        model,
        signal: ctrl.signal,
        onToken: (tok) => setAiOut((prev) => prev + tok),
      });
    } catch (e) {
      if (!ctrl.signal.aborted) {
        setAiOut((p) => p + `\n[error: ${e instanceof Error ? e.message : e}]`);
      }
    } finally {
      setAiBusy(false);
    }
  }

  function stopAi() {
    abortRef.current?.abort();
    setAiBusy(false);
  }

  async function saveAiToTimeline() {
    if (!selectedId || !aiOut.trim()) return;
    const text = `[AI ${aiTask}] ${aiOut.trim()}`;
    await runAction(() => addTicketNote(selectedId, text));
  }

  const t = detail?.state;
  const stages = (t?.stages as string[]) || [...TICKET_STAGES];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-white shadow"
            style={{ backgroundColor: ACCENT }}
          >
            <LifeBuoy className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Support Ticket Desk</h1>
            <p className="text-sm text-muted-foreground">
              Durable tickets on Temporal + Supabase, triaged by a local SLM
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'text-xs px-2 py-1 rounded-full',
              online ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700',
            )}
          >
            {online === null ? 'checking…' : online ? 'API online' : 'API offline'}
          </span>
          <Button variant="outline" size="sm" onClick={refreshList} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4 mr-1', loading && 'animate-spin')} />
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6">
        {/* Left: create + list */}
        <div className="space-y-4">
          <Card className="p-4">
            <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
              <Plus className="h-4 w-4" /> New ticket
            </h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Subject</Label>
                <Input
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Can't log in to dashboard"
                />
              </div>
              <div>
                <Label className="text-xs">Requester</Label>
                <Input
                  value={requester}
                  onChange={(e) => setRequester(e.target.value)}
                  placeholder="jane@acme.com"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs">Channel</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={channel}
                    onChange={(e) => setChannel(e.target.value)}
                  >
                    {['Email', 'Chat', 'Phone', 'Web'].map((c) => (
                      <option key={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <select
                    className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                  >
                    {['Low', 'Normal', 'High', 'Urgent'].map((p) => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button
                className="w-full text-white"
                style={{ backgroundColor: ACCENT }}
                onClick={handleCreate}
                disabled={busy || !subject.trim()}
              >
                Open ticket
              </Button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-semibold flex items-center justify-between">
              <span>Tickets</span>
              <span className="text-xs text-muted-foreground">{tickets.length}</span>
            </div>
            <div className="max-h-[460px] overflow-y-auto divide-y">
              {tickets.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No tickets yet. Open one above.
                </div>
              )}
              {tickets.map((row) => {
                const sb = statusBadge(row.status);
                return (
                  <button
                    key={row.id}
                    onClick={() => setSelectedId(row.id)}
                    className={cn(
                      'w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors',
                      selectedId === row.id && 'bg-muted',
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-sm truncate">{row.subject}</span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full text-white shrink-0"
                        style={{ backgroundColor: PRIORITY_COLOR[row.priority] || '#64748b' }}
                      >
                        {row.priority}
                      </span>
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <span className="text-xs text-muted-foreground truncate">
                        {row.requester || 'no requester'}
                      </span>
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          backgroundColor: (STAGE_COLOR[row.stage] || '#64748b') + '22',
                          color: STAGE_COLOR[row.stage] || '#64748b',
                        }}
                      >
                        {row.stage}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right: detail */}
        <div className="space-y-4">
          {!t && (
            <Card className="p-10 text-center text-muted-foreground">
              <TicketIcon className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Select a ticket to see its pipeline, timeline and AI tools.
            </Card>
          )}

          {t && (
            <>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">{t.subject}</h2>
                    <p className="text-sm text-muted-foreground">
                      {t.requester || 'no requester'} · {t.channel || 'unknown'}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className="text-xs px-2 py-1 rounded-full text-white"
                      style={{ backgroundColor: statusBadge(t.status).color }}
                    >
                      {statusBadge(t.status).label}
                    </span>
                  </div>
                </div>

                {/* Pipeline stepper */}
                <div className="flex items-center gap-1 mt-5">
                  {stages.map((s, i) => {
                    const active = i <= (t.stage_index ?? 0);
                    return (
                      <div key={s} className="flex items-center flex-1">
                        <div className="flex flex-col items-center flex-1">
                          <div
                            className="h-2 w-full rounded-full"
                            style={{
                              backgroundColor: active ? STAGE_COLOR[s] || ACCENT : '#e2e8f0',
                            }}
                          />
                          <span
                            className={cn(
                              'text-[10px] mt-1',
                              active ? 'font-medium' : 'text-muted-foreground',
                            )}
                          >
                            {s}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-2 mt-5">
                  <Button
                    size="sm"
                    className="text-white"
                    style={{ backgroundColor: ACCENT }}
                    onClick={() => runAction(() => advanceTicket(t.id))}
                    disabled={busy || t.over}
                  >
                    <ChevronRight className="h-4 w-4 mr-1" /> Advance
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(() => escalateTicket(t.id, 'Escalated from desk'))}
                    disabled={busy || t.over}
                  >
                    <AlertTriangle className="h-4 w-4 mr-1" /> Escalate
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(() => resolveTicket(t.id))}
                    disabled={busy || t.over}
                  >
                    <CheckCircle2 className="h-4 w-4 mr-1" /> Resolve
                  </Button>
                </div>

                {/* Add note */}
                <div className="flex gap-2 mt-4">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an internal note…"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddNote()}
                  />
                  <Button variant="outline" onClick={handleAddNote} disabled={busy || !noteText.trim()}>
                    <StickyNote className="h-4 w-4" />
                  </Button>
                </div>
              </Card>

              {/* AI panel */}
              <Card className="p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold flex items-center gap-2">
                    <Sparkles className="h-4 w-4" style={{ color: ACCENT }} /> AI assist
                  </h3>
                  <select
                    className="h-8 rounded-md border border-input bg-background px-2 text-xs"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                  >
                    {(models.length ? models : [model]).map((m) => (
                      <option key={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => runAi('triage')} disabled={aiBusy}>
                    <Tags className="h-4 w-4 mr-1" /> Auto-triage
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAi('reply')} disabled={aiBusy}>
                    <Mail className="h-4 w-4 mr-1" /> Draft reply
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAi('summary')} disabled={aiBusy}>
                    <StickyNote className="h-4 w-4 mr-1" /> Summarize
                  </Button>
                  {aiBusy && (
                    <Button size="sm" variant="ghost" onClick={stopAi}>
                      <Square className="h-4 w-4 mr-1" /> Stop
                    </Button>
                  )}
                </div>
                {(aiOut || aiBusy) && (
                  <div className="mt-3">
                    <Textarea
                      value={aiOut}
                      onChange={(e) => setAiOut(e.target.value)}
                      className="min-h-[140px] text-sm font-mono"
                      placeholder="AI output…"
                    />
                    <div className="flex justify-end mt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={saveAiToTimeline}
                        disabled={busy || !aiOut.trim()}
                      >
                        <Save className="h-4 w-4 mr-1" /> Save to timeline
                      </Button>
                    </div>
                  </div>
                )}
              </Card>

              {/* Timeline */}
              <Card className="p-5">
                <h3 className="text-sm font-semibold flex items-center gap-2 mb-3">
                  <Clock className="h-4 w-4" /> Timeline
                </h3>
                <div className="space-y-3">
                  {(detail?.timeline || []).length === 0 && (
                    <p className="text-sm text-muted-foreground">No events yet.</p>
                  )}
                  {(detail?.timeline || []).map((e, i) => (
                    <div key={i} className="flex gap-3">
                      <div
                        className="h-2 w-2 rounded-full mt-1.5 shrink-0"
                        style={{ backgroundColor: ACCENT }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm">
                          <span className="font-medium capitalize">{e.kind}</span>
                          {e.detail && <span className="text-muted-foreground"> — {e.detail}</span>}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatDateTime(e.created_at || e.at)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
