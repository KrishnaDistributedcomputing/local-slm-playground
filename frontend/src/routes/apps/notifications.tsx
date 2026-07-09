import { createFileRoute, Link } from '@tanstack/react-router';
import { useEffect, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Cloud,
  Database,
  ExternalLink,
  Gauge,
  KeyRound,
  Mail,
  MessageSquareText,
  RadioTower,
  RefreshCw,
  Search,
  Send,
  ShieldCheck,
  ShieldAlert,
  Smartphone,
  UserPlus,
  Users,
  WifiOff,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { chatMetrics, DEFAULT_MODEL, getOllamaUrl, listModels, type ChatMessage } from '@/data/ollama';
import { criticalAzureEvents, demoModelAnalysis, slmShowcaseModels } from '@/data/azureNotificationEvents';

export const Route = createFileRoute('/apps/notifications')({
  component: NotificationPlatform,
});

type Subscriber = {
  id: string;
  name: string;
  email: string;
  channel: string;
  segment: string;
  frequency: string;
  createdAt: string;
};

type SlmAnalysis = {
  model: string;
  text: string;
  source: 'demo' | 'live';
  totalMs?: number;
  tokensPerSec?: number;
  error?: string;
};

type ModelComparisonDimension = {
  id: string;
  label: string;
  description: string;
  bestFor: string;
  scores: Record<string, number>;
};

const STORAGE_KEY = 'notify-hub-subscribers';
const INITIAL_ALERT_VISIBLE_COUNT = 12;

const modelDisplayNames: Record<string, string> = {
  'qwen2.5:0.5b': 'Qwen 2.5 0.5B',
  'llama3.2:1b': 'Llama 3.2 1B',
  'gemma2:2b': 'Gemma 2 2B',
  'deepseek-r1:1.5b': 'DeepSeek-R1 1.5B',
  'phi3:mini': 'Phi-3 Mini',
  'phi3.5:3.8b': 'Phi-3.5 3.8B',
  'phi4-mini': 'Phi-4 Mini',
};

const modelOperationalNotes: Record<string, string> = {
  'qwen2.5:0.5b': 'It is best when the operator needs very fast, low-cost wording for short triage notes, routing hints, and simple status updates.',
  'llama3.2:1b': 'It is best when the response needs balanced reasoning with enough structure for runbook steps and support handoff notes.',
  'gemma2:2b': 'It is best when the message must be clear for customers or leaders while still preserving the technical signal from the alert.',
  'deepseek-r1:1.5b': 'It is best when the incident needs slower, deeper reasoning, dependency analysis, and validation paths before an operator acts.',
  'phi3:mini': 'It is best when the workflow needs compact Microsoft-style operational guidance with concise remediation wording.',
  'phi3.5:3.8b': 'It is best when the operator needs stronger Phi reasoning for severity framing, customer impact, and support-ready summaries.',
  'phi4-mini': 'It is best when the answer needs a polished executive brief, clean tool-ready structure, and strong grounding in the alert details.',
};

function modelDisplayName(model: string): string {
  return modelDisplayNames[model] ?? model;
}

function modelMatchesAvailable(model: string, availableModel: string): boolean {
  return availableModel === model || availableModel === `${model}:latest` || `${availableModel}:latest` === model;
}

const modelComparisonDimensions: ModelComparisonDimension[] = [
  {
    id: 'triage-speed',
    label: 'Triage speed',
    description: 'How quickly the model can produce a useful first operator note.',
    bestFor: 'the first five minutes of triage',
    scores: { 'qwen2.5:0.5b': 94, 'llama3.2:1b': 88, 'gemma2:2b': 78, 'deepseek-r1:1.5b': 64, 'phi3:mini': 72, 'phi3.5:3.8b': 66, 'phi4-mini': 70 },
  },
  {
    id: 'reasoning-depth',
    label: 'Reasoning depth',
    description: 'How well the model connects symptom, likely cause, and next action.',
    bestFor: 'Root-cause framing',
    scores: { 'qwen2.5:0.5b': 54, 'llama3.2:1b': 62, 'gemma2:2b': 67, 'deepseek-r1:1.5b': 82, 'phi3:mini': 70, 'phi3.5:3.8b': 76, 'phi4-mini': 79 },
  },
  {
    id: 'azure-ops-fit',
    label: 'Azure ops fit',
    description: 'How naturally the response maps to Azure services, owners, and runbooks.',
    bestFor: 'Incident bridge',
    scores: { 'qwen2.5:0.5b': 70, 'llama3.2:1b': 76, 'gemma2:2b': 74, 'deepseek-r1:1.5b': 72, 'phi3:mini': 78, 'phi3.5:3.8b': 82, 'phi4-mini': 84 },
  },
  {
    id: 'customer-clarity',
    label: 'Customer clarity',
    description: 'How well the model turns technical symptoms into plain-language updates.',
    bestFor: 'Status page copy',
    scores: { 'qwen2.5:0.5b': 68, 'llama3.2:1b': 74, 'gemma2:2b': 86, 'deepseek-r1:1.5b': 66, 'phi3:mini': 76, 'phi3.5:3.8b': 80, 'phi4-mini': 82 },
  },
  {
    id: 'fallback-routing',
    label: 'Fallback routing',
    description: 'How clearly the model selects push, Teams, email, SMS, or pager fallback.',
    bestFor: 'Delivery degradation',
    scores: { 'qwen2.5:0.5b': 66, 'llama3.2:1b': 78, 'gemma2:2b': 80, 'deepseek-r1:1.5b': 70, 'phi3:mini': 82, 'phi3.5:3.8b': 84, 'phi4-mini': 86 },
  },
  {
    id: 'query-quality',
    label: 'Validation query quality',
    description: 'How useful the generated KQL or validation step is for proving status.',
    bestFor: 'Azure Monitor checks',
    scores: { 'qwen2.5:0.5b': 58, 'llama3.2:1b': 63, 'gemma2:2b': 69, 'deepseek-r1:1.5b': 75, 'phi3:mini': 66, 'phi3.5:3.8b': 78, 'phi4-mini': 80 },
  },
  {
    id: 'cost-efficiency',
    label: 'Cost efficiency',
    description: 'How well the model balances useful output with small size and low compute.',
    bestFor: 'High-volume alerts',
    scores: { 'qwen2.5:0.5b': 100, 'llama3.2:1b': 96, 'gemma2:2b': 88, 'deepseek-r1:1.5b': 90, 'phi3:mini': 82, 'phi3.5:3.8b': 78, 'phi4-mini': 80 },
  },
  {
    id: 'cpu-fit',
    label: 'Local CPU fit',
    description: 'How comfortably the model runs on the current compact CPU-only demo host.',
    bestFor: 'Azure Container Apps or Azure Container Instances demos',
    scores: { 'qwen2.5:0.5b': 98, 'llama3.2:1b': 94, 'gemma2:2b': 82, 'deepseek-r1:1.5b': 86, 'phi3:mini': 74, 'phi3.5:3.8b': 68, 'phi4-mini': 72 },
  },
  {
    id: 'hallucination-control',
    label: 'Hallucination control',
    description: 'How likely the model is to stay grounded in the alert payload and avoid extra claims.',
    bestFor: 'Executive review',
    scores: { 'qwen2.5:0.5b': 72, 'llama3.2:1b': 78, 'gemma2:2b': 84, 'deepseek-r1:1.5b': 76, 'phi3:mini': 80, 'phi3.5:3.8b': 82, 'phi4-mini': 84 },
  },
  {
    id: 'executive-summary',
    label: 'Executive summary',
    description: 'How well the model creates a concise business-impact summary.',
    bestFor: 'Leadership update',
    scores: { 'qwen2.5:0.5b': 64, 'llama3.2:1b': 76, 'gemma2:2b': 82, 'deepseek-r1:1.5b': 74, 'phi3:mini': 78, 'phi3.5:3.8b': 84, 'phi4-mini': 86 },
  },
];

function comparisonScore(model: string, dimension: ModelComparisonDimension, event: CriticalAzureEventItem): number {
  const base = dimension.scores[model] ?? 60;
  const severityBoost = event.severity === 'Sev 1' && ['triage-speed', 'fallback-routing'].includes(dimension.id) ? 4 : 0;
  const queryBoost = /monitor|metrics|logs|query|cpu|latency|throttl/i.test(event.signal) && dimension.id === 'query-quality' ? 4 : 0;
  return Math.min(100, base + severityBoost + queryBoost);
}

function comparisonTone(score: number): string {
  if (score >= 85) return 'bg-emerald-50 text-emerald-700 ring-emerald-100';
  if (score >= 72) return 'bg-sky-50 text-sky-700 ring-sky-100';
  if (score >= 60) return 'bg-amber-50 text-amber-700 ring-amber-100';
  return 'bg-slate-50 text-slate-600 ring-slate-200';
}

function comparisonStrength(score: number): string {
  if (score >= 88) return 'an excellent fit';
  if (score >= 78) return 'a strong fit';
  if (score >= 68) return 'a usable fit';
  return 'a limited fit';
}

function dimensionFitReason(model: string, dimension: ModelComparisonDimension, score: number, event: CriticalAzureEventItem): string {
  const modelName = modelDisplayName(model);
  const strength = comparisonStrength(score);
  const measurement = dimension.description.replace(/^How /, 'how ').replace(/\.$/, '');
  const severityContext = event.severity === 'Sev 1' && ['triage-speed', 'fallback-routing'].includes(dimension.id)
    ? ' This alert is Sev 1, so speed and fallback decisions are weighted higher.'
    : '';
  const signalContext = /monitor|metrics|logs|query|cpu|latency|throttl/i.test(event.signal) && dimension.id === 'query-quality'
    ? ' The alert signal is metric-driven, so validation-query quality gets extra weight.'
    : '';

  return `${modelName} is ${strength} for this lens. It scores ${score}/100 on ${dimension.label}, which measures ${measurement}.${severityContext}${signalContext}`;
}

function lensRecommendationDetail(model: string, dimension: ModelComparisonDimension, score: number, comparedModels: string[], event: CriticalAzureEventItem): string {
  const runnerUp = comparedModels
    .filter((candidate) => candidate !== model)
    .map((candidate) => ({ model: candidate, score: comparisonScore(candidate, dimension, event) }))
    .sort((left, right) => right.score - left.score)[0];
  const gap = runnerUp ? score - runnerUp.score : 0;
  const gapText = runnerUp && gap > 0
    ? ` It leads ${modelDisplayName(runnerUp.model)} by ${gap} point${gap === 1 ? '' : 's'}, so this is a clearer choice for this lens.`
    : runnerUp
      ? ` It is tied with ${modelDisplayName(runnerUp.model)}, so use the operational note to decide which response style fits the incident.`
      : '';
  const contextText = event.severity === 'Sev 1'
    ? ` For this ${event.severity} alert, prefer the model that reduces time-to-action and keeps the first operator message defensible.`
    : ` For this ${event.severity} alert, prefer the model that gives enough explanation without slowing down review.`;

  return `${modelOperationalNotes[model] ?? 'It is the best scoring model for this lens based on the current comparison profile.'}${gapText}${contextText}`;
}

function leaderFitReason(leader: { model: string; average: number } | undefined, event: CriticalAzureEventItem): string {
  if (!leader) return 'Select one or more models to see the strongest fit and why it was selected.';

  const topDimensions = modelComparisonDimensions
    .map((dimension) => ({ dimension, score: comparisonScore(leader.model, dimension, event) }))
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ dimension }) => dimension.label)
    .join(', ');

  return `${modelDisplayName(leader.model)} leads with an average score of ${leader.average}/100 across ten evaluation lenses. Its strongest areas are ${topDimensions}. Use the per-lens notes below to choose the model that best matches the operational goal.`;
}

