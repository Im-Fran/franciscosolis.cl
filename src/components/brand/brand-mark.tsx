import {type SVGProps, useId} from "react";
import {cn} from "@/lib/utils.ts";

/** Minimum legible size of the mark, per docs/BRAND.md. */
export const BRAND_MARK_MIN_SIZE = 16;

/** The mark is drawn on a 64×64 grid; every ratio below is expressed against it. */
const GRID = 64;
/**
 * Tile corner radius as a ratio of the tile's edge — 20%, uniform on all four corners and at every
 * size, and identical to the value in scripts/generate-brand-icons.mjs. Keep the two in step: the
 * whole point of a ratio is that the mark's curve reads the same in the favicon, the handoff PNGs
 * and here. Where a platform applies its own mask or crop, pass `shape="square"` rather than
 * letting it re-cut corners that are already rounded.
 */
const TILE_RADIUS_RATIO = 0.2;
const TILE_RADIUS = GRID * TILE_RADIUS_RATIO;
/** Peak inset inside the gradient tile. */
const TILE_PEAK = "M32 14 L50 50 H37.5 L32 39 L26.5 50 H14 Z";
/** Full-bleed peak used by the single-color marks. */
const MONO_PEAK = "M32 6 L58 58 H40.5 L32 41 L23.5 58 H6 Z";

/** Corner radius per tile shape, in grid units. */
const TILE_RX = {
  rounded: TILE_RADIUS,
  square: 0,
  circle: GRID / 2,
} as const;

const MONO_FILL = {
  ink: "var(--color-brand-ink)",
  white: "var(--color-brand-paper)",
} as const;

export type BrandMarkProps = Omit<SVGProps<SVGSVGElement>, "viewBox" | "width" | "height" | "fill"> & {
  /** Rendered edge length in px. Clamped up to BRAND_MARK_MIN_SIZE. */
  size?: number;
  /** Single-color peak instead of the gradient tile, for print and one-color contexts. */
  mono?: "ink" | "white";
  /**
   * Tile shape. `square` is the full-bleed tile for platforms that apply their own rounding or
   * crop — an avatar upload, an app store listing — and `circle` for the ones that force a
   * circular crop. The artwork inside is unchanged in all three.
   */
  shape?: "rounded" | "square" | "circle";
  /** Set when the mark sits next to the wordmark, so the name is announced only once. */
  decorative?: boolean;
};

/**
 * The FranciscoSolis mark: a white peak on the brand-gradient tile.
 *
 * The tile fill is fixed by the brand and is deliberately not themeable — see the "Don'ts" in
 * docs/BRAND.md. Use `mono` for single-color surfaces rather than recoloring or flattening the tile.
 */
export const BrandMark = ({
  size = 32,
  mono,
  shape = "rounded",
  decorative = false,
  className,
  ...rest
}: BrandMarkProps) => {
  const edge = Math.max(size, BRAND_MARK_MIN_SIZE);
  /* Gradient ids are document-global, so each instance needs its own. */
  const gradientId = useId();

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={`0 0 ${GRID} ${GRID}`}
      width={edge}
      height={edge}
      className={cn("shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : "FranciscoSolis"}
      {...rest}
    >
      {mono ? (
        <path d={MONO_PEAK} fill={MONO_FILL[mono]}/>
      ) : (
        <>
          <defs>
            {/* Periwinkle at bottom-left → plum at top-right, 45°. Never reversed, never re-angled. */}
            <linearGradient id={gradientId} x1="0" y1="1" x2="1" y2="0">
              <stop offset="0" style={{stopColor: "var(--color-brand-periwinkle-500)"}}/>
              <stop offset="1" style={{stopColor: "var(--color-brand-plum-500)"}}/>
            </linearGradient>
          </defs>
          <rect
            width={GRID}
            height={GRID}
            rx={TILE_RX[shape]}
            fill={`url(#${gradientId})`}
          />
          <path d={TILE_PEAK} fill="#fff"/>
        </>
      )}
    </svg>
  );
};
