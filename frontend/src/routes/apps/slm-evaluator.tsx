import { createFileRoute } from '@tanstack/react-router';
import { useMemo, useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  CheckCircle2,
  DatabaseZap,
  FilePlus2,
  Gauge,
  Layers3,
  Microscope,
  ShieldCheck,
  Sparkles,
  Target,
} from 'lucide-react';
import { benchmarkModels, type BenchmarkModelConfig } from '@/data/modelBenchmark';
import { cn } from '@/lib/utils';

export const Route = createFileRoute('/apps/slm-evaluator')({
  component: SlmEvaluatorApp,
});

type ScenarioId = 'incident-triage' | 'customer-brief' | 'validation-query' | 'structured-extraction';
type DataType = 'Azure alert payload' | 'Runbook' | 'KQL query' | 'Customer message' | 'Post-incident review';

type EvaluationScenario = {
  id: ScenarioId;
  name: string;
  goal: string;
  weights: BenchmarkModelConfig['capability'];
  successCriteria: string[];
};

type DataAsset = {
  id: string;
  title: string;
  type: DataType;
  quality: number;
  coverage: string;
};

const scenarios: EvaluationScenario[] = [
  {
    id: 'incident-triage',
    name: 'Azure incident triage',
    goal: 'Find the model that gives operators a fast, grounded first response for Sev 1 Azure alerts.',
    weights: { reasoning: 24, speed: 23, cost: 10, grounding: 21, operations: 22 },
    successCriteria: ['Names the impacted Azure service', 'Gives immediate mitigation', 'Keeps customer impact specific'],
  },
  {
    id: 'customer-brief',
    name: 'Customer notification brief',
    goal: 'Compare models on concise, non-alarming customer updates that still preserve operational truth.',
    weights: { reasoning: 18, speed: 14, cost: 11, grounding: 27, operations: 30 },
    successCriteria: ['Uses plain English', 'Avoids unsupported promises', 'Includes next update timing'],
  },
  {
    id: 'validation-query',
    name: 'KQL validation plan',
    goal: 'Score which SLM produces the strongest evidence plan before an operator escalates or closes an incident.',
    weights: { reasoning: 30, speed: 10, cost: 8, grounding: 28, operations: 24 },
    successCriteria: ['Suggests useful KQL checks', 'Separates symptoms from root cause', 'Identifies rollback evidence'],
  },
  {
    id: 'structured-extraction',
    name: 'Alert field extraction',
    goal: 'Evaluate compact models on reliable JSON-style extraction from noisy alert and ticket text.',
    weights: { reasoning: 16, speed: 25, cost: 18, grounding: 29, operations: 12 },
    successCriteria: ['Preserves resource IDs', 'Returns stable fields', 'Flags missing values instead of inventing them'],
  },
];

const seedDataAssets: DataAsset[] = [
  { id: 'asset-alerts', title: 'Critical Azure Monitor alerts', type: 'Azure alert payload', quality: 91, coverage: '62 service events with severity, signal, payload, and impact.' },
  { id: 'asset-runbooks', title: 'Notification failover runbooks', type: 'Runbook', quality: 84, coverage: 'Operator steps for Teams, web push, Event Grid, and Service Bus fallback.' },
  { id: 'asset-kql', title: 'Validation query snippets', type: 'KQL query', quality: 78, coverage: 'CPU, latency, throttling, delivery failures, and queue depth checks.' },
  { id: 'asset-comms', title: 'Approved customer message patterns', type: 'Customer message', quality: 87, coverage: 'Plain-English templates for outage, degradation, recovery, and watch states.' },
];

const dataTypes: DataType[] = ['Azure alert payload', 'Runbook', 'KQL query', 'Customer message', 'Post-incident review'];

