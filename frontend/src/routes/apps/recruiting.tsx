/**
 * Recruiting Pipeline (ATS) - hiring automation
 *
 * Every candidate is a durable Temporal `RecruitCandidateWorkflow` persisted to
 * Supabase. The pipeline (Applied -> Screened -> Interview -> Offer -> Hired)
 * is driven by signals, a follow-up timer nudges stale candidates, and the
 * local Ollama model scores resumes and generates interview questions.
 */

import { createFileRoute } from '@tanstack/react-router';
import { useEffect, useRef, useState } from 'react';
import {
  Users,
  Sparkles,
  RefreshCw,
  Plus,
  ChevronRight,
  Trophy,
  XCircle,
  StickyNote,
  ClipboardCheck,
  MessageSquareQuote,
  FileSearch,
  Square,
  Save,
  Clock,
} from 'lucide-react';
import {
  listCandidates,
  createCandidate,
  getCandidate,
  advanceCandidate,
  hireCandidate,
  rejectCandidate,
  addCandidateNote,
  pingRecruiting,
  CANDIDATE_STAGES,
  type Candidate,
  type CandidateDetail,
} from '@/data/recruiting';
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

export const Route = createFileRoute('/apps/recruiting')({
  component: RecruitingApp,
});

const ACCENT = '#7c3aed';

const STAGE_COLOR: Record<string, string> = {
  Applied: '#64748b',
  Screened: '#0ea5e9',
  Interview: '#8b5cf6',
  Offer: '#f59e0b',
  Hired: '#10b981',
};

type AiTask = 'score' | 'questions' | 'summary';

const AI_SYSTEM =
  'You are an expert technical recruiter embedded in an applicant tracking ' +
  'system. You are concise, fair and structured. Never invent facts about the ' +
  'candidate beyond what you are given.';

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
  if (status === 'hired') return { label: 'Hired', color: '#10b981' };
  if (status === 'rejected') return { label: 'Rejected', color: '#ef4444' };
  return { label: 'Active', color: ACCENT };
}

