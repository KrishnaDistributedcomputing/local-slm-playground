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
    bestFor: 'Fast replies and simple instructions',
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
    bestFor: 'Balanced chat and summaries',
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
    bestFor: 'Higher-quality writing and knowledge tasks',
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
    bestFor: 'Step-by-step reasoning, math, and logic',
    strengths: [
      'Strong step-by-step reasoning behavior',
      'Strong at math, logic and puzzles',
      'Useful when the operator needs a visible reasoning path',
    ],
    weaknesses: [
      'Verbose <think> output before answers',
      'Slower; overkill for simple chat',
    ],
  },
  'phi3.5': {
    bestFor: 'Microsoft Phi reasoning and coding on a small footprint',
    strengths: [
      'Trained by Microsoft on high-quality curated data',
      'Strong reasoning and coding for its 3.8B size',
      'Solid instruction following and structured output',
      'Long 128K context window',
    ],
    weaknesses: [
      'Heavier than the sub-2B models here',
      'Narrower world knowledge than larger models',
    ],
  },
  'phi3': {
    bestFor: 'Microsoft Phi-3 Mini — efficient general assistant',
    strengths: [
      'Microsoft’s proven 3.8B mini model',
      'Great quality-to-size ratio for chat and Q&A',
      'Reliable instruction following',
      'Long 128K context window',
    ],
    weaknesses: [
      'Superseded by Phi-3.5 / Phi-4 on reasoning',
      'Limited world knowledge vs larger models',
    ],
  },
  'phi4-mini': {
    bestFor: 'Microsoft Phi-4 Mini for modern reasoning and coding',
    strengths: [
      'Newest small Phi model from Microsoft',
      'Improved reasoning, math and coding vs Phi-3.5',
      'Strong structured and function-style output',
      'Long 128K context window',
    ],
    weaknesses: [
      'Slightly larger download than Phi-3.5',
      'Still a small model — not for deep world knowledge',
    ],
  },
  'phi4': {
    bestFor: 'Microsoft Phi-4 — top-tier reasoning (14B)',
    strengths: [
      'Best reasoning and math in the Phi family',
      'Competitive with much larger models',
      'Excellent at coding and structured tasks',
    ],
    weaknesses: [
      'Large (~9 GB) — needs plenty of RAM',
      'Noticeably slower on CPU-only machines',
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
