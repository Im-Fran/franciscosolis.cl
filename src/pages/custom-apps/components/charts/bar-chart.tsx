import {useState} from "react";
import {DASH, INK, gridValues, labelEvery, niceMax, tooltipLeft} from "@/pages/custom-apps/components/charts/scale.ts";
import type {SeriesTone} from "@/pages/custom-apps/components/charts/scale.ts";
import {ChartLegend} from "@/pages/custom-apps/components/charts/legend.tsx";
import {useWidth} from "@/pages/custom-apps/components/charts/use-width.ts";

export type BarCategory = {
  key: string;
  /** Under the axis — short. */
  label: string;
  /** In the tooltip — the whole thing. */
  title: string;
};

export type BarSeries = {key: string; label: string; values: number[]; tone: SeriesTone};

export type BarChartProps = {
  categories: BarCategory[];
  series: BarSeries[];
  yStep?: number;
  formatY: (value: number) => string;
  /** Extra lines for the tooltip of one category, below the series values. */
  extra?: (index: number) => string[];
  label: string;
  emptyLabel: string;
  height?: number;
};

const MARGIN = {top: 12, right: 8, bottom: 26, left: 52};

/** A bar with its two top corners rounded and its foot square on the baseline. */
const barPath = (x: number, y: number, width: number, height: number) => {
  const radius = Math.min(3, width / 2, height);
  return [
    `M${x},${y + height}`,
    `L${x},${y + radius}`,
    `Q${x},${y} ${x + radius},${y}`,
    `L${x + width - radius},${y}`,
    `Q${x + width},${y} ${x + width},${y + radius}`,
    `L${x + width},${y + height}`,
    "Z",
  ].join(" ");
};

/**
 * Grouped bars over a set of categories — days, in practice.
 *
 * Grouped side by side rather than stacked, because the series it draws are not parts of a whole:
 * active time is a subset of online time, and a stack would add the two together. The secondary
 * series is outlined rather than filled, so the pair stays legible without colour.
 */
export const BarChart = ({categories, series, yStep = 1, formatY, extra, label, emptyLabel, height = 220}: BarChartProps) => {
  const {ref, width} = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;
  const peak = Math.max(0, ...series.flatMap((entry) => entry.values));
  const top = niceMax(peak, yStep);
  const hasData = peak > 0;

  const band = categories.length > 0 ? innerWidth / categories.length : 0;
  const gap = 2;
  const barWidth = Math.max(2, Math.min(14, (band - 6 - gap * (series.length - 1)) / Math.max(1, series.length)));
  const groupWidth = barWidth * series.length + gap * (series.length - 1);
  const y = (value: number) => MARGIN.top + innerHeight - (Math.min(value, top) / top) * innerHeight;
  const every = labelEvery(categories.length, Math.floor(innerWidth / 44));

  return (
    <div className="flex flex-col gap-3">
      {series.length > 1 && <ChartLegend items={series.map(({key, label: name, tone}) => ({key, label: name, tone}))} />}

      <div ref={ref} className="relative w-full" style={{height}}>
        {!hasData ? (
          <div className="flex h-full items-center justify-center rounded-[var(--radius-md)] border border-dashed border-neutral-800 text-[13px] text-neutral-500">
            {emptyLabel}
          </div>
        ) : width > 0 ? (
          <>
            <svg width={width} height={height} role="img" aria-label={label} className="block">
              {gridValues(top).map((value) => (
                <g key={value}>
                  <line x1={MARGIN.left} x2={width - MARGIN.right} y1={y(value)} y2={y(value)} stroke={INK.grid} />
                  <text
                    x={MARGIN.left - 8}
                    y={y(value)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    fill={INK.axis}
                    fontSize={11}
                  >
                    {formatY(value)}
                  </text>
                </g>
              ))}

              {categories.map((category, index) => {
                const left = MARGIN.left + band * index;
                const start = left + (band - groupWidth) / 2;
                return (
                  <g key={category.key}>
                    {hover === index && (
                      <rect x={left} y={MARGIN.top} width={band} height={innerHeight} fill={INK.grid} opacity={0.5} />
                    )}
                    {series.map((entry, at) => {
                      const value = entry.values[index] ?? 0;
                      if (value <= 0) return null;
                      const barTop = y(value);
                      const x = start + at * (barWidth + gap);
                      const d = barPath(x, barTop, barWidth, MARGIN.top + innerHeight - barTop);
                      return entry.tone === "primary" ? (
                        <path key={entry.key} d={d} fill={INK.primary} />
                      ) : (
                        <path
                          key={entry.key}
                          d={d}
                          fill="none"
                          stroke={INK.secondary}
                          strokeWidth={1.5}
                          strokeDasharray={DASH.secondary}
                        />
                      );
                    })}
                    {index % every === 0 && (
                      <text x={left + band / 2} y={height - 8} textAnchor="middle" fill={INK.axis} fontSize={11}>
                        {category.label}
                      </text>
                    )}
                    {/* The hit target is the whole band, far wider than the bars in it. */}
                    <rect
                      x={left}
                      y={MARGIN.top}
                      width={band}
                      height={innerHeight}
                      fill="transparent"
                      onPointerEnter={() => setHover(index)}
                      onPointerLeave={() => setHover((current) => (current === index ? null : current))}
                    />
                  </g>
                );
              })}
            </svg>

            {hover !== null && categories[hover] && (
              <div
                className="pointer-events-none absolute top-0 z-10 w-[200px] rounded-[var(--radius-md)] border border-neutral-800 bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-sm)]"
                style={{left: tooltipLeft(MARGIN.left + band * (hover + 0.5), width)}}
              >
                <p className="mb-1 text-neutral-400">{categories[hover].title}</p>
                {series.map((entry) => (
                  <p key={entry.key} className="flex items-center justify-between gap-3">
                    <span className="flex items-center gap-1.5 text-neutral-400">
                      <ChartLegend.Swatch tone={entry.tone} />
                      {entry.label}
                    </span>
                    <span className="font-mono text-text tabular-nums">{formatY(entry.values[hover] ?? 0)}</span>
                  </p>
                ))}
                {extra?.(hover).map((line) => (
                  <p key={line} className="mt-0.5 text-neutral-500">
                    {line}
                  </p>
                ))}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