function RecruitingApp() {
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CandidateDetail | null>(null);
  const [online, setOnline] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // New candidate form
  const [name, setName] = useState('');
  const [role, setRole] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState('LinkedIn');

  // Resume text for AI scoring
  const [resume, setResume] = useState('');
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
      const rows = await listCandidates();
      setCandidates(rows);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadDetail(id: string) {
    try {
      const d = await getCandidate(id);
      setDetail(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }

  useEffect(() => {
    pingRecruiting().then(setOnline);
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
    if (!name.trim()) return;
    setBusy(true);
    try {
      const res = await createCandidate({
        name: name.trim(),
        role: role.trim() || undefined,
        email: email.trim() || undefined,
        source: source || undefined,
      });
      setName('');
      setRole('');
      setEmail('');
      await refreshList();
      setSelectedId(res.id);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function runAction(fn: () => Promise<{ state: Candidate }>) {
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
    await runAction(() => addCandidateNote(selectedId, text));
  }

  function buildPrompt(task: AiTask, c: Candidate): ChatMessage[] {
    const ctx =
      `Candidate: ${c.name}\n` +
      `Role: ${c.role || 'unspecified'}\n` +
      `Source: ${c.source || 'unknown'}\n` +
      `Current stage: ${c.stage}`;
    let user = '';
    if (task === 'score') {
      user =
        `Score this candidate's fit for the role from 1-10 and justify briefly. ` +
        `Respond as:\nScore: <n>/10\nStrengths: <...>\nGaps: <...>\n\n${ctx}\n\n` +
        `Resume / notes:\n${resume || '(no resume pasted)'}`;
    } else if (task === 'questions') {
      user =
        `Generate 5 focused interview questions for this candidate and role. ` +
        `Number them 1-5.\n\n${ctx}`;
    } else {
      user =
        `Summarize this candidate and timeline in 2-3 sentences for a hiring ` +
        `manager.\n\n${ctx}\n\nTimeline:\n` +
        (detail?.timeline || []).map((e) => `- ${e.kind}: ${e.detail}`).join('\n');
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
    await runAction(() => addCandidateNote(selectedId, text));
  }

  const c = detail?.state;
  const stages = (c?.stages as string[]) || [...CANDIDATE_STAGES];

  return (
    <div className="p-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="h-11 w-11 rounded-xl flex items-center justify-center text-white shadow"
            style={{ backgroundColor: ACCENT }}
          >
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold leading-tight">Recruiting Pipeline</h1>
            <p className="text-sm text-muted-foreground">
              Durable candidates on Temporal + Supabase, scored by a local SLM
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
              <Plus className="h-4 w-4" /> New candidate
            </h2>
            <div className="space-y-3">
              <div>
                <Label className="text-xs">Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div>
                <Label className="text-xs">Role</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Senior Backend Engineer"
                />
              </div>
              <div>
                <Label className="text-xs">Email</Label>
                <Input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="jane@example.com"
                />
              </div>
              <div>
                <Label className="text-xs">Source</Label>
                <select
                  className="w-full h-9 rounded-md border border-input bg-background px-2 text-sm"
                  value={source}
                  onChange={(e) => setSource(e.target.value)}
                >
                  {['LinkedIn', 'Referral', 'Job board', 'Career site', 'Agency'].map((s) => (
                    <option key={s}>{s}</option>
                  ))}
                </select>
              </div>
              <Button
                className="w-full text-white"
                style={{ backgroundColor: ACCENT }}
                onClick={handleCreate}
                disabled={busy || !name.trim()}
              >
                Add candidate
              </Button>
            </div>
          </Card>

          <Card className="p-0 overflow-hidden">
            <div className="px-4 py-3 border-b text-sm font-semibold flex items-center justify-between">
              <span>Candidates</span>
              <span className="text-xs text-muted-foreground">{candidates.length}</span>
            </div>
            <div className="max-h-[460px] overflow-y-auto divide-y">
              {candidates.length === 0 && (
                <div className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No candidates yet. Add one above.
                </div>
              )}
              {candidates.map((row) => (
                <button
                  key={row.id}
                  onClick={() => setSelectedId(row.id)}
                  className={cn(
                    'w-full text-left px-4 py-3 hover:bg-muted/60 transition-colors',
                    selectedId === row.id && 'bg-muted',
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-medium text-sm truncate">{row.name}</span>
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
                  <div className="text-xs text-muted-foreground truncate mt-1">
                    {row.role || 'role TBD'} · {row.source || 'unknown'}
                  </div>
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Right: detail */}
        <div className="space-y-4">
          {!c && (
            <Card className="p-10 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
              Select a candidate to see their pipeline, timeline and AI tools.
            </Card>
          )}

          {c && (
            <>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold">{c.name}</h2>
                    <p className="text-sm text-muted-foreground">
                      {c.role || 'role TBD'} · {c.email || 'no email'} · {c.source || 'unknown'}
                    </p>
                  </div>
                  <span
                    className="text-xs px-2 py-1 rounded-full text-white"
                    style={{ backgroundColor: statusBadge(c.status).color }}
                  >
                    {statusBadge(c.status).label}
                  </span>
                </div>

                {/* Pipeline stepper */}
                <div className="flex items-center gap-1 mt-5">
                  {stages.map((s, i) => {
                    const active = i <= (c.stage_index ?? 0);
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
                    onClick={() => runAction(() => advanceCandidate(c.id))}
                    disabled={busy || c.over}
                  >
                    <ChevronRight className="h-4 w-4 mr-1" /> Advance
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(() => hireCandidate(c.id))}
                    disabled={busy || c.over}
                  >
                    <Trophy className="h-4 w-4 mr-1" /> Hire
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => runAction(() => rejectCandidate(c.id, 'Not a fit'))}
                    disabled={busy || c.over}
                  >
                    <XCircle className="h-4 w-4 mr-1" /> Reject
                  </Button>
                </div>

                {/* Add note */}
                <div className="flex gap-2 mt-4">
                  <Input
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Add an interview note…"
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
                <Textarea
                  value={resume}
                  onChange={(e) => setResume(e.target.value)}
                  className="min-h-[80px] text-sm mb-3"
                  placeholder="Paste resume / notes here for AI scoring…"
                />
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="outline" onClick={() => runAi('score')} disabled={aiBusy}>
                    <FileSearch className="h-4 w-4 mr-1" /> Score resume
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAi('questions')} disabled={aiBusy}>
                    <MessageSquareQuote className="h-4 w-4 mr-1" /> Interview questions
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => runAi('summary')} disabled={aiBusy}>
                    <ClipboardCheck className="h-4 w-4 mr-1" /> Summarize
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
