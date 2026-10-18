import {useTranslation} from "react-i18next";
import {formatHoursDecimal} from "@/lib/custom-apps/format.ts";
import type {Cycle} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";

/**
 * A cycle's hours as one bar: used against available, with whatever went over drawn in red past the
 * end of the budget rather than clipped — an overage is the figure somebody bills on, and a full bar
 * would hide it. Amber from 80 % on, so "nearly out" reads before "out".
 *
 * A cycle with no hours included (a plan that only bills by the hour) has no budget to fill, so it
 * shows what was used and nothing else.
 */
export const UsageBar = ({
  cycle,
  compact,
  className,
}: {
  cycle: Pick<Cycle, "used_minutes" | "available_minutes" | "overage_minutes">;
  compact?: boolean;
  className?: string;
}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  const used = Math.max(0, cycle.used_minutes);
  const available = Math.max(0, cycle.available_minutes);
  const over = Math.max(0, cycle.overage_minutes, used - available);

  /* The bar's full width is the larger of the budget and what was used, so an overage has room. */
  const scale = Math.max(available, used, 1);
  const withinPercent = (Math.min(used, available) / scale) * 100;
  const overPercent = (over / scale) * 100;
  const ratio = available > 0 ? used / available : null;
  const tone = over > 0 ? "bg-red-400" : ratio !== null && ratio >= 0.8 ? "bg-amber-400" : "bg-emerald-400";

  const label = t("contracts.usage_value", {
    used: formatHoursDecimal(used, language),
    available: formatHoursDecimal(available, language),
  });

  return (
    <div className={cn("flex min-w-0 flex-col gap-1", className)}>
      <div
        className={cn("flex w-full overflow-hidden rounded-full bg-neutral-800", compact ? "h-1.5" : "h-2.5")}
        role="meter"
        aria-label={t("contracts.usage")}
        aria-valuemin={0}
        aria-valuemax={available || undefined}
        aria-valuenow={used}
        aria-valuetext={label}
      >
        <span className={cn("h-full", tone)} style={{width: `${withinPercent}%`}} />
        {overPercent > 0 && <span className="h-full bg-red-500/70" style={{width: `${overPercent}%`}} />}
      </div>
      <span className={cn("tabular-nums", compact ? "text-[12px]" : "text-[13px]", "text-neutral-400")}>
        {available > 0 ? label : t("contracts.usage_used_only", {used: formatHoursDecimal(used, language)})}
        {over > 0 && (
          <span className="text-red-300"> · {t("contracts.over_by", {hours: formatHoursDecimal(over, language)})}</span>
        )}
      </span>
    </div>
  );
};
