import {useMemo, useState} from "react";
import type {PointerEvent} from "react";
import {DASH, INK, gridValues, labelEvery, niceMax, tooltipLeft} from "@/pages/custom-apps/components/charts/scale.ts";
import type {SeriesTone} from "@/pages/custom-apps/components/charts/scale.ts";
import {ChartLegend} from "@/pages/custom-apps/components/charts/legend.tsx";
import {useWidth} from "@/pages/custom-apps/components/charts/use-width.ts";

export type LineSeries = {
  key: string;
  label: string;
  /** One value per entry of `times`; a null is a gap in the line, never a zero. */
  values: (number | null)[];
  tone: SeriesTone;
};

export type LineChartProps = {
  /** Epoch milliseconds, ascending. */
  times: number[];
  series: LineSeries[];
  /** A fixed top for the axis, e.g. 100 for a percentage. Derived from the data otherwise. */
  yMax?: number;
  /** The unit the derived top is rounded in (1024 for bytes). */
  yStep?: number;
  formatY: (value: number) => string;
  formatX: (time: number) => string;
  formatTime: (time: number) => string;
  /** Names the chart for assistive technology. */
  label: string;
  emptyLabel: string;
  height?: number;
};

const MARGIN = {top: 12, right: 12, bottom: 26, left: 56};

/**
 * A time series as a line, with an area under the primary one.
 *
 * Hand-written SVG rather than a library: the panel needs three chart shapes, and a charting package
 * would be the largest dependency in the bundle for them. Its rules are the ones that keep a small
 * chart honest — one y axis starting at zero, a gap where the data has a gap instead of a line drawn
 * across it, and a crosshair with the exact values on hover, because a line's shape is a summary and
 * somebody reading a CPU spike wants the number.
 */
export const LineChart = ({
  times,
  series,
  yMax,
  yStep = 1,
  formatY,
  formatX,
  formatTime,
  label,
  emptyLabel,
  height = 200,
}: LineChartProps) => {
  const {ref, width} = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);

  const innerWidth = Math.max(0, width - MARGIN.left - MARGIN.right);
  const innerHeight = height - MARGIN.top - MARGIN.bottom;

  const peak = useMemo(
    () => Math.max(0, ...series.flatMap((entry) => entry.values.filter((value): value is number => value !== null))),
    [series],
  );
  const hasData = series.some((entry) => entry.values.some((value) => value !== null));
  const top = yMax ?? niceMax(peak, yStep);

  const start = times[0] ?? 0;
  const span = Math.max(1, (times[times.length - 1] ?? 0) - start);
  const x = (time: number) => MARGIN.left + ((time - start) / span) * innerWidth;
  const y = (value: number) => MARGIN.top + innerHeight - (Math.min(value, top) / top) * innerHeight;

  /** Each series as runs of consecutive values, so a null breaks the line instead of bridging it. */
  const runs = (values: (number | null)[]) => {
    const out: [number, number][][] = [];
    let current: [number, number][] = [];
    values.forEach((value, index) => {
      if (value === null || times[index] === undefined) {
        if (current.length) out.push(current);
        current = [];
        return;
      }
      current.push([x(times[index]), y(value)]);
    });
    if (current.length) out.push(current);
    return out;
  };

  const onMove = (event: PointerEvent<SVGRectElement>) => {
    if (times.length === 0) return;
    const bounds = event.currentTarget.getBoundingClientRect();
    const time = start + ((event.clientX - bounds.left) / Math.max(1, bounds.width)) * span;
    /* Nearest by time, not by index: the buckets are even today, but the axis is time either way. */
    let nearest = 0;
    for (let index = 1; index < times.length; index += 1) {
      if (Math.abs(times[index] - time) < Math.abs(times[nearest] - time)) nearest = index;
    }
    setHover(nearest);
  };

  const every = labelEvery(times.length, Math.floor(innerWidth / 90));
  const hoverX = hover !== null && times[hover] !== undefined ? x(times[hover]) : null;

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
            <svg width={width} height={height} role="img" aria-label={label} className="block overflow-visible">
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
                    className="tabular-nums"
                  >
                    {formatY(value)}
                  </text>
                </g>
              ))}

              {times.map((time, index) =>
                index % every === 0 ? (
                  <text key={time} x={x(time)} y={height - 8} textAnchor="middle" fill={INK.axis} fontSize={11}>
                    {formatX(time)}
                  </text>
                ) : null,
              )}

              {series.map((entry) =>
                runs(entry.values).map((run, index) => {
                  const line = run.map(([px, py], at) => `${at === 0 ? "M" : "L"}${px},${py}`).join(" ");
                  const baseline = MARGIN.top + innerHeight;
                  const area = `${line} L${run[run.length - 1][0]},${baseline} L${run[0][0]},${baseline} Z`;
                  const color = INK[entry.tone];
                  return (
                    <g key={`${entry.key}-${index}`}>
                      {entry.tone === "primary" && run.length > 1 && <path d={area} fill={color} opacity={0.12} />}
                      {run.length > 1 ? (
                        <path
                          d={line}
                          fill="none"
                          stroke={color}
                          strokeWidth={2}
                          strokeDasharray={DASH[entry.tone]}
                          strokeLinejoin="round"
                          strokeLinecap="round"
                        />
                      ) : (
                        /* A run of one sample has no line to draw, so it is a dot instead of nothing. */
                        <circle cx={run[0][0]} cy={run[0][1]} r={3} fill={color} />
                      )}
                    </g>
                  );
                }),
              )}

              {hoverX !== null && hover !== null && (
                <g pointerEvents="none">
                  <line x1={hoverX} x2={hoverX} y1={MARGIN.top} y2={MARGIN.top + innerHeight} stroke={INK.axis} strokeDasharray="2 3" />
                  {series.map((entry) => {
                    const value = entry.values[hover];
                    return value === null || value === undefined ? null : (
                      <circle
                        key={entry.key}
                        cx={hoverX}
                        cy={y(value)}
                        r={4}
                        fill={INK[entry.tone]}
                        stroke={INK.surface}
                        strokeWidth={2}
                      />
                    );
                  })}
                </g>
              )}

              <rect
                x={MARGIN.left}
                y={MARGIN.top}
                width={innerWidth}
                height={innerHeight}
                fill="transparent"
                onPointerMove={onMove}
                onPointerLeave={() => setHover(null)}
              />
            </svg>

            {hoverX !== null && hover !== null && (
              <div
                className="pointer-events-none absolute top-0 z-10 w-[200px] rounded-[var(--radius-md)] border border-neutral-800 bg-surface px-3 py-2 text-[12px] shadow-[var(--shadow-sm)]"
                style={{left: tooltipLeft(hoverX, width)}}
              >
                <p className="mb-1 text-neutral-400">{formatTime(times[hover])}</p>
                {series.map((entry) => {
                  const value = entry.values[hover];
                  return (
                    <p key={entry.key} className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-neutral-400">
                        <ChartLegend.Swatch tone={entry.tone} />
                        {entry.label}
                      </span>
                      <span className="font-mono text-text tabular-nums">
                        {value === null || value === undefined ? "—" : formatY(value)}
                      </span>
                    </p>
                  );
                })}
              </div>
            )}
          </>
        ) : null}
      </div>
    </div>
  );
};
