import type {ReactNode} from "react";
import {Link} from "react-router-dom";
import {cn} from "@/lib/utils.ts";

export type StatCardProps = {
  label: string;
  value: ReactNode;
  /** A smaller line under the figure: its denominator, or what it is out of. */
  detail?: ReactNode;
  icon?: ReactNode;
  /** Makes the whole card a link to the list the figure counts. */
  to?: string;
  /** Draws the figure in the warning tone — for counts that are only ever news when above zero. */
  attention?: boolean;
  className?: string;
};

/** A single headline number. A figure, not a chart: one value has no shape worth plotting. */
export const StatCard = ({label, value, detail, icon, to, attention, className}: StatCardProps) => {
  const body = (
    <>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[12px] font-medium tracking-wide text-neutral-500 uppercase">{label}</span>
        {icon && <span className="text-neutral-600" aria-hidden="true">{icon}</span>}
      </div>
      <p className={cn("mt-2 text-[28px] leading-none tabular-nums", attention ? "text-amber-300" : "text-text")}>
        {value}
      </p>
      {detail && <p className="mt-2 text-[13px] text-neutral-500">{detail}</p>}
    </>
  );

  const base = cn("block rounded-[var(--radius-lg)] bg-surface px-5 py-4 shadow-[var(--shadow-sm)]", className);

  return to ? (
    <Link to={to} className={cn(base, "transition-colors hover:bg-neutral-800/40")}>
      {body}
    </Link>
  ) : (
    <div className={base}>{body}</div>
  );
};