function SlmEvaluatorApp() {
  const [scenarioId, setScenarioId] = useState<ScenarioId>('incident-triage');
  const [selectedModelIds, setSelectedModelIds] = useState<string[]>(benchmarkModels.map((model) => model.id));
  const [dataAssets, setDataAssets] = useState<DataAsset[]>(seedDataAssets);
  const [title, setTitle] = useState('');
  const [dataType, setDataType] = useState<DataType>('Runbook');
  const [coverage, setCoverage] = useState('');
  const [quality, setQuality] = useState(82);

  const scenario = scenarios.find((item) => item.id === scenarioId) ?? scenarios[0];
  const readiness = useMemo(() => dataReadiness(dataAssets), [dataAssets]);
  const evaluatedModels = useMemo(() => {
    return benchmarkModels
      .filter((model) => selectedModelIds.includes(model.id))
      .map((model) => scoreModel(model, scenario, readiness.score))
      .sort((left, right) => right.total - left.total);
  }, [readiness.score, scenario, selectedModelIds]);
  const leader = evaluatedModels[0];

  function toggleModel(modelId: string) {
    setSelectedModelIds((current) => current.includes(modelId) ? current.filter((id) => id !== modelId) : [...current, modelId]);
  }

  function addDataAsset() {
    if (!title.trim() || !coverage.trim()) return;
    setDataAssets((current) => [
      ...current,
      {
        id: `asset-${Date.now()}`,
        title: title.trim(),
        type: dataType,
        quality,
        coverage: coverage.trim(),
      },
    ]);
    setTitle('');
    setCoverage('');
    setQuality(82);
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <section className="overflow-hidden rounded-2xl border bg-[#08111f] text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.25fr_0.75fr] lg:p-8">
          <div className="space-y-5">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-300/30 bg-cyan-300/10 px-3 py-1 text-sm text-cyan-100">
              <Microscope className="h-4 w-4" /> SLM Evaluation Lab
            </div>
            <div>
              <h2 className="max-w-3xl text-3xl font-semibold tracking-tight md:text-4xl">
                Evaluate small language models before they touch production workflows
              </h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-300">
                Compare local SLMs against real Azure operations scenarios, then improve their success rate by adding higher-quality alerts, runbooks, validation queries, and communication examples.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <HeroMetric label="Models compared" value={String(selectedModelIds.length)} />
              <HeroMetric label="Data readiness" value={`${readiness.score}/100`} />
              <HeroMetric label="Best current fit" value={leader?.model.name ?? 'Select a model'} />
            </div>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-cyan-100">
              <Target className="h-4 w-4" /> Current scenario
            </div>
            <select
              value={scenarioId}
              onChange={(event) => setScenarioId(event.target.value as ScenarioId)}
              className="mt-4 h-10 w-full rounded-lg border border-white/15 bg-slate-950 px-3 text-sm text-white"
            >
              {scenarios.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
            <p className="mt-3 text-sm leading-6 text-slate-300">{scenario.goal}</p>
            <div className="mt-4 space-y-2">
              {scenario.successCriteria.map((criterion) => (
                <div key={criterion} className="flex items-start gap-2 text-xs text-slate-200">
                  <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-cyan-200" />
                  <span>{criterion}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[0.82fr_1.18fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <Layers3 className="h-5 w-5 text-sky-600" />
            <h3 className="text-lg font-semibold">Select SLMs to evaluate</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            The evaluator uses the model profile, operational capability scores, scenario weights, and your data readiness score to rank fit.
          </p>
          <div className="mt-4 grid gap-2">
            {benchmarkModels.map((model) => (
              <button
                key={model.id}
                type="button"
                onClick={() => toggleModel(model.id)}
                className={cn(
                  'flex items-center justify-between rounded-xl border px-3 py-3 text-left transition',
                  selectedModelIds.includes(model.id) ? 'border-sky-300 bg-sky-50 text-sky-950' : 'bg-background hover:bg-muted/60',
                )}
              >
                <span>
                  <span className="block text-sm font-semibold">{model.name}</span>
                  <span className="text-xs text-muted-foreground">{model.version} · {model.contextWindow.toLocaleString()} context</span>
                </span>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200">
                  {selectedModelIds.includes(model.id) ? 'Included' : 'Add'}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-emerald-600" />
                <h3 className="text-lg font-semibold">Evaluation results</h3>
              </div>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Rankings explain why a compact model is ready, where it needs better data, and when another model should be used.
              </p>
            </div>
            {leader && <span className="rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700 ring-1 ring-emerald-100">Best fit: {leader.model.name}</span>}
          </div>

          <div className="mt-4 overflow-hidden rounded-xl border">
            <table className="w-full text-sm">
              <thead className="bg-muted/70 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Rank</th>
                  <th className="px-4 py-3">Model</th>
                  <th className="px-4 py-3">Score</th>
                  <th className="px-4 py-3">Why it fits</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {evaluatedModels.map((item, index) => (
                  <tr key={item.model.id} className="align-top">
                    <td className="px-4 py-3 font-semibold">#{index + 1}</td>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{item.model.name}</div>
                      <div className="text-xs text-muted-foreground">{item.model.family} · {item.model.hosting}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg font-bold text-slate-950">{item.total}</span>
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-slate-200">
                          <div className="h-full rounded-full bg-sky-600" style={{ width: `${item.total}%` }} />
                        </div>
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground">+{item.dataLift} data lift</div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{item.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="grid gap-4 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <DatabaseZap className="h-5 w-5 text-indigo-600" />
            <h3 className="text-lg font-semibold">Add data to make the SLM more successful</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            Better SLM outcomes come from task-specific data: alert examples, approved runbooks, KQL validation, customer-safe language, and post-incident learnings.
          </p>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Data set name"
              className="h-10 rounded-lg border bg-background px-3 text-sm"
            />
            <select value={dataType} onChange={(event) => setDataType(event.target.value as DataType)} className="h-10 rounded-lg border bg-background px-3 text-sm">
              {dataTypes.map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <input
              value={coverage}
              onChange={(event) => setCoverage(event.target.value)}
              placeholder="What incidents or tasks does it cover?"
              className="h-10 rounded-lg border bg-background px-3 text-sm sm:col-span-2"
            />
            <label className="rounded-lg border bg-background px-3 py-2 text-sm sm:col-span-2">
              <span className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
                Data quality score <span>{quality}/100</span>
              </span>
              <input className="mt-2 w-full" type="range" min="40" max="100" value={quality} onChange={(event) => setQuality(Number(event.target.value))} />
            </label>
          </div>
          <button
            type="button"
            onClick={addDataAsset}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            <FilePlus2 className="h-4 w-4" /> Add evaluation data
          </button>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-emerald-600" />
            <h3 className="text-lg font-semibold">Data readiness score: {readiness.score}/100</h3>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{readiness.explanation}</p>
          <div className="mt-4 grid gap-2">
            {dataAssets.map((asset) => (
              <div key={asset.id} className="rounded-xl border bg-background p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <div className="text-sm font-semibold">{asset.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{asset.type}</div>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700 ring-1 ring-emerald-100">{asset.quality}/100</span>
                </div>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{asset.coverage}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <GuidanceCard icon={BookOpenCheck} title="Grounding data" text="Add source snippets that the SLM can cite or copy exactly, especially resource names, alert signals, and approved incident phrases." />
        <GuidanceCard icon={Gauge} title="Evaluation data" text="Keep golden examples for each scenario, then score required fields, hallucination risk, latency, and operator usefulness every time models change." />
        <GuidanceCard icon={Sparkles} title="Prompt tuning" text="Use the winning data examples to tighten the system prompt, define output fields, and make missing-information behavior explicit." />
      </section>
    </div>
  );
}

function HeroMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/5 p-3">
      <div className="text-2xl font-semibold">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wide text-slate-300">{label}</div>
    </div>
  );
}

function GuidanceCard({ icon: Icon, title, text }: { icon: React.ComponentType<{ className?: string }>; title: string; text: string }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <Icon className="h-5 w-5 text-sky-600" />
      <h3 className="mt-3 text-base font-semibold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-muted-foreground">{text}</p>
    </div>
  );
}

function scoreModel(model: BenchmarkModelConfig, scenario: EvaluationScenario, readinessScore: number) {
  const weighted = Object.entries(scenario.weights).reduce((total, [key, weight]) => {
    const capability = model.capability[key as keyof BenchmarkModelConfig['capability']];
    return total + (capability * weight);
  }, 0) / 100;
  const dataLift = Math.round(((readinessScore - 60) / 40) * model.capability.grounding * 0.12);
  const total = Math.max(0, Math.min(100, Math.round(weighted + dataLift)));
  const strongest = Object.entries(scenario.weights)
    .filter(([key]) => key !== 'cost')
    .map(([key, weight]) => ({ key, contribution: model.capability[key as keyof BenchmarkModelConfig['capability']] * weight }))
    .sort((left, right) => right.contribution - left.contribution)[0].key;
  const reason = `${model.name} is strongest here on ${strongest}, then gains ${dataLift} points from the current evaluation data. Use it when ${scenario.name.toLowerCase()} needs ${modelFitPhrase(strongest)}.`;
  return { model, total, dataLift, reason };
}

function dataReadiness(dataAssets: DataAsset[]) {
  const quality = dataAssets.reduce((total, asset) => total + asset.quality, 0) / Math.max(1, dataAssets.length);
  const coverage = new Set(dataAssets.map((asset) => asset.type)).size;
  const score = Math.min(100, Math.round((quality * 0.72) + (coverage / dataTypes.length) * 28));
  const explanation = score >= 85
    ? 'The model has strong grounding material across multiple task types, so evaluation should reveal meaningful differences instead of only prompt luck.'
    : score >= 70
      ? 'The model has useful seed data, but adding more KQL, runbook, and customer-message examples will improve reliability.'
      : 'The model needs broader, higher-quality examples before the evaluation can predict production success.';
  return { score, explanation };
}

function modelFitPhrase(capability: string) {
  const phrases: Record<string, string> = {
    reasoning: 'deeper analysis and careful trade-off language',
    speed: 'low-latency first responses',
    cost: 'high-volume local execution with minimal runtime cost',
    grounding: 'strict adherence to source data',
    operations: 'operator-ready remediation steps',
  };
  return phrases[capability] ?? 'balanced operational support';
}