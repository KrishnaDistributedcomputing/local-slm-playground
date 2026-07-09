import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import { ArrowLeft, BarChart3, BellRing, CheckCircle2, ChevronDown, Download, Mail, MessageSquareText, Send, Smartphone } from 'lucide-react';
import { criticalAzureEvents, type AlertMessage } from '@/data/azureNotificationEvents';
import {
  benchmarkModels,
  buildBenchmarkPrompt,
  defaultBenchmarkParams,
  modelProviders,
  runModelBenchmark,
  type BenchmarkResult,
  type BenchmarkRun,
  type BenchmarkParams,
} from '@/data/modelBenchmark';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/apps/notifications_/$eventId')({
  component: NotificationEventDetail,
});

const BENCHMARK_STORAGE_KEY = 'notify-hub-model-benchmark-runs';

function NotificationEventDetail() {
  const { eventId } = Route.useParams();
  const event = criticalAzureEvents.find((item) => item.id === eventId);
  const [notificationModelId, setNotificationModelId] = useState('ollama-qwen25-05b');

  if (!event) {
    return (
      <div className="mx-auto max-w-3xl rounded-2xl border bg-white p-6 shadow-sm">
        <Link to="/apps/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900">
          <ArrowLeft className="h-4 w-4" /> Back to notification portal
        </Link>
        <h2 className="mt-6 text-3xl font-semibold text-slate-950">Alert not found</h2>
        <p className="mt-2 text-sm leading-6 text-slate-600">The selected Azure Monitor alert is no longer available in the demo catalog.</p>
      </div>
    );
  }

  const Icon = event.icon;
  const notificationModel = benchmarkModels.find((model) => model.id === notificationModelId) ?? benchmarkModels[0];
  const messageVariations = buildModelAwareMessages(event, notificationModelId);

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <Link to="/apps/notifications" className="inline-flex items-center gap-2 text-sm font-semibold text-sky-700 hover:text-sky-900">
        <ArrowLeft className="h-4 w-4" /> Back to notification portal
      </Link>

      <section className="overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1fr_0.75fr] lg:p-8">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-red-300/30 bg-red-300/10 px-3 py-1 text-sm text-red-100">
              <Icon className="h-4 w-4" /> Azure Monitor alert detail
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-tight md:text-4xl">{event.title}</h2>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">{event.impact}</p>
            <div className="mt-5 grid gap-3 sm:grid-cols-4">
              <DarkMetric label="Severity" value={event.severity} />
              <DarkMetric label="Service" value={event.service} />
              <DarkMetric label="Region" value={event.region} />
              <DarkMetric label="Detected" value={event.time} />
            </div>
          </div>
          <div className="rounded-2xl border border-white/10 bg-white/10 p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Monitor signal</p>
            <p className="mt-2 text-sm leading-6 text-slate-100">{event.signal}</p>
            <div className="mt-4 rounded-xl bg-slate-950/60 p-3 text-xs leading-5 text-slate-300 ring-1 ring-white/10">
              {event.payload}
            </div>
          </div>
        </div>
      </section>

      <ModelBenchmarkPanel event={event} primaryModelId={notificationModelId} onPrimaryModelChange={setNotificationModelId} />

      <section className="rounded-2xl border bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">All message variations</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950">Review every notification version for this alert</h3>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Each message targets a different audience and channel. The selected AI model changes the tone, depth, and action detail used across the generated notification set.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={notificationModelId} onChange={(event) => setNotificationModelId(event.target.value)} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-700">
              {benchmarkModels.map((model) => (
                <option key={model.id} value={model.id}>{model.name}</option>
              ))}
            </select>
            <div className="rounded-full bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
              {messageVariations.length} variations · {notificationModel.name}
            </div>
          </div>
        </div>
        <div className="mt-5 grid gap-4 lg:grid-cols-3">
          {messageVariations.map((message) => (
            <AlertMessageCard key={`${message.channel}-${message.subject}`} message={message} />
          ))}
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-2xl border bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Delivery choices</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-950">Channel fit</h3>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Tone: {notificationModel.name}</span>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {messageVariations.map((message) => (
              <div key={`${message.channel}-${message.subject}`} className="flex gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-sky-700">
                  <MessageIcon channel={message.channel} />
                </span>
                <div>
                  <div className="font-semibold text-slate-950">{message.channel}</div>
                  <div className="mt-0.5 text-sm leading-5 text-slate-600">{baseMessageStyle(message.style)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-slate-950 p-5 text-white shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Review checklist</p>
          <h3 className="mt-1 text-2xl font-semibold">Before sending</h3>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {['Audience matches channel', 'No secret values in message', 'Fallback path is clear', 'Incident owner is named', 'Customer wording is safe', 'Status cadence is defined', 'Selected model tone is appropriate', 'Runbook action is testable'].map((item) => (
              <div key={item} className="flex gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function ModelBenchmarkPanel({ event, primaryModelId, onPrimaryModelChange }: { event: (typeof criticalAzureEvents)[number]; primaryModelId: string; onPrimaryModelChange: (modelId: string) => void }) {
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(['ollama-qwen25-05b', 'ollama-llama32-1b', 'ollama-gemma2-2b']);
  const [parameters, setParameters] = useState<BenchmarkParams>(defaultBenchmarkParams);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [activeRunId, setActiveRunId] = useState('');
  const [expandedId, setExpandedId] = useState('');
  const [sortKey, setSortKey] = useState<keyof BenchmarkResult>('overallScore');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [resultFilter, setResultFilter] = useState('');

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(BENCHMARK_STORAGE_KEY);
      const parsed = saved ? JSON.parse(saved) as BenchmarkRun[] : [];
      setRuns(parsed);
      setActiveRunId(parsed.find((run) => run.eventId === event.id)?.id ?? '');
    } catch {
      setRuns([]);
    }
  }, [event.id]);

  const activeRun = runs.find((run) => run.id === activeRunId && run.eventId === event.id) ?? runs.find((run) => run.eventId === event.id);
  const selectedModels = selectedModelIds.map((id) => benchmarkModels.find((model) => model.id === id)).filter(Boolean) as typeof benchmarkModels;
  const prompt = buildBenchmarkPrompt(event, parameters);
  const sortedResults = [...(activeRun?.results ?? [])]
    .filter((result) => [result.model, result.provider, result.family, result.hosting, result.pass ? 'pass' : 'fail'].join(' ').toLowerCase().includes(resultFilter.toLowerCase()))
    .sort((left, right) => compareResults(left, right, sortKey, sortDirection));

  function addModel(modelId: string) {
    if (!modelId || selectedModelIds.includes(modelId)) return;
    setSelectedModelIds([...selectedModelIds, modelId]);
    onPrimaryModelChange(modelId);
  }

  function removeModel(modelId: string) {
    if (selectedModelIds.length === 1) return;
    const nextModelIds = selectedModelIds.filter((id) => id !== modelId);
    setSelectedModelIds(nextModelIds);
    if (primaryModelId === modelId) {
      onPrimaryModelChange(nextModelIds[0]);
    }
  }

  function sortBy(key: keyof BenchmarkResult) {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
      return;
    }
    setSortKey(key);
    setSortDirection(key === 'estimatedCost' || key === 'latencyMs' ? 'asc' : 'desc');
  }

  async function runBenchmark() {
    setRunning(true);
    const run = await runModelBenchmark(event, selectedModelIds, parameters);
    const nextRuns = [run, ...runs].slice(0, 24);
    setRuns(nextRuns);
    setActiveRunId(run.id);
    window.localStorage.setItem(BENCHMARK_STORAGE_KEY, JSON.stringify(nextRuns));
    setRunning(false);
  }

  function exportCsv() {
    if (!activeRun) return;
    const headers = ['rank', 'model', 'provider', 'score', 'accuracy', 'latencyMs', 'cost', 'tokens', 'pass'];
    const rows = activeRun.results.map((result) => [result.rank, result.model, result.provider, result.overallScore, result.accuracy, result.latencyMs, result.estimatedCost.toFixed(5), result.totalTokens, result.pass ? 'Pass' : 'Fail']);
    downloadFile(`model-benchmark-${event.id}.csv`, [headers, ...rows].map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n'), 'text/csv');
  }

  function exportJson() {
    if (!activeRun) return;
    downloadFile(`model-benchmark-${event.id}.json`, JSON.stringify(activeRun, null, 2), 'application/json');
  }

  return (
    <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
      <div className="border-b border-slate-200 bg-slate-50 p-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Model benchmarking</p>
            <h3 className="mt-1 text-2xl font-semibold text-slate-950">Model Comparison Engine</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
              Run the same alert prompt, context, temperature, max tokens, and validation criteria across selected local SLMs.
            </p>
          </div>
          <div className="rounded-full bg-slate-950 px-3 py-1 text-xs font-semibold text-white">
            {benchmarkModels.length} configured models
          </div>
        </div>
      </div>

      <div className="grid gap-0 xl:grid-cols-[0.85fr_1.15fr]">
        <div className="border-b border-slate-200 p-5 xl:border-b-0 xl:border-r">
          <div className="grid gap-4">
            <div>
              <label className="text-xs font-semibold uppercase tracking-wider text-slate-500">AI Model</label>
              <select onChange={(event) => addModel(event.target.value)} value="" className="mt-2 h-11 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm">
                <option value="">Add model to comparison...</option>
                {modelProviders.map((provider) => (
                  <optgroup key={provider.id} label={`${provider.name} · ${provider.hosting}`}>
                    {benchmarkModels.filter((model) => model.providerId === provider.id).map((model) => (
                      <option key={model.id} value={model.id}>{model.name} · {model.family} · {model.hosting}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedModels.map((model) => (
                  <button key={model.id} type="button" onClick={() => onPrimaryModelChange(model.id)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold', primaryModelId === model.id ? 'border-slate-950 bg-slate-950 text-white' : 'border-sky-200 bg-sky-50 text-sky-800')}>
                    {model.name} · notification tone
                  </button>
                ))}
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {selectedModels.map((model) => (
                  <button key={`${model.id}-remove`} type="button" onClick={() => removeModel(model.id)} className="text-xs font-semibold text-slate-500 hover:text-red-700">
                    Remove {model.name}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Temperature">
                <input type="number" step="0.1" min="0" max="2" value={parameters.temperature} onChange={(event) => setParameters({ ...parameters, temperature: Number(event.target.value) })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </Field>
              <Field label="Max tokens">
                <input type="number" min="64" max="4096" value={parameters.maxTokens} onChange={(event) => setParameters({ ...parameters, maxTokens: Number(event.target.value) })} className="h-10 w-full rounded-lg border border-slate-200 px-3 text-sm" />
              </Field>
            </div>

            <Field label="Shared system prompt">
              <textarea value={parameters.systemPrompt} onChange={(event) => setParameters({ ...parameters, systemPrompt: event.target.value })} className="min-h-32 w-full rounded-xl border border-slate-200 p-3 text-sm leading-6" />
            </Field>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Provider architecture</p>
              <div className="mt-3 grid gap-2">
                {modelProviders.map((provider) => (
                  <div key={provider.id} className="flex items-center justify-between gap-3 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-slate-200">
                    <span className="font-semibold text-slate-800">{provider.name}</span>
                    <span className="text-xs text-slate-500">{provider.endpointLabel}</span>
                  </div>
                ))}
              </div>
            </div>

            <button onClick={runBenchmark} disabled={running || selectedModelIds.length === 0} className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
              <BarChart3 className="h-4 w-4" /> {running ? 'Running identical benchmark...' : 'Run model comparison'}
            </button>
          </div>
        </div>

        <div className="p-5">
          <div className="grid gap-4 lg:grid-cols-5">
            <DashboardMetric label="Best score" value={activeRun ? `${Math.max(...activeRun.results.map((result) => result.overallScore))}` : '--'} description="Highest combined score for quality, accuracy, speed, cost, and grounding." />
            <DashboardMetric label="Lowest cost" value={activeRun ? money(Math.min(...activeRun.results.map((result) => result.estimatedCost))) : '--'} description="Estimated model API cost. Local Ollama models are treated as zero-cost runs." />
            <DashboardMetric label="Fastest" value={activeRun ? `${Math.min(...activeRun.results.map((result) => result.latencyMs))}ms` : '--'} description="Shortest end-to-end model response time in this benchmark run." />
            <DashboardMetric label="Pass rate" value={activeRun ? `${Math.round((activeRun.results.filter((result) => result.pass).length / activeRun.results.length) * 100)}%` : '--'} description="Share of models that met score, grounding, and required-field thresholds." />
            <DashboardMetric label="Runs stored" value={runs.filter((run) => run.eventId === event.id).length.toString()} description="Saved benchmark runs for this alert in this browser." />
          </div>

          {activeRun && <BenchmarkCharts results={activeRun.results} />}

          {activeRun && <BenchmarkRunExplanation run={activeRun} />}

          <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              <input value={resultFilter} onChange={(event) => setResultFilter(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm" placeholder="Filter results" />
              <select value={activeRunId} onChange={(event) => setActiveRunId(event.target.value)} className="h-10 rounded-lg border border-slate-200 px-3 text-sm">
                {(runs.filter((run) => run.eventId === event.id)).map((run) => (
                  <option key={run.id} value={run.id}>{new Date(run.createdAt).toLocaleString()} · {run.results.length} models</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button onClick={exportCsv} disabled={!activeRun} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4" /> CSV</button>
              <button onClick={exportJson} disabled={!activeRun} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><Download className="h-4 w-4" /> JSON</button>
            </div>
          </div>

          <BenchmarkTable results={sortedResults} expandedId={expandedId} setExpandedId={setExpandedId} sortBy={sortBy} />

          {activeRun && <OutputDiff results={activeRun.results} />}

          {!activeRun && (
            <div className="mt-5 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm leading-6 text-slate-600">
              No benchmark run yet. Select models, keep the shared parameters fixed, and run the comparison to populate metrics, rankings, visual dashboards, and historical baselines.
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

function buildModelAwareMessages(event: (typeof criticalAzureEvents)[number], modelId: string): AlertMessage[] {
  const model = benchmarkModels.find((item) => item.id === modelId) ?? benchmarkModels[0];
  const profile = notificationProfileForModel(model.name);
  const existingMessages = event.messages.map((message) => ({
    ...message,
    body: `${profile.opening} ${message.body} ${profile.close}`,
    style: `${message.style} · ${profile.style}`,
  }));

  return [
    ...existingMessages,
    {
      channel: 'Pager escalation',
      audience: 'Primary on-call',
      subject: `${profile.subjectPrefix} ${event.title}`,
      body: profile.operator(event),
      cta: 'Acknowledge page',
      style: `Escalation-first · ${profile.style}`,
    },
    {
      channel: 'SMS fallback',
      audience: 'Backup responder',
      subject: `${event.severity} fallback notification`,
      body: profile.sms(event),
      cta: 'Confirm receipt',
      style: `Fallback-safe brief · ${profile.style}`,
    },
    {
      channel: 'Customer status update',
      audience: 'External subscribers',
      subject: profile.customerSubject(event),
      body: profile.customer(event),
      cta: 'View status page',
      style: `Customer-safe wording · ${profile.style}`,
    },
    {
      channel: 'Email update',
      audience: 'Service stakeholders',
      subject: `${event.service} incident update`,
      body: profile.email(event),
      cta: 'Read incident notes',
      style: `Detailed stakeholder update · ${profile.style}`,
    },
    {
      channel: 'Runbook task',
      audience: 'Platform engineer',
      subject: `Validate ${event.service} recovery path`,
      body: profile.runbook(event),
      cta: 'Start checklist',
      style: `Step-oriented remediation · ${profile.style}`,
    },
    {
      channel: 'Leadership brief',
      audience: 'Incident leadership',
      subject: `${event.title} leadership summary`,
      body: profile.leadership(event),
      cta: 'Review risk',
      style: `Decision-ready summary · ${profile.style}`,
    },
  ];
}

function notificationProfileForModel(modelName: string) {
  if (modelName.includes('qwen')) {
    return {
      subjectPrefix: 'Fast triage:',
      opening: 'Fast triage summary:',
      close: 'Keep the update short and move to mitigation.',
      style: 'qwen2.5 concise, low-latency wording',
      operator: (event: (typeof criticalAzureEvents)[number]) => `${event.signal}. Mitigate now: scale capacity, reduce non-critical load, and verify ${event.service} health in ${event.region}.`,
      sms: (event: (typeof criticalAzureEvents)[number]) => `${event.severity}: ${event.title}. ${event.signal}. Check Azure Monitor and acknowledge within 5 minutes.`,
      customerSubject: (event: (typeof criticalAzureEvents)[number]) => `${event.service} performance notice`,
      customer: (event: (typeof criticalAzureEvents)[number]) => `We are investigating a ${event.service} performance issue in ${event.region}. Core delivery remains prioritized while the team restores normal processing.`,
      email: (event: (typeof criticalAzureEvents)[number]) => `${event.title} is active. Impact: ${event.impact} Next action: validate recent load and start mitigation before queueing grows.`,
      runbook: (event: (typeof criticalAzureEvents)[number]) => `Open metrics, confirm ${event.signal}, scale the constrained component, and post a short recovery checkpoint.`,
      leadership: (event: (typeof criticalAzureEvents)[number]) => `${event.severity} on ${event.service}. Customer risk is controlled if mitigation starts quickly; next checkpoint should confirm capacity and delivery health.`,
    };
  }

  if (modelName.includes('gemma')) {
    return {
      subjectPrefix: 'Clear summary:',
      opening: 'Plain-language summary:',
      close: 'Use calm wording and avoid unnecessary implementation detail.',
      style: 'gemma2 polished, audience-aware wording',
      operator: (event: (typeof criticalAzureEvents)[number]) => `${event.title} is affecting operational headroom. Confirm the metric, reduce avoidable work, and keep notification delivery protected while recovery actions proceed.`,
      sms: (event: (typeof criticalAzureEvents)[number]) => `${event.severity}: ${event.title}. Please acknowledge and check the incident channel for the current mitigation step.`,
      customerSubject: () => 'Service update for notification processing',
      customer: (event: (typeof criticalAzureEvents)[number]) => `We are working on a capacity issue in ${event.region}. Notifications remain the priority, but some AI-generated detail may take longer than usual.`,
      email: (event: (typeof criticalAzureEvents)[number]) => `The current signal is ${event.signal}. The likely customer-facing effect is delayed enrichment rather than a complete delivery interruption. Teams should share updates after each validation checkpoint.`,
      runbook: (event: (typeof criticalAzureEvents)[number]) => `Validate the alert payload, check recent deployment or load changes, apply the lowest-risk mitigation, and confirm recovery through Azure Monitor.`,
      leadership: (event: (typeof criticalAzureEvents)[number]) => `This is a managed degradation in ${event.service}. The team is protecting critical notification delivery and will escalate if customer-facing delay increases.`,
    };
  }

  if (modelName.includes('phi3')) {
    return {
      subjectPrefix: 'Technical diagnosis:',
      opening: 'Technical hypothesis:',
      close: 'Include the validation query and owner handoff.',
      style: 'phi3 technical, remediation-heavy wording',
      operator: (event: (typeof criticalAzureEvents)[number]) => `Hypothesis: ${event.payload} Validate saturation, inspect active requests, check model pulls, and scale the constrained runtime before retries cascade.`,
      sms: (event: (typeof criticalAzureEvents)[number]) => `${event.severity}: ${event.title}. Validate metric threshold breach and execute the scale or load-shed runbook.`,
      customerSubject: (event: (typeof criticalAzureEvents)[number]) => `${event.service} technical incident notice`,
      customer: (event: (typeof criticalAzureEvents)[number]) => `A backend capacity signal in ${event.region} may delay generated incident details. Delivery safeguards and fallback channels are being monitored.`,
      email: (event: (typeof criticalAzureEvents)[number]) => `Signal: ${event.signal}. Payload: ${event.payload} Required checks: capacity, queue depth, dependency latency, and fallback channel health.`,
      runbook: (event: (typeof criticalAzureEvents)[number]) => `Run metric query for the breach window, compare against request volume, pause non-critical jobs, scale runtime capacity, and verify p95 latency recovery.`,
      leadership: (event: (typeof criticalAzureEvents)[number]) => `${event.service} has a technical capacity risk. The recovery plan is measurable: reduce load, increase capacity, and verify notification delivery latency.`,
    };
  }

  return {
    subjectPrefix: 'Balanced triage:',
    opening: 'Balanced incident summary:',
    close: 'Keep operators, stakeholders, and subscribers aligned on the same recovery facts.',
    style: 'llama3.2 balanced operations wording',
    operator: (event: (typeof criticalAzureEvents)[number]) => `${event.signal}. Assign an owner, check recent load or deployment changes, begin mitigation, and post the first recovery checkpoint in the incident channel.`,
    sms: (event: (typeof criticalAzureEvents)[number]) => `${event.severity}: ${event.title}. Acknowledge, review ${event.service} metrics, and confirm fallback notification health.`,
    customerSubject: (event: (typeof criticalAzureEvents)[number]) => `${event.service} reliability update`,
    customer: (event: (typeof criticalAzureEvents)[number]) => `We are investigating an issue affecting ${event.service} in ${event.region}. We are prioritizing critical notifications and will update after validation.`,
    email: (event: (typeof criticalAzureEvents)[number]) => `${event.title} requires coordinated response. Current impact: ${event.impact} Recommended next step: validate the signal and start the least disruptive mitigation.`,
    runbook: (event: (typeof criticalAzureEvents)[number]) => `Confirm the alert, identify the owner, check dependency health, apply mitigation, and record evidence for the next incident update.`,
    leadership: (event: (typeof criticalAzureEvents)[number]) => `${event.severity} response is active for ${event.service}. Risk is being managed through mitigation, fallback readiness, and recurring validation checkpoints.`,
  };
}

function BenchmarkTable({
  results,
  expandedId,
  setExpandedId,
  sortBy,
}: {
  results: BenchmarkResult[];
  expandedId: string;
  setExpandedId: (id: string) => void;
  sortBy: (key: keyof BenchmarkResult) => void;
}) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {[
                ['rank', 'Rank'],
                ['model', 'Model'],
                ['provider', 'Provider'],
                ['overallScore', 'Score'],
                ['accuracy', 'Accuracy'],
                ['latencyMs', 'Latency'],
                ['estimatedCost', 'Cost'],
                ['totalTokens', 'Tokens'],
                ['pass', 'Pass/Fail'],
              ].map(([key, label]) => (
                <th key={key} className="whitespace-nowrap px-3 py-3 text-left font-semibold">
                  <button type="button" onClick={() => sortBy(key as keyof BenchmarkResult)} className="inline-flex items-center gap-1 hover:text-slate-900">
                    {label} <ChevronDown className="h-3 w-3" />
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {results.map((result) => (
              <tr key={result.id} className="align-top">
                <td className="px-3 py-3 font-semibold text-slate-950">#{result.rank}</td>
                <td className="px-3 py-3">
                  <button type="button" onClick={() => setExpandedId(expandedId === result.id ? '' : result.id)} className="text-left font-semibold text-sky-700 hover:text-sky-900">
                    {result.model}
                  </button>
                  <div className="mt-1 text-xs text-slate-500">{result.family} · {result.hosting} · {result.version}</div>
                  {expandedId === result.id && <ExpandedResult result={result} />}
                </td>
                <td className="px-3 py-3 text-slate-700">{result.provider}</td>
                <td className="px-3 py-3"><ScorePill value={result.overallScore} /></td>
                <td className="px-3 py-3 text-slate-700">{result.accuracy}%</td>
                <td className="px-3 py-3 text-slate-700">{result.latencyMs}ms</td>
                <td className="px-3 py-3 text-slate-700">{money(result.estimatedCost)}</td>
                <td className="px-3 py-3 text-slate-700">{result.totalTokens}</td>
                <td className="px-3 py-3">
                  <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', result.pass ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
                    {result.pass ? 'Pass' : 'Fail'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ExpandedResult({ result }: { result: BenchmarkResult }) {
  return (
    <div className="mt-3 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700 lg:grid-cols-2">
      <div>
        <p className="font-semibold uppercase tracking-wider text-slate-500">Complete prompt</p>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 ring-1 ring-slate-200">{result.prompt.map((message) => `${message.role}: ${message.content}`).join('\n\n')}</pre>
      </div>
      <div>
        <p className="font-semibold uppercase tracking-wider text-slate-500">Overall response</p>
        <pre className="mt-2 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg bg-white p-3 ring-1 ring-slate-200">{result.response}</pre>
      </div>
      <div className="lg:col-span-2">
        <p className="font-semibold uppercase tracking-wider text-slate-500">Evaluation</p>
        <div className="mt-2 grid gap-2 sm:grid-cols-3">
          <MiniFact label="Quality" value={`${result.responseQuality}%`} />
          <MiniFact label="Hallucination" value={`${result.hallucinationScore}%`} />
          <MiniFact label="Confidence" value={result.confidenceScore ? `${result.confidenceScore}%` : 'Not supported'} />
          <MiniFact label="TTFT" value={`${result.timeToFirstTokenMs}ms`} />
          <MiniFact label="Execution" value={`${result.totalExecutionMs}ms`} />
          <MiniFact label="Context usage" value={`${result.contextWindowUsage}%`} />
          <MiniFact label="Prompt tokens" value={result.promptTokens.toString()} />
          <MiniFact label="Completion tokens" value={result.completionTokens.toString()} />
          <MiniFact label="Memory" value={result.memoryMb ? `${result.memoryMb} MB` : 'N/A'} />
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {result.requiredFields.map((field) => (
            <span key={field.label} className={cn('rounded-full px-2 py-1 font-semibold', field.present ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700')}>
              {field.present ? '✓' : '×'} {field.label}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

function BenchmarkCharts({ results }: { results: BenchmarkResult[] }) {
  const radar = results[0];
  return (
    <div className="mt-5 grid gap-4 xl:grid-cols-[1fr_0.75fr]">
      <div className="grid gap-4 md:grid-cols-2">
        <BarPanel title="Response time comparison" description="Lower is better. This measures how long each model took to return the complete answer." results={results} value={(result) => result.latencyMs} suffix="ms" invert />
        <BarPanel title="Cost comparison" description="Lower is better. Local Ollama models show zero API spend, even though they still use machine resources." results={results} value={(result) => result.estimatedCost} format={money} invert />
        <BarPanel title="Accuracy comparison" description="Higher is better. Accuracy blends expected incident facts, required fields, and low hallucination risk." results={results} value={(result) => result.accuracy} suffix="%" />
        <BarPanel title="Token consumption" description="Lower can be more efficient. This is prompt tokens plus generated response tokens." results={results} value={(result) => result.totalTokens} suffix=" tokens" invert />
        <BarPanel title="Overall score" description="Higher is better. This final score combines response quality, accuracy, speed, cost, and grounding." results={results} value={(result) => result.overallScore} suffix="/100" />
      </div>
      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Radar chart</p>
        <h4 className="mt-1 font-semibold text-slate-950">Top model capability shape</h4>
        <p className="mt-2 text-xs leading-5 text-slate-600">This chart shows the top-ranked model across quality, accuracy, grounding, context efficiency, and final score.</p>
        {radar ? <Radar result={radar} /> : null}
      </div>
    </div>
  );
}

function BarPanel({ title, description, results, value, suffix = '', format, invert = false }: { title: string; description: string; results: BenchmarkResult[]; value: (result: BenchmarkResult) => number; suffix?: string; format?: (value: number) => string; invert?: boolean }) {
  const raw = results.map(value);
  const max = Math.max(...raw, 1);
  const min = Math.min(...raw, 0);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{title}</p>
      <p className="mt-1 text-xs leading-5 text-slate-600">{description}</p>
      <div className="mt-3 space-y-2">
        {results.map((result) => {
          const current = value(result);
          const percent = invert ? Math.max(8, 100 - ((current - min) / Math.max(max - min, 1)) * 92) : Math.max(8, (current / max) * 100);
          return (
            <div key={`${title}-${result.model}`}>
              <div className="flex justify-between gap-2 text-xs text-slate-600"><span className="truncate font-semibold">{result.model}</span><span>{format ? format(current) : `${current}${suffix}`}</span></div>
              <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-sky-600" style={{ width: `${percent}%` }} /></div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function BenchmarkRunExplanation({ run }: { run: BenchmarkRun }) {
  const winner = run.results[0];
  const fastest = [...run.results].sort((left, right) => left.latencyMs - right.latencyMs)[0];
  const mostAccurate = [...run.results].sort((left, right) => right.accuracy - left.accuracy)[0];
  const mostEfficient = [...run.results].sort((left, right) => left.totalTokens - right.totalTokens)[0];

  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Plain-English details</p>
      <h4 className="mt-1 text-lg font-semibold text-slate-950">How to read this benchmark run</h4>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <ExplanationItem title="Why this model is first" text={`${winner.model} is ranked first because it has the strongest combined score after balancing answer quality, accuracy, response time, cost, and grounding.`} />
        <ExplanationItem title="Fastest response" text={`${fastest.model} responded in ${fastest.latencyMs}ms. Lower latency is useful for urgent operator notifications and live incident triage.`} />
        <ExplanationItem title="Accuracy meaning" text={`${mostAccurate.model} has the highest accuracy at ${mostAccurate.accuracy}%. Accuracy checks expected alert facts, required response fields, and low hallucination risk.`} />
        <ExplanationItem title="Token usage meaning" text={`${mostEfficient.model} used the fewest tokens at ${mostEfficient.totalTokens}. Lower token use usually means a shorter, cheaper, and more compact answer.`} />
        <ExplanationItem title="Why cost is zero" text="These models are running through the local Ollama runtime, so the benchmark records no external API charge. Infrastructure cost is not included in this number." />
        <ExplanationItem title="Pass criteria" text="A model passes when it scores at least 72, keeps hallucination risk below 35, and includes at least 80% of the required incident-response fields." />
      </div>
    </div>
  );
}

function ExplanationItem({ title, text }: { title: string; text: string }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-sm font-semibold text-slate-950">{title}</p><p className="mt-1 text-sm leading-5 text-slate-600">{text}</p></div>;
}

function Radar({ result }: { result: BenchmarkResult }) {
  const values = [result.responseQuality, result.accuracy, 100 - result.hallucinationScore, Math.max(0, 100 - result.contextWindowUsage), result.overallScore];
  const points = values.map((value, index) => {
    const angle = (-90 + index * 72) * (Math.PI / 180);
    const radius = 18 + (value / 100) * 58;
    return `${90 + Math.cos(angle) * radius},${90 + Math.sin(angle) * radius}`;
  }).join(' ');
  return (
    <div className="mt-4 flex flex-col items-center">
      <svg viewBox="0 0 180 180" className="h-48 w-48">
        {[35, 55, 75].map((radius) => <circle key={radius} cx="90" cy="90" r={radius} fill="none" stroke="#e2e8f0" />)}
        <polygon points={points} fill="#0f6cbd33" stroke="#0f6cbd" strokeWidth="2" />
      </svg>
      <p className="text-sm font-semibold text-slate-950">{result.model}</p>
      <p className="text-xs text-slate-500">Quality · Accuracy · Grounding · Context · Score</p>
    </div>
  );
}

function OutputDiff({ results }: { results: BenchmarkResult[] }) {
  const [left, right] = results;
  if (!left || !right) return null;
  const leftTerms = uniqueTerms(left.response, right.response).slice(0, 14);
  const rightTerms = uniqueTerms(right.response, left.response).slice(0, 14);
  return (
    <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Highlighted differences</p>
      <div className="mt-3 grid gap-3 md:grid-cols-2">
        <DiffBox title={`${left.model} unique terms`} terms={leftTerms} />
        <DiffBox title={`${right.model} unique terms`} terms={rightTerms} />
      </div>
    </div>
  );
}

function DiffBox({ title, terms }: { title: string; terms: string[] }) {
  return <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200"><p className="text-sm font-semibold text-slate-950">{title}</p><div className="mt-2 flex flex-wrap gap-2">{terms.map((term) => <span key={term} className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">{term}</span>)}</div></div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block"><span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span><div className="mt-2">{children}</div></label>;
}

function DashboardMetric({ label, value, description }: { label: string; value: string; description: string }) {
  return <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3"><p className="text-xs uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 text-lg font-semibold text-slate-950">{value}</p><p className="mt-2 text-xs leading-5 text-slate-600">{description}</p></div>;
}

function MiniFact({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-white p-2 ring-1 ring-slate-200"><p className="text-[11px] uppercase tracking-wider text-slate-500">{label}</p><p className="mt-1 font-semibold text-slate-900">{value}</p></div>;
}

function ScorePill({ value }: { value: number }) {
  return <span className={cn('rounded-full px-2 py-1 text-xs font-semibold', value >= 85 ? 'bg-emerald-50 text-emerald-700' : value >= 72 ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700')}>{value}</span>;
}

function compareResults(left: BenchmarkResult, right: BenchmarkResult, key: keyof BenchmarkResult, direction: 'asc' | 'desc') {
  const leftValue = left[key];
  const rightValue = right[key];
  const result = typeof leftValue === 'number' && typeof rightValue === 'number'
    ? leftValue - rightValue
    : String(leftValue).localeCompare(String(rightValue));
  return direction === 'asc' ? result : -result;
}

function money(value: number) {
  if (value === 0) return '$0.00000';
  return `$${value.toFixed(5)}`;
}

function downloadFile(name: string, content: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  link.click();
  URL.revokeObjectURL(url);
}

function uniqueTerms(source: string, other: string) {
  const otherTerms = new Set(words(other));
  return Array.from(new Set(words(source).filter((term) => !otherTerms.has(term))));
}

function baseMessageStyle(style: string) {
  return style.split(' · ')[0];
}

function words(text: string) {
  return text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((term) => term.length > 5);
}

function DarkMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
      <div className="text-xs uppercase tracking-wider text-slate-400">{label}</div>
      <div className="mt-1 text-sm font-semibold text-white">{value}</div>
    </div>
  );
}

function AlertMessageCard({ message }: { message: AlertMessage }) {
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{message.channel}</p>
            <h4 className="mt-1 text-lg font-semibold text-slate-950">{message.subject}</h4>
          </div>
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">{message.audience}</span>
        </div>
      </div>
      <div className="p-4">
        <div className="rounded-[1.5rem] bg-slate-950 p-2">
          <div className="rounded-[1.1rem] bg-white p-3">
            <div className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-sky-700 text-white">
                <MessageIcon channel={message.channel} />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notify Hub</p>
                <p className="text-xs text-slate-400">{message.channel}</p>
              </div>
            </div>
            <h5 className="mt-3 text-sm font-semibold text-slate-950">{message.subject}</h5>
            <p className="mt-1 text-sm leading-5 text-slate-600">{message.body}</p>
            <button className="mt-3 w-full rounded-lg bg-slate-950 px-3 py-2 text-xs font-semibold text-white">{message.cta}</button>
          </div>
        </div>
        <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Message style</p>
          <p className="mt-1 text-sm leading-5 text-slate-700">{message.style}</p>
        </div>
      </div>
    </article>
  );
}

function MessageIcon({ channel }: { channel: string }) {
  const lower = channel.toLowerCase();
  if (lower.includes('email')) return <Mail className="h-4 w-4" />;
  if (lower.includes('sms') || lower.includes('push') || lower.includes('pager')) return <Smartphone className="h-4 w-4" />;
  if (lower.includes('teams')) return <MessageSquareText className="h-4 w-4" />;
  if (lower.includes('deployment')) return <Send className="h-4 w-4" />;
  return <BellRing className="h-4 w-4" />;
}