function leaderTechnicalExplanation(leader: { model: string; average: number } | undefined, ranked: { model: string; average: number }[], event: CriticalAzureEventItem): string {
  if (!leader) return 'The engine calculates a score only after at least one model is selected.';

  const runnerUp = ranked[1];
  const leadMargin = runnerUp ? leader.average - runnerUp.average : 0;
  const leadText = runnerUp && leadMargin > 0
    ? ` It is ${leadMargin} points ahead of ${modelDisplayName(runnerUp.model)}, the next closest model.`
    : runnerUp
      ? ` It is tied with ${modelDisplayName(runnerUp.model)} on average, so the per-lens notes are especially important for choosing the operational fit.`
      : '';
  const contextBoosts = [
    event.severity === 'Sev 1' ? 'Sev 1 alerts add weight to triage speed and fallback routing' : undefined,
    /monitor|metrics|logs|query|cpu|latency|throttl/i.test(event.signal) ? 'metric-heavy signals add weight to validation-query quality' : undefined,
  ].filter(Boolean).join('; ');
  const boostText = contextBoosts ? ` Context adjustment: ${contextBoosts}.` : ' No event-specific boost is applied to this alert.';

  return `Technical explanation: each lens starts with a curated model capability score, then applies alert-context boosts and caps the result at 100. The final average is the rounded mean of those ten lens scores.${boostText}${leadText}`;
}

