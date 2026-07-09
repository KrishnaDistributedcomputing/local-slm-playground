import { chatMetrics, type ChatMessage } from './ollama';
import type { CriticalAzureEvent } from './azureNotificationEvents';

export type ModelFamily = 'SLM' | 'LLM';
export type ModelHosting = 'Local' | 'Cloud' | 'Future';
export type ProviderKind = 'ollama' | 'azure-openai' | 'openai' | 'anthropic' | 'google' | 'custom';

export type ModelProviderConfig = {
  id: string;
  name: string;
  kind: ProviderKind;
  hosting: ModelHosting;
  endpointLabel: string;
  configurable: boolean;
};

export type BenchmarkModelConfig = {
  id: string;
  name: string;
  providerId: string;
  family: ModelFamily;
  hosting: ModelHosting;
  version: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsConfidence: boolean;
  supportsMemoryMetrics: boolean;
  inputCostPer1k: number;
  outputCostPer1k: number;
  capability: {
    reasoning: number;
    speed: number;
    cost: number;
    grounding: number;
    operations: number;
  };
};

export type BenchmarkParams = {
  temperature: number;
  maxTokens: number;
  systemPrompt: string;
};

export type BenchmarkResult = {
  id: string;
  modelId: string;
  model: string;
  provider: string;
  family: ModelFamily;
  hosting: ModelHosting;
  version: string;
  response: string;
  responseQuality: number;
  accuracy: number;
  hallucinationScore: number;
  confidenceScore?: number;
  latencyMs: number;
  timeToFirstTokenMs: number;
  totalExecutionMs: number;
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimatedCost: number;
  contextWindowUsage: number;
  memoryMb?: number;
  pass: boolean;
  overallScore: number;
  rank: number;
  responseSource: 'live' | 'simulated';
  requiredFields: Array<{ label: string; present: boolean }>;
  semanticSimilarity: number;
  completeness: number;
  validationNotes: string[];
  prompt: ChatMessage[];
  parameters: BenchmarkParams;
};

export type BenchmarkRun = {
  id: string;
  eventId: string;
  eventTitle: string;
  createdAt: string;
  modelIds: string[];
  parameters: BenchmarkParams;
  results: BenchmarkResult[];
};

export const modelProviders: ModelProviderConfig[] = [
  { id: 'ollama-local', name: 'Ollama Local Runtime', kind: 'ollama', hosting: 'Local', endpointLabel: 'Configured Ollama endpoint', configurable: true },
];

export const benchmarkModels: BenchmarkModelConfig[] = [
  { id: 'ollama-qwen25-05b', name: 'qwen2.5:0.5b', providerId: 'ollama-local', family: 'SLM', hosting: 'Local', version: '0.5b-instruct', contextWindow: 32768, maxOutputTokens: 512, supportsConfidence: false, supportsMemoryMetrics: true, inputCostPer1k: 0, outputCostPer1k: 0, capability: { reasoning: 54, speed: 94, cost: 100, grounding: 58, operations: 70 } },
  { id: 'ollama-llama32-1b', name: 'llama3.2:1b', providerId: 'ollama-local', family: 'SLM', hosting: 'Local', version: '1b-instruct', contextWindow: 131072, maxOutputTokens: 768, supportsConfidence: false, supportsMemoryMetrics: true, inputCostPer1k: 0, outputCostPer1k: 0, capability: { reasoning: 62, speed: 88, cost: 100, grounding: 63, operations: 76 } },
  { id: 'ollama-gemma2-2b', name: 'gemma2:2b', providerId: 'ollama-local', family: 'SLM', hosting: 'Local', version: '2b-it', contextWindow: 8192, maxOutputTokens: 768, supportsConfidence: false, supportsMemoryMetrics: true, inputCostPer1k: 0, outputCostPer1k: 0, capability: { reasoning: 67, speed: 78, cost: 100, grounding: 69, operations: 74 } },
  { id: 'ollama-phi3-mini', name: 'phi3:mini', providerId: 'ollama-local', family: 'SLM', hosting: 'Local', version: '3.8b-mini', contextWindow: 4096, maxOutputTokens: 768, supportsConfidence: false, supportsMemoryMetrics: true, inputCostPer1k: 0, outputCostPer1k: 0, capability: { reasoning: 70, speed: 72, cost: 100, grounding: 66, operations: 78 } },
];

export const defaultBenchmarkParams: BenchmarkParams = {
  temperature: 0.2,
  maxTokens: 420,
  systemPrompt: 'You are an Azure incident response assistant. Return severity, service impact, likely root cause, immediate mitigation, fallback notification path, validation query, and risk to customers. Be concise and do not invent resource names that are not in the input.',
};

