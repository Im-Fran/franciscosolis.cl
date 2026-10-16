import {DASH, INK} from "@/pages/custom-apps/components/charts/scale.ts";
import type {SeriesTone} from "@/pages/custom-apps/components/charts/scale.ts";

/** A short line in the series' ink and dash, so the legend reads the same way the chart does. */
const Swatch = ({tone}: {tone: SeriesTone}) => (
  <svg width={16} height={8} aria-hidden="true" className="shrink-0">
    <line x1={1} x2={15} y1={4} y2={4} stroke={INK[tone]} strokeWidth={2} strokeDasharray={DASH[tone]} strokeLinecap="round" />
  </svg>
);

/**
 * Which line is which. Present whenever a chart has two series, and in words as well as ink: the
 * second series being lighter and dashed is a help, not the only way to tell them apart.
 */
export const ChartLegend = ({items}: {items: {key: string; label: string; tone: SeriesTone}[]}) => (
  <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-neutral-400">
    {items.map((item) => (
      <li key={item.key} className="flex items-center gap-1.5">
        <Swatch tone={item.tone} />
        {item.label}
      </li>
    ))}
  </ul>
);

ChartLegend.Swatch = Swatch;