const microsoftServices = [
  {
    name: 'Microsoft Entra External ID',
    role: 'Subscriber identity and consent capture',
    icon: KeyRound,
    color: '#7c3aed',
  },
  {
    name: 'Azure Functions',
    role: 'Subscription API, preference updates, and webhook handlers',
    icon: Cloud,
    color: '#0f6cbd',
  },
  {
    name: 'Azure Notification Hubs',
    role: 'Fan-out to Web Push, iOS, Android, and segmented audiences',
    icon: RadioTower,
    color: '#0078d4',
  },
  {
    name: 'Azure Communication Services',
    role: 'Email and SMS fallback for high-priority notifications',
    icon: Mail,
    color: '#16a34a',
  },
  {
    name: 'Azure Cosmos DB',
    role: 'Subscriber profiles, tags, delivery logs, and audit state',
    icon: Database,
    color: '#0891b2',
  },
  {
    name: 'Microsoft Graph',
    role: 'Optional Teams or Outlook notification workflows',
    icon: MessageSquareText,
    color: '#ca5010',
  },
];

const sampleApps = [
  {
    service: 'Microsoft Entra External ID',
    title: 'Consent & Profile Center',
    audience: 'End users',
    surface: 'Hosted sign-up and preference consent screen',
    status: 'Ready for sign-up',
    icon: KeyRound,
    color: '#7c3aed',
    preview: [
      'Sign in with Microsoft or email one-time passcode',
      'Choose notification topics and consent language',
      'Manage account, delete profile, or export preferences',
    ],
    primaryAction: 'Subscribe with Entra',
  },
  {
    service: 'Azure Functions',
    title: 'Subscription API Console',
    audience: 'Developers',
    surface: 'Webhook intake and delivery function dashboard',
    status: '3 handlers active',
    icon: Cloud,
    color: '#0f6cbd',
    preview: [
      'POST /subscriptions validates user and topic payloads',
      'PUT /preferences updates tags and throttling rules',
      'POST /events maps business events to notification jobs',
    ],
    primaryAction: 'Run test event',
  },
  {
    service: 'Azure Notification Hubs',
    title: 'Campaign Fan-out Desk',
    audience: 'Operations teams',
    surface: 'Segmented push campaign composer',
    status: '12.4k devices targeted',
    icon: RadioTower,
    color: '#0078d4',
    preview: [
      'Pick tags such as product-updates, ios-pwa, or critical',
      'Preview iOS Home Screen web push and browser push copy',
      'Track accepted, failed, expired, and unregistered devices',
    ],
    primaryAction: 'Send campaign',
  },
  {
    service: 'Azure Communication Services',
    title: 'Fallback Message Studio',
    audience: 'Support and marketing',
    surface: 'Email and SMS fallback template editor',
    status: 'Fallback armed',
    icon: Mail,
    color: '#16a34a',
    preview: [
      'Design email and SMS variants for high-priority events',
      'Use fallback when push permission is denied or offline',
      'Review delivery status, bounces, and suppression rules',
    ],
    primaryAction: 'Preview fallback',
  },
  {
    service: 'Azure Cosmos DB',
    title: 'Preference & Audit Explorer',
    audience: 'Administrators',
    surface: 'Subscriber profile, tags, and delivery log viewer',
    status: 'Indexed by segment',
    icon: Database,
    color: '#0891b2',
    preview: [
      'Browse subscriber topics, channels, and consent history',
      'Inspect delivery attempts and retry metadata by event id',
      'Filter users by segment, region, channel, and permission state',
    ],
    primaryAction: 'Open audit log',
  },
  {
    service: 'Microsoft Graph',
    title: 'Teams & Outlook Workflow',
    audience: 'Microsoft 365 users',
    surface: 'Teams card and Outlook notification preview',
    status: 'Graph connector optional',
    icon: MessageSquareText,
    color: '#ca5010',
    preview: [
      'Post Teams adaptive cards for internal incidents',
      'Create Outlook reminders for digest or approval workflows',
      'Route notification actions back to Azure Functions webhooks',
    ],
    primaryAction: 'Preview Teams card',
  },
];

const consumerPatterns = [
  {
    name: 'Service Health Triage',
    scenario: 'Notify operators when Azure Service Health reports an active platform incident or advisory.',
    audience: 'Cloud operations team',
    channel: 'Teams + Web Push',
    trigger: 'Azure Service Health advisory created',
    tone: 'Operational, specific, evidence-based',
    title: 'Azure service advisory opened',
    body: 'Canada East has a new Service Health advisory. Review impacted resources and customer-facing dependencies.',
    cta: 'Open triage view',
    color: '#0f6cbd',
    icon: Cloud,
    steps: ['Detect advisory', 'Map resources', 'Notify owners', 'Track mitigation'],
  },
  {
    name: 'Notification Hub Failures',
    scenario: 'Escalate when push delivery acceptance drops or APNS/FCM failures spike.',
    audience: 'Messaging owners',
    channel: 'Push + SMS fallback',
    trigger: 'Accepted delivery rate below threshold',
    tone: 'Urgent, actionable, fallback-aware',
    title: 'Push delivery degradation',
    body: 'Notification Hubs accepted rate is below target. Enable ACS fallback for critical alert subscribers.',
    cta: 'Enable fallback',
    color: '#16a34a',
    icon: RadioTower,
    steps: ['Detect failures', 'Enable fallback', 'Clean tokens', 'Confirm recovery'],
  },
  {
    name: 'Function Error Burst',
    scenario: 'Page the service team when Azure Functions handlers begin returning elevated 5xx responses.',
    audience: 'API responders',
    channel: 'Pager + Teams',
    trigger: 'HTTP 500 rate exceeds 8%',
    tone: 'Precise, diagnostic, owner-focused',
    title: 'Webhook handler error burst',
    body: 'The /events handler is returning elevated 500s. Check recent deployments and Application Insights traces.',
    cta: 'Open traces',
    color: '#ca5010',
    icon: Gauge,
    steps: ['Detect 5xx burst', 'Page owner', 'Inspect traces', 'Rollback or patch'],
  },
  {
    name: 'Certificate Renewal Risk',
    scenario: 'Warn platform owners before HTTPS renewal or ACME rate limits threaten public endpoints.',
    audience: 'Platform engineers',
    channel: 'Teams + Email',
    trigger: 'TLS renewal failure or issuance throttle',
    tone: 'High-confidence, preventive, time-bound',
    title: 'TLS renewal needs attention',
    body: 'Certificate automation is at risk for the public notification endpoint. Freeze DNS changes and validate renewal state.',
    cta: 'Review certificate',
    color: '#dc2626',
    icon: ShieldAlert,
    steps: ['Detect renewal risk', 'Freeze host changes', 'Validate cert', 'Confirm HTTPS'],
  },
  {
    name: 'Cosmos DB Throttling',
    scenario: 'Notify data owners when preference writes or delivery audit queries hit RU pressure.',
    audience: 'Data platform owners',
    channel: 'Email + Teams',
    trigger: 'RU consumption above 95%',
    tone: 'Measured, capacity-focused, remediation-ready',
    title: 'Preference store throttling',
    body: 'Cosmos DB is throttling notification preference writes. Increase RU capacity or reduce non-critical audit reads.',
    cta: 'Open metrics',
    color: '#9333ea',
    icon: Database,
    steps: ['Detect RU pressure', 'Scale throughput', 'Throttle reads', 'Verify writes'],
  },
  {
    name: 'ACR Pull Failure',
    scenario: 'Alert release owners when a container restart cannot pull the expected frontend or API image.',
    audience: 'Release engineers',
    channel: 'Deployment feed + Teams',
    trigger: 'ImagePullBackOff or registry auth failure',
    tone: 'Direct, release-safe, rollback-aware',
    title: 'Container image pull failed',
    body: 'Azure Container Instances cannot pull the configured image. Verify ACR credentials and image tag availability.',
    cta: 'Check deployment',
    color: '#0891b2',
    icon: Send,
    steps: ['Detect pull error', 'Check tag', 'Refresh credentials', 'Redeploy safely'],
  },
];