export function buildBenchmarkPrompt(event: CriticalAzureEvent, parameters: BenchmarkParams): ChatMessage[] {
  return [
    { role: 'system', content: parameters.systemPrompt },
    {
      role: 'user',
      content: [
        'Evaluate this Azure Monitor alert for notification operations.',
        `Title: ${event.title}`,
        `Service: ${event.service}`,
        `Severity: ${event.severity}`,
        `Region: ${event.region}`,
        `Detected: ${event.time}`,
        `Signal: ${event.signal}`,
        `Impact: ${event.impact}`,
        `Payload: ${event.payload}`,
        'Required output fields: Severity, Impact, Immediate action, Fallback notification path, Validation query, Confidence.',
      ].join('\n'),
    },
  ];
}

export async function runModelBenchmark(event: CriticalAzureEvent, modelIds: string[], parameters: BenchmarkParams): Promise<BenchmarkRun> {
  const prompt = buildBenchmarkPrompt(event, parameters);
  const results = await Promise.all(modelIds.map((modelId) => executeModel(event, modelId, prompt, parameters)));
  const ranked = results
    .sort((left, right) => right.overallScore - left.overallScore || left.totalExecutionMs - right.totalExecutionMs)
    .map((result, index) => ({ ...result, rank: index + 1 }));

  return {
    id: `run-${Date.now()}`,
    eventId: event.id,
    eventTitle: event.title,
    createdAt: new Date().toISOString(),
    modelIds,
    parameters,
    results: ranked,
  };
}

async function executeModel(event: CriticalAzureEvent, modelId: string, prompt: ChatMessage[], parameters: BenchmarkParams): Promise<BenchmarkResult> {
  const model = benchmarkModels.find((item) => item.id === modelId) ?? benchmarkModels[0];
  const provider = modelProviders.find((item) => item.id === model.providerId) ?? modelProviders[0];
  const started = performance.now();

  try {
    if (provider.kind === 'ollama') {
      const metrics = await chatMetrics(prompt, { model: model.name });
      return buildResult(event, model, provider, prompt, parameters, metrics.text, 'live', {
        latencyMs: metrics.totalMs,
        timeToFirstTokenMs: Math.max(metrics.loadMs, Math.round(metrics.totalMs * 0.18)),
        totalExecutionMs: metrics.totalMs,
        promptTokens: metrics.promptTokens,
        completionTokens: metrics.completionTokens,
      });
    }
  } catch {
    // Fall through to the deterministic simulated provider path below.
  }

  const simulatedMs = Math.round(performance.now() - started) + simulatedLatency(model);
  const response = simulatedResponse(event, model);
  const promptTokens = estimateTokens(prompt.map((message) => message.content).join('\n'));
  const completionTokens = estimateTokens(response);
  return buildResult(event, model, provider, prompt, parameters, response, 'simulated', {
    latencyMs: simulatedMs,
    timeToFirstTokenMs: Math.max(80, Math.round(simulatedMs * 0.22)),
    totalExecutionMs: simulatedMs,
    promptTokens,
    completionTokens,
  });
}

function buildResult(
  event: CriticalAzureEvent,
  model: BenchmarkModelConfig,
  provider: ModelProviderConfig,
  prompt: ChatMessage[],
  parameters: BenchmarkParams,
  response: string,
  responseSource: 'live' | 'simulated',
  metrics: { latencyMs: number; timeToFirstTokenMs: number; totalExecutionMs: number; promptTokens: number; completionTokens: number },
): BenchmarkResult {
  const requiredFields = evaluateRequiredFields(response);
  const completeness = Math.round((requiredFields.filter((field) => field.present).length / requiredFields.length) * 100);
  const semanticSimilarity = semanticScore(response, expectedResult(event));
  const hallucinationScore = hallucinationRisk(response, event);
  const accuracy = Math.round((semanticSimilarity * 0.55) + (completeness * 0.35) + ((100 - hallucinationScore) * 0.1));
  const responseQuality = Math.round((accuracy * 0.65) + (model.capability.operations * 0.2) + (model.capability.reasoning * 0.15));
  const totalTokens = metrics.promptTokens + metrics.completionTokens;
  const estimatedCost = ((metrics.promptTokens / 1000) * model.inputCostPer1k) + ((metrics.completionTokens / 1000) * model.outputCostPer1k);
  const contextWindowUsage = Math.min(100, Math.round((totalTokens / model.contextWindow) * 1000) / 10);
  const speedScore = Math.max(0, 100 - Math.round(metrics.totalExecutionMs / 120));
  const costScore = estimatedCost === 0 ? 100 : Math.max(0, 100 - Math.round(estimatedCost * 900));
  const overallScore = Math.round((responseQuality * 0.42) + (accuracy * 0.28) + (speedScore * 0.15) + (costScore * 0.1) + ((100 - hallucinationScore) * 0.05));

  return {
    id: `${model.id}-${Date.now()}`,
    modelId: model.id,
    model: model.name,
    provider: provider.name,
    family: model.family,
    hosting: model.hosting,
    version: model.version,
    response,
    responseQuality,
    accuracy,
    hallucinationScore,
    confidenceScore: model.supportsConfidence ? Math.max(50, Math.min(98, accuracy - Math.round(hallucinationScore / 4))) : undefined,
    latencyMs: metrics.latencyMs,
    timeToFirstTokenMs: metrics.timeToFirstTokenMs,
    totalExecutionMs: metrics.totalExecutionMs,
    promptTokens: metrics.promptTokens,
    completionTokens: metrics.completionTokens,
    totalTokens,
    estimatedCost,
    contextWindowUsage,
    memoryMb: model.supportsMemoryMetrics ? localMemoryEstimate(model) : undefined,
    pass: overallScore >= 72 && hallucinationScore < 35 && completeness >= 80,
    overallScore,
    rank: 0,
    responseSource,
    requiredFields,
    semanticSimilarity,
    completeness,
    validationNotes: validationNotes(completeness, semanticSimilarity, hallucinationScore),
    prompt,
    parameters,
  };
}

