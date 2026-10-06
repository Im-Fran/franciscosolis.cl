import type {HTMLAttributes} from "react";
import {cn} from "@/lib/utils.ts";
import {BRAND_MARK_MIN_SIZE, BrandMark} from "@/components/brand/brand-mark.tsx";

/**
 * Lockup proportions, expressed as ratios of the mark's height so the lockup scales as one unit.
 * Values are read off the reference SVGs in cdn/brand/svg/.
 */
const HORIZONTAL_FONT_RATIO = 0.594;
const HORIZONTAL_GAP_RATIO = 0.281;
const VERTICAL_FONT_RATIO = 0.375;
const VERTICAL_GAP_RATIO = 0.5;
/** Clear space is half the mark's height on every side. */
const CLEAR_SPACE_RATIO = 0.5;

/**
 * Smallest mark edge each variant may set at, derived from the minimum lockup dimensions in
 * docs/BRAND.md: 24 px tall for the horizontal lockup, 120 px wide for the vertical one — and the
 * vertical lockup is 3.75× its mark's edge across.
 */
const MIN_MARK_SIZE = {
  horizontal: Math.max(24, BRAND_MARK_MIN_SIZE),
  vertical: 120 / 3.75,
} as const;

/**
 * Wordmark colours per tone. `auto` reads the theme-aware aliases, which the accessibility themes
 * re-point in src/lib/main.css; the two fixed tones stay pinned to the brand values so the brand
 * page can show both side by side whatever the visitor's theme is.
 */
const BRAND_TONE_COLOR = {
  dark: {name: "--color-brand-on-dark", surname: "--color-brand-paper"},
  light: {name: "--color-brand", surname: "--color-brand-ink"},
  auto: {name: "--color-brand-auto", surname: "--color-brand-auto-contrast"},
} as const;

export type BrandLockupProps = Omit<HTMLAttributes<HTMLSpanElement>, "children"> & {
  /** Mark edge length in px; the wordmark scales with it. Clamped up to the variant's minimum. */
  size?: number;
  /**
   * `dark` is the variant for dark surfaces, where "Francisco" lightens and "Solis" goes paper.
   * `auto` follows the active theme, for the lockups sitting on the product's own surfaces.
   */
  tone?: "light" | "dark" | "auto";
  variant?: "horizontal" | "vertical";
  /**
   * Reserve the brand's clear space (half the mark's height) as padding. Leave off where the
   * surrounding layout already provides at least that much room, so the gap is not counted twice.
   */
  clearSpace?: boolean;
};

/**
 * The full FranciscoSolis lockup: mark plus wordmark, set as one name.
 *
 * The wordmark is real text in Sora rather than the `<text>` baked into the reference SVGs — those
 * resolve Sora against locally installed fonts only and fall back to a system sans on most machines.
 * Rendering it here keeps the name selectable, crisp at any size, and readable to screen readers.
 */
export const BrandLockup = ({
  size = 32,
  tone = "dark",
  variant = "horizontal",
  clearSpace = false,
  className,
  ...rest
}: BrandLockupProps) => {
  const vertical = variant === "vertical";
  const edge = Math.max(size, MIN_MARK_SIZE[variant]);
  const fontSize = edge * (vertical ? VERTICAL_FONT_RATIO : HORIZONTAL_FONT_RATIO);
  const gap = edge * (vertical ? VERTICAL_GAP_RATIO : HORIZONTAL_GAP_RATIO);

  return (
    <span
      className={cn(
        "inline-flex select-none",
        vertical ? "flex-col items-center text-center" : "flex-row items-center",
        className,
      )}
      style={{
        gap: `${gap}px`,
        padding: clearSpace ? `${edge * CLEAR_SPACE_RATIO}px` : undefined,
      }}
      {...rest}
    >
      <BrandMark size={edge} decorative/>
      <span
        className="font-display font-semibold leading-none whitespace-nowrap"
        style={{fontSize: `${fontSize}px`, letterSpacing: "-0.02em"}}
      >
        <span style={{color: `var(${BRAND_TONE_COLOR[tone].name})`}}>
          Francisco
        </span>
        <span style={{color: `var(${BRAND_TONE_COLOR[tone].surname})`}}>
          Solis
        </span>
      </span>
    </span>
  );
};