const iosBehaviors = [
  ['Install', 'Safari -> Share -> Add to Home Screen'],
  ['App icon', 'Manifest plus Apple touch icon'],
  ['Full-screen mode', 'Supported with iOS web app meta tags'],
  ['Offline support', 'Service Worker app shell cache'],
  ['Push notifications', 'iOS/iPadOS 16.4+ for Home Screen web apps'],
  ['Background sync', 'Limited compared with Android'],
  ['App Store', 'Not required'],
  ['Browser engine', 'Runs on WebKit/Safari engine'],
];

const eventStream = [
  'Subscriber created from web or iOS PWA',
  'Preference tags written to Cosmos DB',
  'Event Grid receives a product update',
  'Azure Function resolves target segment',
  'Notification Hub fans out push notifications',
  'ACS sends fallback email for critical alerts',
];

const seedSubscribers: Subscriber[] = [
  {
    id: 'sub-1001',
    name: 'Avery Chen',
    email: 'avery@contoso.com',
    channel: 'Teams + Web Push',
    segment: 'Azure Service Health',
    frequency: 'Instant',
    createdAt: 'Today 09:12',
  },
  {
    id: 'sub-1002',
    name: 'Mina Patel',
    email: 'mina@fabrikam.com',
    channel: 'Email',
    segment: 'Troubleshooting digest',
    frequency: 'Daily digest',
    createdAt: 'Yesterday 16:44',
  },
];

type CriticalAzureEventItem = (typeof criticalAzureEvents)[number];

function severityLabel(event: CriticalAzureEventItem): string {
  if (event.severity === 'Sev 1') return 'Immediate page';
  if (event.severity === 'Sev 2') return 'Active triage';
  return 'Monitor closely';
}

function responseWindow(event: CriticalAzureEventItem): string {
  if (event.severity === 'Sev 1') return 'Acknowledge in 5 minutes';
  if (event.severity === 'Sev 2') return 'Acknowledge in 15 minutes';
  return 'Review within 30 minutes';
}

function ownerFromEvent(event: CriticalAzureEventItem): string {
  return event.messages[0]?.audience || 'Platform on-call';
}

function fallbackPath(event: CriticalAzureEventItem): string {
  const fallback = event.messages.find((message) => /fallback|sms|email|stakeholder/i.test(`${message.channel} ${message.audience} ${message.style}`));
  return fallback ? `${fallback.channel} to ${fallback.audience}` : 'Teams incident card plus service-owner email';
}

function validationQuery(event: CriticalAzureEventItem): string {
  const service = event.service.replace(/^Azure\s+/i, '').replace(/^Microsoft\s+/i, '');
  return `AzureMetrics | where TimeGenerated > ago(30m) | where ResourceProvider has "${service}" | summarize max(Maximum) by bin(TimeGenerated, 5m)`;
}

function eventReviewDetails(event: CriticalAzureEventItem) {
  return {
    status: severityLabel(event),
    window: responseWindow(event),
    owner: ownerFromEvent(event),
    fallback: fallbackPath(event),
    query: validationQuery(event),
    firstActions: [
      'Confirm the metric breach and scope in Azure Monitor.',
      `Assign ${ownerFromEvent(event).toLowerCase()} as the first responder.`,
      'Send the operator alert first, then use fallback channels if delivery is degraded.',
    ],
  };
}