function expectedResult(event: CriticalAzureEvent) {
  return `${event.severity} ${event.service} ${event.signal} ${event.impact} immediate mitigation fallback notification validation query`;
}

function evaluateRequiredFields(response: string) {
  const lower = response.toLowerCase();
  return [
    { label: 'Severity', present: lower.includes('severity') || /sev\s*[123]/.test(lower) },
    { label: 'Impact', present: lower.includes('impact') || lower.includes('customer') },
    { label: 'Immediate action', present: lower.includes('action') || lower.includes('mitigation') || lower.includes('remediate') },
    { label: 'Fallback notification path', present: lower.includes('fallback') || lower.includes('sms') || lower.includes('email') || lower.includes('teams') },
    { label: 'Validation query', present: lower.includes('query') || lower.includes('validate') || lower.includes('metric') },
    { label: 'Confidence', present: lower.includes('confidence') || lower.includes('risk') },
  ];
}

function semanticScore(response: string, expected: string) {
  const responseTerms = tokenSet(response);
  const expectedTerms = tokenSet(expected);
  const overlap = [...expectedTerms].filter((term) => responseTerms.has(term)).length;
  return Math.round((overlap / Math.max(expectedTerms.size, 1)) * 100);
}

function hallucinationRisk(response: string, event: CriticalAzureEvent) {
  const lower = response.toLowerCase();
  let risk = 8;
  if (!lower.includes(event.service.toLowerCase().split(' ')[0])) risk += 14;
  if (!lower.includes(event.severity.toLowerCase().replace(' ', ''))) risk += 6;
  if (/(guaranteed|definitely|no impact|root password|secret value)/i.test(response)) risk += 18;
  if (response.length < 180) risk += 8;
  if (response.length > 1800) risk += 6;
  return Math.min(100, risk);
}

function tokenSet(text: string) {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s-]/g, ' ').split(/\s+/).filter((term) => term.length > 3));
}

function estimateTokens(text: string) {
  return Math.max(1, Math.round(text.length / 4));
}

function simulatedLatency(model: BenchmarkModelConfig) {
  const base = model.hosting === 'Local' ? 900 : model.providerId === 'future-provider' ? 1400 : 1700;
  return Math.round(base + ((100 - model.capability.speed) * 28));
}

function localMemoryEstimate(model: BenchmarkModelConfig) {
  if (model.name.includes('0.5b')) return 650;
  if (model.name.includes('1b')) return 1200;
  if (model.name.includes('2b')) return 2400;
  return 3900;
}

function simulatedResponse(event: CriticalAzureEvent, model: BenchmarkModelConfig) {
  return [
    `Severity: ${event.severity}.`,
    `Impact: ${event.impact}`,
    `Likely root cause: ${event.signal} indicates a ${event.service} reliability or configuration issue that is affecting notification operations.`,
    'Immediate action: assign the service owner, pause risky changes, verify current metrics, and execute the first mitigation from the runbook.',
    'Fallback notification path: use Teams for operators, pager for Sev 1 ownership, and SMS or email only for customer-facing critical fallback.',
    `Validation query: check Azure Monitor logs for the resource provider behind ${event.service}, filtered to the alert timestamp and region ${event.region}.`,
    `Confidence: ${model.supportsConfidence ? 'estimated from provider metadata and validation coverage' : 'derived from benchmark heuristics'}.`,
  ].join(' ');
}

function validationNotes(completeness: number, semanticSimilarity: number, hallucinationScore: number) {
  const notes: string[] = [];
  notes.push(completeness >= 80 ? 'Required fields present' : 'Missing required response fields');
  notes.push(semanticSimilarity >= 70 ? 'Strong semantic match to expected incident facts' : 'Needs closer grounding to expected facts');
  notes.push(hallucinationScore < 30 ? 'Low hallucination risk' : 'Review for unsupported claims');
  return notes;
}
