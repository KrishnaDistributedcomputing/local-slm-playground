/**
 * Deterministic, stable colors derived from a model name.
 * Used to color-code models consistently across the UI.
 */

/** Deterministic hue (0-359) derived from the model name. */
export function modelHue(name: string): number {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) {
    h = (h * 31 + name.charCodeAt(i)) % 360;
  }
  return h;
}

export interface ModelColors {
  dot: string;
  bg: string;
  border: string;
  text: string;
}

/** Stable color palette for a given model name. */
export function modelColors(name: string): ModelColors {
  const hue = modelHue(name);
  return {
    dot: `hsl(${hue} 70% 45%)`,
    bg: `hsl(${hue} 70% 96%)`,
    border: `hsl(${hue} 55% 80%)`,
    text: `hsl(${hue} 55% 32%)`,
  };
}
