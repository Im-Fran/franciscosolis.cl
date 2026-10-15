/**
 * The arithmetic the charts share. Kept apart from the components so the two of them agree on what a
 * "nice" axis is — a CPU chart topping out at 100 and a network chart at 4 MB should both land on
 * round numbers for the same reason.
 */

/** Chart inks, as the site's theme tokens: every theme repaints them without the charts knowing. */
export const INK = {
  primary: "var(--color-accent)",
  secondary: "var(--color-neutral-400)",
  grid: "var(--color-neutral-800)",
  axis: "var(--color-neutral-500)",
  surface: "var(--color-surface)",
} as const;

export type SeriesTone = "primary" | "secondary";

/** The secondary series is dashed as well as lighter, so the two never rest on colour alone. */
export const DASH: Record<SeriesTone, string | undefined> = {primary: undefined, secondary: "4 3"};

/**
 * Rounds a maximum up to 1, 2, 2.5 or 5 times a power of ten, so the gridlines fall on numbers a
 * person would have picked. `step` lets a caller round in its own unit — 1024 for bytes, 3600 for
 * hours — rather than in decimal seconds or bytes.
 */
export const niceMax = (value: number, step = 1) => {
  if (!Number.isFinite(value) || value <= 0) return step;
  const scaled = value / step;
  const magnitude = 10 ** Math.floor(Math.log10(scaled));
  const fraction = scaled / magnitude;
  const nice = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 2.5 ? 2.5 : fraction <= 5 ? 5 : 10;
  return nice * magnitude * step;
};

/** `count + 1` evenly spaced values from 0 to `max`, for the gridlines. */
export const gridValues = (max: number, count = 4) => Array.from({length: count + 1}, (_, index) => (max / count) * index);

/** Which of `n` labels to draw so that at most `fit` of them share the axis. */
export const labelEvery = (n: number, fit: number) => Math.max(1, Math.ceil(n / Math.max(1, fit)));

/** Where the tooltip sits: beside the pointer, flipped to the other side near the right edge. */
export const tooltipLeft = (x: number, width: number, tooltipWidth = 200) =>
  x + 12 + tooltipWidth > width ? Math.max(0, x - 12 - tooltipWidth) : x + 12;
