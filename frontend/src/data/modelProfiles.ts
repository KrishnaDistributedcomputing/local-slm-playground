/**
 * Curated strengths / weaknesses for the small language models shipped with
 * this playground. Keyed by the model's base name (tag stripped), with a
 * keyword fallback so close variants still resolve to a sensible profile.
 */

export interface ModelProfile {
  /** Short, human-friendly summary of what the model is good for. */
  bestFor: string;
  strengths: string[];
  weaknesses: string[];
}

/** Profiles keyed by base model name (without the `:tag`). */
const PROFILES: Record<string, ModelProfile> = {
  'qwen2.5': {
    bestFor: 'Instant replies & simple instructions',
    strengths: [
      'Tiny and extremely fast, even on CPU',
      'Very low memory footprint',
      'Good at short, well-defined instructions',
      'Solid multilingual coverage',
    ],
    weaknesses: [
      'Limited reasoning on complex problems',
      'Struggles with long context and large code',
      'More prone to factual hallucination',
    ],
  },
  'llama3.2': {
    bestFor: 'Balanced everyday chat & summaries',
    strengths: [
      'Well-rounded general conversation',
      'Reliable instruction following',
      'Good summarization and rewriting',
    ],
    weaknesses: [
      'Weaker at math and non-trivial code',
      'Modest world knowledge vs larger models',
    ],
  },
  'gemma2': {
    bestFor: 'Higher-quality writing & knowledge',
    strengths: [
      'Best general knowledge in this set',
      'Stronger reasoning and writing quality',
      'More coherent on longer answers',
    ],
    weaknesses: [
      'Largest and slowest of the bundled models',
      'Needs the most RAM to run comfortably',
    ],
  },
  'deepseek-r1': {
    bestFor: 'Step-by-step reasoning, math & logic',
    strengths: [
      'Explicit chain-of-thought reasoning',
      'Strong at math, logic and puzzles',
      'Shows its working for transparency',
    ],
    weaknesses: [
      'Verbose <think> output before answers',
      'Slower; overkill for simple chat',
    ],
  },
};

const FALLBACK: ModelProfile = {
  bestFor: 'General-purpose local inference',
  strengths: ['Runs fully local, private and offline'],
  weaknesses: ['No curated profile yet — try it in the Playground'],
};

/** Resolve a profile for a full model name (e.g. `gemma2:2b`). */
export function getModelProfile(name: string): ModelProfile {
  const base = name.split(':')[0].toLowerCase();
  if (PROFILES[base]) return PROFILES[base];
  const key = Object.keys(PROFILES).find(
    (k) => base.includes(k) || k.includes(base),
  );
  return key ? PROFILES[key] : FALLBACK;
}
