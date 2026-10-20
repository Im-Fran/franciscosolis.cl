import {useState} from "react";
import {cn} from "@/lib/utils.ts";

export type HeatmapProps = {
  /** `[row][column]`, the value each cell is shaded by. */
  cells: number[][];
  /** The largest value the shading is scaled to; the service reports it beside the grid. */
  max: number;
  rowLabels: string[];
  columnLabels: string[];
  /** Which column labels to print; the rest stay as ticks. */
  showColumnLabel: (column: number) => boolean;
  /** What one cell says when it is pointed at, in full. */
  describe: (row: number, column: number) => string;
  /** Cells to outline — the app's operating hours, so usage outside them stands out. */
  outline?: (row: number, column: number) => boolean;
  /**
   * Cells to mark with a label of their own — the hours a suggested maintenance window covers, with
   * its rank. Null leaves a cell unmarked.
   */
  mark?: (row: number, column: number) => string | null;
  legend: {low: string; high: string; outline?: string; mark?: string};
  label: string;
  /** Shown under the grid until a cell is pointed at. */
  hint: string;
};

/**
 * The shading of one cell: the accent mixed into the empty-cell colour, by the cell's share of the
 * maximum. One hue, light to dark, and linear — a square root would flatter quiet hours, and these
 * are exactly the hours somebody is choosing a maintenance window from.
 */
const shade = (value: number, max: number) => {
  if (!(value > 0) || !(max > 0)) return undefined;
  const share = Math.min(1, value / max);
  return `color-mix(in oklab, var(--color-accent) ${Math.round(12 + share * 88)}%, var(--color-neutral-800))`;
};

/**
 * A grid of weekdays by hours, shaded by how much happened in each.
 *
 * Built from HTML rather than SVG: it is a table in all but element, it wants to reflow at every
 * width, and a cell has to stay a hit target on a phone. The reading line underneath says what the
 * pointed cell holds in words, which a colour scale on its own cannot.
 */
export const Heatmap = ({
  cells,
  max,
  rowLabels,
  columnLabels,
  showColumnLabel,
  describe,
  outline,
  mark,
  legend,
  label,
  hint,
}: HeatmapProps) => {
  const [hover, setHover] = useState<[number, number] | null>(null);
  const columns = columnLabels.length;

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-6 overflow-x-auto px-6">
        <div
          role="img"
          aria-label={label}
          className="grid min-w-[36rem] gap-[3px]"
          style={{gridTemplateColumns: `auto repeat(${columns}, minmax(0, 1fr))`}}
          onPointerLeave={() => setHover(null)}
        >
          <span />
          {columnLabels.map((text, column) => (
            <span key={text} className="pb-1 text-center text-[10px] text-neutral-500 tabular-nums">
              {showColumnLabel(column) ? text : ""}
            </span>
          ))}

          {rowLabels.map((rowLabel, row) => (
            <div key={rowLabel} className="contents">
              <span className="pr-2 text-right text-[11px] leading-[22px] text-neutral-400">{rowLabel}</span>
              {columnLabels.map((text, column) => {
                const value = cells[row]?.[column] ?? 0;
                const active = hover !== null && hover[0] === row && hover[1] === column;
                const marked = mark?.(row, column) ?? null;
                return (
                  <span
                    key={text}
                    title={describe(row, column)}
                    onPointerEnter={() => setHover([row, column])}
                    className={cn(
                      "flex h-[22px] items-center justify-center rounded-[3px] bg-neutral-800/70",
                      outline?.(row, column) && "ring-1 ring-neutral-400/70 ring-inset",
                      marked !== null && "ring-2 ring-emerald-400 ring-inset",
                      active && "ring-2 ring-text ring-inset",
                    )}
                    style={{background: shade(value, max)}}
                  >
                    {marked && <span className="text-[10px] leading-none font-semibold text-emerald-200 tabular-nums">{marked}</span>}
                  </span>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="min-h-5 text-[13px] text-neutral-300" aria-live="polite">
          {hover ? describe(hover[0], hover[1]) : <span className="text-neutral-500">{hint}</span>}
        </p>

        <div className="flex flex-wrap items-center gap-4 text-[11px] text-neutral-500">
          <span className="flex items-center gap-2">
            {legend.low}
            <span
              aria-hidden="true"
              className="h-2.5 w-28 rounded-full"
              style={{
                background:
                  "linear-gradient(to right, color-mix(in oklab, var(--color-accent) 12%, var(--color-neutral-800)), var(--color-accent))",
              }}
            />
            {legend.high}
          </span>
          {legend.mark && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-[3px] bg-neutral-800/70 ring-2 ring-emerald-400 ring-inset" />
              {legend.mark}
            </span>
          )}
          {legend.outline && (
            <span className="flex items-center gap-1.5">
              <span aria-hidden="true" className="size-3 rounded-[3px] bg-neutral-800/70 ring-1 ring-neutral-400/70 ring-inset" />
              {legend.outline}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