export function NotificationPlatform() {
  const [subscribers, setSubscribers] = useState<Subscriber[]>(seedSubscribers);
  const [selectedEventId, setSelectedEventId] = useState(criticalAzureEvents[0].id);
  const [availableModels, setAvailableModels] = useState<string[]>([]);
  const [selectedModels, setSelectedModels] = useState<string[]>(slmShowcaseModels);
  const [analyses, setAnalyses] = useState<SlmAnalysis[]>(() => slmShowcaseModels.map((model) => ({ model, text: demoModelAnalysis[model], source: 'demo' })));
  const [analyzing, setAnalyzing] = useState(false);
  const [analysisMessage, setAnalysisMessage] = useState('Model Comparison Engine demo examples are shown until you run a live SLM comparison.');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [segment, setSegment] = useState('Azure Service Health');
  const [channel, setChannel] = useState('Teams + Web Push');
  const [frequency, setFrequency] = useState('Instant');
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [online, setOnline] = useState(navigator.onLine);
  const [message, setMessage] = useState('');
  const [alertSearch, setAlertSearch] = useState('');
  const [alertSeverity, setAlertSeverity] = useState('All severities');
  const [alertService, setAlertService] = useState('All services');
  const [visibleAlertCount, setVisibleAlertCount] = useState(INITIAL_ALERT_VISIBLE_COUNT);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSubscribers(JSON.parse(saved) as Subscriber[]);
      } catch {
        setSubscribers(seedSubscribers);
      }
    }

    if ('Notification' in window) setPermission(Notification.permission);
    else setPermission('unsupported');

    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(subscribers));
  }, [subscribers]);

  useEffect(() => {
    listModels().then((models) => {
      setAvailableModels(models);
      const usable = slmShowcaseModels.filter((model) => models.some((availableModel) => modelMatchesAvailable(model, availableModel)));
      if (usable.length) {
        const defaultSelection = usable;
        setSelectedModels(defaultSelection);
        setAnalyses(defaultSelection.map((model) => ({ model, text: demoModelAnalysis[model], source: 'demo' })));
      }
    });
  }, []);

  async function requestPermission() {
    if (!('Notification' in window)) {
      setPermission('unsupported');
      setMessage('This browser does not expose the Web Notifications API.');
      return;
    }

    const result = await Notification.requestPermission();
    setPermission(result);
    setMessage(
      result === 'granted'
        ? 'Notifications are enabled for this browser. On iOS, install the PWA to Home Screen first.'
        : 'Notification permission was not granted.'
    );
  }

  async function sendTestNotification() {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
      setMessage('Enable notification permission before sending a test notification.');
      return;
    }

    if ('serviceWorker' in navigator) {
      const registration = await navigator.serviceWorker.ready;
      await registration.showNotification('Notify Hub test', {
        body: `New ${segment.toLowerCase()} update for subscribed users.`,
        icon: '/pwa-icon.svg',
        badge: '/pwa-icon.svg',
      });
      setMessage('Test notification sent through the service worker.');
      return;
    }

    new Notification('Notify Hub test', {
      body: `New ${segment.toLowerCase()} update for subscribed users.`,
      icon: '/pwa-icon.svg',
    });
    setMessage('Test notification sent through the browser notification API.');
  }

  function addSubscriber() {
    if (!email.trim()) {
      setMessage('Enter an email address before subscribing.');
      return;
    }

    const subscriber: Subscriber = {
      id: `sub-${Math.floor(1000 + Math.random() * 9000)}`,
      name: name.trim() || 'New subscriber',
      email: email.trim(),
      channel,
      segment,
      frequency,
      createdAt: 'Just now',
    };

    setSubscribers([subscriber, ...subscribers]);
    setName('');
    setEmail('');
    setMessage(`${subscriber.email} subscribed to ${subscriber.segment}.`);
  }

  function toggleModel(model: string) {
    setSelectedModels((current) => {
      if (current.includes(model)) return current.filter((item) => item !== model);
      return [...current, model].slice(-4);
    });
  }

  async function runSlmComparison() {
    const event = criticalAzureEvents.find((item) => item.id === selectedEventId) ?? criticalAzureEvents[0];
    const models = selectedModels.length ? selectedModels : [DEFAULT_MODEL];
    setAnalyzing(true);
    setAnalysisMessage(`Running ${models.length} model comparison against ${getOllamaUrl()}.`);

    const messages: ChatMessage[] = [
      {
        role: 'system',
        content: 'You are an Azure incident response assistant. Return a concise operator note with: severity, likely impact, immediate action, fallback notification path, and one validation query. Keep it under 90 words.',
      },
      {
        role: 'user',
        content: `Critical Azure event:\nService: ${event.service}\nSeverity: ${event.severity}\nRegion: ${event.region}\nSignal: ${event.signal}\nImpact: ${event.impact}\nRaw payload: ${event.payload}`,
      },
    ];

    const results = await Promise.all(models.map(async (model): Promise<SlmAnalysis> => {
      try {
        const result = await chatMetrics(messages, { model });
        return {
          model,
          text: result.text.trim() || demoModelAnalysis[model] || 'No response returned by the model.',
          source: 'live',
          totalMs: result.totalMs,
          tokensPerSec: result.tokensPerSec,
        };
      } catch (error) {
        return {
          model,
          text: demoModelAnalysis[model] || 'Demo fallback: classify the event, summarize impact, choose fallback channels, and assign an owner.',
          source: 'demo',
          error: error instanceof Error ? error.message : 'Ollama request failed.',
        };
      }
    }));

    setAnalyses(results);
    setAnalysisMessage(results.some((result) => result.source === 'live') ? 'Live model responses are shown where available; failed models kept their demo examples.' : 'Ollama was not reachable for these models, so demo examples are shown.');
    setAnalyzing(false);
  }

  const pushReady = permission === 'granted';
  const webPushCount = subscribers.filter((subscriber) => subscriber.channel.includes('Push')).length;
  const selectedEvent = criticalAzureEvents.find((event) => event.id === selectedEventId) ?? criticalAzureEvents[0];
  const configuredSet = new Set(slmShowcaseModels);
  const alertServices = Array.from(new Set(criticalAzureEvents.map((event) => event.service))).sort();
  const filteredAzureEvents = criticalAzureEvents.filter((event) => {
    const search = alertSearch.trim().toLowerCase();
    const matchesSearch = !search || [event.title, event.service, event.severity, event.signal, event.impact].some((value) => value.toLowerCase().includes(search));
    const matchesSeverity = alertSeverity === 'All severities' || event.severity === alertSeverity;
    const matchesService = alertService === 'All services' || event.service === alertService;
    return matchesSearch && matchesSeverity && matchesService;
  });
  const visibleAzureEvents = filteredAzureEvents.slice(0, visibleAlertCount);
  const hiddenAlertCount = Math.max(filteredAzureEvents.length - visibleAzureEvents.length, 0);
  const severityCounts = ['Sev 1', 'Sev 2', 'Sev 3'].map((severity) => ({
    severity,
    count: criticalAzureEvents.filter((event) => event.severity === severity).length,
  }));
  const selectedEventReview = eventReviewDetails(selectedEvent);

  function updateAlertSearch(value: string) {
    setAlertSearch(value);
    setVisibleAlertCount(INITIAL_ALERT_VISIBLE_COUNT);
  }

  function updateAlertSeverity(value: string) {
    setAlertSeverity(value);
    setVisibleAlertCount(INITIAL_ALERT_VISIBLE_COUNT);
  }

  function updateAlertService(value: string) {
    setAlertService(value);
    setVisibleAlertCount(INITIAL_ALERT_VISIBLE_COUNT);
  }

  return (
    <div className="mx-auto w-full max-w-none space-y-6 2xl:max-w-7xl">
      <section className="overflow-hidden rounded-2xl border bg-slate-950 text-white shadow-sm">
        <div className="grid gap-6 p-6 lg:grid-cols-[1.2fr_0.8fr] lg:p-8">
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-sky-300/30 bg-sky-300/10 px-3 py-1 text-sm text-sky-100">
                <BellRing className="h-4 w-4" />
                Azure Service Troubleshooting
              </div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/30 bg-emerald-300/10 px-3 py-1 text-sm font-semibold text-emerald-100">
                <MessageSquareText className="h-4 w-4" />
                Model Comparison Engine
              </div>
            </div>
            <div>
              <h2 className="text-3xl font-semibold tracking-tight md:text-4xl">
                Compare small language models for Azure incident response
              </h2>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-300">
                Select an Azure Monitor alert and compare how each local SLM handles triage speed,
                reasoning depth, Azure operations fit, customer clarity, validation quality, and runtime cost.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <Metric label="Azure alerts" value={criticalAzureEvents.length.toString()} tone="blue" />
              <Metric label="Models selected" value={selectedModels.length.toString()} tone="green" />
              <Metric label="Comparison lenses" value={modelComparisonDimensions.length.toString()} tone="amber" />
            </div>
          </div>

          <div className="rounded-2xl border border-white/10 bg-white/10 p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-slate-300">Comparison workflow</p>
                <h3 className="mt-1 text-xl font-semibold">Pick the right model for the incident</h3>
              </div>
              <MessageSquareText className="h-9 w-9 text-sky-200" />
            </div>
            <ol className="mt-5 space-y-3 text-sm text-slate-200">
              <li className="flex gap-3"><StepNumber value="1" /> Select the Azure alert that matches the current incident.</li>
              <li className="flex gap-3"><StepNumber value="2" /> Choose the local models you want to compare.</li>
              <li className="flex gap-3"><StepNumber value="3" /> Review the best-fit score and the per-lens rationale.</li>
            </ol>
            <div className="mt-5 rounded-xl bg-slate-950/50 p-3 text-xs leading-5 text-slate-300">
              Scores are guidance for operator decisions. For Sev 1 incidents, prioritize fast triage, fallback routing, and validation quality before sending status updates.
            </div>
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-white shadow-sm">
        <div className="border-b border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Critical Azure events</p>
              <h3 className="mt-1 text-2xl font-semibold text-slate-950">Azure incident alert library</h3>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
                Select a realistic Azure signal, then compare which local model is best suited for triage, customer messaging, validation, and operational follow-up.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <div className="rounded-full bg-red-50 px-3 py-1 text-xs font-semibold text-red-700">
                {criticalAzureEvents.length} critical samples
              </div>
              {severityCounts.map((item) => (
                <div key={item.severity} className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200">
                  {item.count} {item.severity}
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0 2xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
          <div className="min-w-0 border-b border-slate-200 p-5 2xl:border-b-0 2xl:border-r">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Event inbox</p>
                <h4 className="mt-1 text-lg font-semibold text-slate-950">Azure Monitor alerts</h4>
              </div>
              <ShieldAlert className="h-7 w-7 text-red-600" />
            </div>
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <label className="relative block">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  value={alertSearch}
                  onChange={(event) => updateAlertSearch(event.target.value)}
                  className="h-10 w-full rounded-xl border border-slate-200 bg-white pl-9 pr-3 text-sm outline-none transition focus:border-sky-500 focus:ring-2 focus:ring-sky-100"
                  placeholder="Search service, signal, or alert title"
                />
              </label>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                <select value={alertSeverity} onChange={(event) => updateAlertSeverity(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                  <option>All severities</option>
                  <option>Sev 1</option>
                  <option>Sev 2</option>
                  <option>Sev 3</option>
                </select>
                <select value={alertService} onChange={(event) => updateAlertService(event.target.value)} className="h-9 rounded-lg border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700">
                  <option>All services</option>
                  {alertServices.map((service) => (
                    <option key={service}>{service}</option>
                  ))}
                </select>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{filteredAzureEvents.length} matching alerts</span>
                {(alertSearch || alertSeverity !== 'All severities' || alertService !== 'All services') && (
                  <button
                    type="button"
                    onClick={() => {
                      setAlertSearch('');
                      setAlertSeverity('All severities');
                      setAlertService('All services');
                      setVisibleAlertCount(INITIAL_ALERT_VISIBLE_COUNT);
                    }}
                    className="font-semibold text-sky-700 hover:text-sky-900"
                  >
                    Reset filters
                  </button>
                )}
              </div>
            </div>
            <div className="mt-4 space-y-2">
              {visibleAzureEvents.map((event) => (
                <CriticalEventButton
                  key={event.id}
                  event={event}
                  selected={event.id === selectedEventId}
                  onSelect={() => setSelectedEventId(event.id)}
                />
              ))}
              {filteredAzureEvents.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-600">
                  No Azure Monitor alerts match the current filters.
                </div>
              )}
              {hiddenAlertCount > 0 && (
                <button
                  type="button"
                  onClick={() => setVisibleAlertCount((count) => count + INITIAL_ALERT_VISIBLE_COUNT)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-50"
                >
                  Show {Math.min(hiddenAlertCount, INITIAL_ALERT_VISIBLE_COUNT)} more alerts
                </button>
              )}
            </div>
          </div>

          <div className="min-w-0 p-5">
            <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-4">
              <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Model Comparison Engine</p>
                    <h4 className="mt-1 text-lg font-semibold text-slate-950">Compare SLM responses</h4>
                  </div>
                  <MessageSquareText className="h-7 w-7 text-sky-700" />
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1">
                  {slmShowcaseModels.map((model) => {
                    const checked = selectedModels.includes(model);
                    const installed = availableModels.some((availableModel) => modelMatchesAvailable(model, availableModel));
                    const configured = configuredSet.has(model);
                    const status = installed ? 'Ready' : configured ? 'In deployment' : 'Demo fallback';
                    return (
                      <button
                        key={model}
                        type="button"
                        aria-label={`${modelDisplayName(model)} ${status}`}
                        onClick={() => toggleModel(model)}
                        className={cn(
                          'flex min-w-0 items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition',
                          checked ? 'border-sky-500 bg-sky-50 text-sky-800' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                        )}
                      >
                        <span className="min-w-0 pr-2">
                          <span className="block truncate font-semibold">{modelDisplayName(model)}</span>
                          <span className="mt-0.5 block truncate text-[11px] font-medium text-slate-500">{model}</span>
                        </span>
                        <span className={cn('shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold', installed ? 'bg-emerald-50 text-emerald-700' : configured ? 'bg-sky-50 text-sky-700' : 'bg-amber-50 text-amber-700')}>
                          {status}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <ModelComparisonMatrix models={selectedModels} event={selectedEvent} />
                <button
                  type="button"
                  onClick={runSlmComparison}
                  disabled={analyzing || selectedModels.length === 0}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <Send className={cn('h-4 w-4', analyzing && 'animate-pulse')} />
                  {analyzing ? 'Running engine...' : 'Run Model Comparison Engine'}
                </button>
                <p className="mt-3 text-xs leading-5 text-slate-500">{analysisMessage}</p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

function Metric({ label, value, tone }: { label: string; value: string; tone: 'blue' | 'green' | 'amber' }) {
  const colors = {
    blue: 'bg-sky-400/15 text-sky-100 ring-sky-300/20',
    green: 'bg-emerald-400/15 text-emerald-100 ring-emerald-300/20',
    amber: 'bg-amber-400/15 text-amber-100 ring-amber-300/20',
  };

  return (
    <div className={cn('rounded-xl px-4 py-3 ring-1', colors[tone])}>
      <div className="text-2xl font-semibold">{value}</div>
      <div className="text-xs uppercase tracking-wider opacity-80">{label}</div>
    </div>
  );
}

function StepNumber({ value }: { value: string }) {
  return (
    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-sky-300 text-xs font-bold text-slate-950">
      {value}
    </span>
  );
}

function CriticalEventButton({ event, selected, onSelect }: { event: CriticalAzureEventItem; selected: boolean; onSelect: () => void }) {
  const Icon = event.icon;

  return (
    <div
      className={cn(
        'block w-full rounded-xl border p-3 text-left transition',
        selected ? 'border-red-300 bg-red-50 shadow-sm' : 'border-slate-200 bg-white hover:bg-slate-50'
      )}
    >
      <button type="button" onClick={onSelect} className="flex w-full items-start gap-2.5 text-left">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: `${event.color}18`, color: event.color }}>
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h5 className="text-sm font-semibold text-slate-950">{event.title}</h5>
            <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-semibold', event.severity === 'Sev 1' ? 'bg-red-100 text-red-700' : event.severity === 'Sev 2' ? 'bg-orange-100 text-orange-700' : 'bg-amber-100 text-amber-700')}>
              {event.severity}
            </span>
          </div>
          <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-slate-500">{event.service} · {event.time}</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">{event.signal}</p>
        </div>
      </button>
      <div className="mt-2 flex flex-wrap items-center gap-2 pl-10 text-[11px] font-semibold">
        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-sky-700">{event.messages.length} variations</span>
        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">{responseWindow(event)}</span>
        <Link to="/apps/notifications/$eventId" params={{ eventId: event.id }} className="text-sky-700 hover:text-sky-900">
          Open full detail
        </Link>
      </div>
    </div>
  );
}

function ReviewDetailCard({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-5 text-slate-600">{detail}</p>
    </div>
  );
}

function DarkFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/10">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-white">{value}</p>
    </div>
  );
}

function formatSlmNote(text: string): { sections: Array<{ label: string; value: string }>; paragraphs: string[]; code?: string } {
  const codeMatch = text.match(/```(?:\w+)?\s*([\s\S]*?)```/);
  const code = codeMatch?.[1]?.trim();
  const withoutCode = text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\*\*/g, '')
    .replace(/\bOperator Note:?/gi, '')
    .replace(/\s+(Severity|Region|Signal|Impact|Likely Impact|Immediate Action|Fallback Notification Path|Validation Query|Raw payload):/gi, '\n$1:')
    .replace(/\n\s*\*\s+/g, '\n')
    .trim();

  const labelMap: Record<string, string> = {
    severity: 'Severity',
    region: 'Region',
    signal: 'Signal',
    impact: 'Impact',
    'likely impact': 'Likely Impact',
    'immediate action': 'Immediate Action',
    'fallback notification path': 'Fallback Path',
    'validation query': 'Validation Query',
    'raw payload': 'Raw Payload',
  };

  const sections: Array<{ label: string; value: string }> = [];
  const paragraphs: string[] = [];

  for (const line of withoutCode.split('\n').map((item) => item.trim()).filter(Boolean)) {
    const match = line.match(/^([A-Za-z ]+):\s*(.+)$/);
    if (match) {
      const key = match[1].trim().toLowerCase();
      sections.push({ label: labelMap[key] ?? match[1].trim(), value: match[2].trim() });
    } else {
      paragraphs.push(line.replace(/^[-*]\s*/, ''));
    }
  }

  return { sections, paragraphs, code };
}

function SlmNoteSection({ label, value }: { label: string; value: string }) {
  const tone = label.toLowerCase().includes('severity')
    ? 'border-red-100 bg-red-50 text-red-900'
    : label.toLowerCase().includes('action')
      ? 'border-sky-100 bg-sky-50 text-sky-900'
      : label.toLowerCase().includes('fallback')
        ? 'border-amber-100 bg-amber-50 text-amber-900'
        : 'border-slate-200 bg-slate-50 text-slate-900';

  return (
    <div className={cn('rounded-xl border p-3', tone)}>
      <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
      <p className="mt-1 text-sm leading-5">{value}</p>
    </div>
  );
}

function ModelComparisonMatrix({ models, event }: { models: string[]; event: CriticalAzureEventItem }) {
  const comparedModels = models.length ? models : slmShowcaseModels;
  const ranked = comparedModels
    .map((model) => ({
      model,
      average: Math.round(modelComparisonDimensions.reduce((total, dimension) => total + comparisonScore(model, dimension, event), 0) / modelComparisonDimensions.length),
    }))
    .sort((left, right) => right.average - left.average);
  const leader = ranked[0];

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">10-way comparison engine</p>
          <h5 className="mt-1 text-sm font-semibold text-slate-950">Best fit: {leader ? modelDisplayName(leader.model) : 'Select a model'}</h5>
        </div>
        {leader && (
          <span className="rounded-full bg-slate-950 px-2.5 py-1 text-xs font-semibold text-white">
            {leader.average}/100 avg
          </span>
        )}
      </div>
      <p className="mt-2 text-xs leading-5 text-slate-600">{leaderFitReason(leader, event)}</p>
      <div className="mt-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Technical explanation</p>
        <p className="mt-1 text-xs leading-5 text-slate-600">{leaderTechnicalExplanation(leader, ranked, event)}</p>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">How to read</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Each lens scores the selected models from 0-100 for one operational decision.</p>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Why it wins</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">The recommended model is the highest scoring option for that lens after alert context is applied.</p>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">When to override</p>
          <p className="mt-1 text-xs leading-5 text-slate-600">Pick another model when speed, cost, customer tone, or validation depth matters more than the average.</p>
        </div>
      </div>

      <div className="mt-3 space-y-2">
        {modelComparisonDimensions.map((dimension) => {
          const bestModel = comparedModels
            .map((model) => ({ model, score: comparisonScore(model, dimension, event) }))
            .sort((left, right) => right.score - left.score)[0];

          return (
            <div key={dimension.id} className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-950">{dimension.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-500">{dimension.description}</p>
                </div>
                <span className="shrink-0 rounded-full bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 ring-1 ring-slate-200">
                  {dimension.bestFor}
                </span>
              </div>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {comparedModels.map((model) => {
                  const score = comparisonScore(model, dimension, event);
                  return (
                    <div key={`${dimension.id}-${model}`} className="min-w-0 rounded-lg bg-slate-50 p-2 ring-1 ring-slate-100">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs font-semibold text-slate-700">{modelDisplayName(model)}</span>
                        <span className={cn('rounded-full px-2 py-0.5 text-[11px] font-bold ring-1', comparisonTone(score))}>{score}</span>
                      </div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-200">
                        <div className="h-full rounded-full bg-sky-600" style={{ width: `${score}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
              {bestModel && (
                <div className="mt-3 rounded-xl bg-slate-50 p-3 ring-1 ring-slate-100">
                  <p className="text-xs font-semibold text-slate-700">Recommended for this lens: {modelDisplayName(bestModel.model)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{dimensionFitReason(bestModel.model, dimension, bestModel.score, event)}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{lensRecommendationDetail(bestModel.model, dimension, bestModel.score, comparedModels, event)}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function SlmAnalysisCard({ analysis }: { analysis: SlmAnalysis }) {
  const note = formatSlmNote(analysis.text);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 bg-slate-50 p-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">SLM processor</p>
          <h5 className="mt-1 text-lg font-semibold text-slate-950">{analysis.model}</h5>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-xs font-semibold', analysis.source === 'live' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600')}>
          {analysis.source === 'live' ? 'live Ollama' : 'demo example'}
        </span>
      </div>
      <div className="space-y-4 p-4">
        {(note.sections.length > 0 || note.paragraphs.length > 0) && (
          <div className="rounded-2xl border border-slate-200 bg-white p-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Review note</p>
            {note.paragraphs.length > 0 && (
              <div className="mt-3 space-y-2">
                {note.paragraphs.map((paragraph) => (
                  <p key={paragraph} className="text-sm leading-6 text-slate-700">{paragraph}</p>
                ))}
              </div>
            )}
            {note.sections.length > 0 && (
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                {note.sections.map((section) => (
                  <SlmNoteSection key={`${section.label}-${section.value}`} label={section.label} value={section.value} />
                ))}
              </div>
            )}
            {note.code && (
              <div className="mt-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-950">
                <div className="border-b border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Validation query</div>
                <pre className="overflow-x-auto p-3 text-xs leading-5 text-slate-100"><code>{note.code}</code></pre>
              </div>
            )}
          </div>
        )}
        {analysis.error && (
          <div className="rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-800 ring-1 ring-amber-100">
            {analysis.error}
          </div>
        )}
        {analysis.source === 'live' && (
          <div className="grid gap-2 sm:grid-cols-2">
            <PatternFact label="Latency" value={`${analysis.totalMs ?? 0} ms`} />
            <PatternFact label="Throughput" value={`${(analysis.tokensPerSec ?? 0).toFixed(1)} tok/s`} />
          </div>
        )}
      </div>
    </article>
  );
}

function SampleAppCard({ app }: { app: (typeof sampleApps)[number] }) {
  const Icon = app.icon;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="border-b border-slate-200 bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${app.color}18`, color: app.color }}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{app.service}</p>
              <h4 className="mt-1 text-lg font-semibold text-slate-950">{app.title}</h4>
            </div>
          </div>
          <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
            {app.status}
          </span>
        </div>
      </div>
      <div className="space-y-4 p-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Audience</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{app.audience}</p>
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Surface</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{app.surface}</p>
          </div>
        </div>
        <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Live preview</p>
            <button className="rounded-lg px-2.5 py-1 text-xs font-semibold text-white" style={{ backgroundColor: app.color }}>
              {app.primaryAction}
            </button>
          </div>
          <ul className="space-y-2">
            {app.preview.map((item) => (
              <li key={item} className="flex gap-2 text-sm leading-5 text-slate-700">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function ConsumerPatternCard({ pattern }: { pattern: (typeof consumerPatterns)[number] }) {
  const Icon = pattern.icon;

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 shadow-sm">
      <div className="bg-white p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl" style={{ backgroundColor: `${pattern.color}18`, color: pattern.color }}>
              <Icon className="h-5 w-5" />
            </span>
            <div>
              <h4 className="text-lg font-semibold text-slate-950">{pattern.name}</h4>
              <p className="mt-1 text-sm leading-5 text-slate-600">{pattern.scenario}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid gap-4 border-t border-slate-200 p-4 xl:grid-cols-[0.9fr_1.1fr]">
        <div className="rounded-[1.75rem] bg-slate-950 p-2 shadow-inner">
          <div className="rounded-[1.35rem] bg-slate-100 p-3">
            <div className="mx-auto mb-3 h-1.5 w-16 rounded-full bg-slate-300" />
            <div className="rounded-2xl bg-white p-3 shadow-sm ring-1 ring-slate-200">
              <div className="flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg text-white" style={{ backgroundColor: pattern.color }}>
                  <Icon className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Notify Hub</p>
                  <p className="text-xs text-slate-400">now</p>
                </div>
              </div>
              <h5 className="mt-3 text-sm font-semibold text-slate-950">{pattern.title}</h5>
              <p className="mt-1 text-sm leading-5 text-slate-600">{pattern.body}</p>
              <button className="mt-3 w-full rounded-lg px-3 py-2 text-xs font-semibold text-white" style={{ backgroundColor: pattern.color }}>
                {pattern.cta}
              </button>
            </div>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
            <PatternFact label="Audience" value={pattern.audience} />
            <PatternFact label="Channel" value={pattern.channel} />
            <PatternFact label="Trigger" value={pattern.trigger} />
            <PatternFact label="Tone" value={pattern.tone} />
          </div>
          <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Journey flow</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {pattern.steps.map((step, index) => (
                <span key={step} className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
                  {index + 1}. {step}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function PatternFact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white p-3 ring-1 ring-slate-200">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold leading-5 text-slate-900">{value}</p>
    </div>
  );
}

function ReadinessRow({
  icon: Icon,
  label,
  detail,
  ready,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  detail: string;
  ready: boolean;
}) {
  return (
    <div className="flex gap-3 rounded-xl border border-white/10 bg-white/5 p-3">
      <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', ready ? 'bg-emerald-400/15 text-emerald-200' : 'bg-amber-400/15 text-amber-200')}>
        <Icon className="h-5 w-5" />
      </span>
      <div>
        <div className="font-semibold">{label}</div>
        <div className="mt-0.5 text-sm text-slate-300">{detail}</div>
      </div>
    </div>
  );
}
