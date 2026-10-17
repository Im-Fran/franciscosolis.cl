import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {HourglassMedium} from "@phosphor-icons/react";
import {Panel} from "@/components/ui/panel.tsx";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatDay, formatMinutes, formatMoney} from "@/lib/custom-apps/format.ts";
import type {ContractDetail} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {CycleStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {cycleRange} from "@/pages/custom-apps/components/contracts/contract-format.ts";
import {UsageBar} from "@/pages/custom-apps/components/contracts/usage-bar.tsx";

const Figure = ({label, value, tone}: {label: string; value: string | null; tone?: "bad" | "good"}) => (
  <div className="flex flex-col gap-1">
    <span className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{label}</span>
    <span className={cn("text-lg tabular-nums", tone === "bad" ? "text-red-300" : tone === "good" ? "text-emerald-300" : "text-text")}>
      {value ?? "—"}
    </span>
  </div>
);

/**
 * The cycle running today: what it includes, what it carried from earlier cycles, what was used and
 * what is left — and, once over budget, the overage with what it would cost at the contract's rate.
 * That amount is an estimate while the cycle is open; closing the cycle freezes it.
 */
export const CurrentCycleCard = ({contract}: {contract: ContractDetail}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const cycle = contract.current_cycle;

  if (!cycle) {
    return (
      <Panel title={t("custom_apps:cycle.current_title")}>
        <EmptyState
          icon={<HourglassMedium size={28} />}
          title={contract.status === "scheduled" ? t("custom_apps:cycle.none_scheduled", {date: formatDay(contract.starts_on, language)}) : t("custom_apps:cycle.none")}
        />
      </Panel>
    );
  }

  const over = cycle.overage_minutes > 0;
  const usage = [...contract.current_cycle_usage_by_app].sort((a, b) => b.minutes - a.minutes);

  return (
    <Panel
      title={t("custom_apps:cycle.current_title")}
      description={
        <span className="flex flex-wrap items-center gap-2">
          <CycleStatusBadge value={cycle.status} />
          <span>{cycleRange(cycle, language)}</span>
          <span className="text-neutral-600">·</span>
          <span>{t(`custom_apps:cycle_periods.${contract.cycle_period}`, {defaultValue: contract.cycle_period})}</span>
        </span>
      }
    >
      <div className="flex flex-col gap-6">
        <UsageBar cycle={cycle} />

        <div className="grid gap-5 sm:grid-cols-3 lg:grid-cols-6">
          <Figure label={t("custom_apps:cycle.included")} value={formatMinutes(cycle.included_minutes)} />
          <Figure label={t("custom_apps:cycle.carried")} value={formatMinutes(cycle.carried_minutes)} />
          <Figure label={t("custom_apps:cycle.available")} value={formatMinutes(cycle.available_minutes)} />
          <Figure label={t("custom_apps:cycle.used")} value={formatMinutes(cycle.used_minutes)} />
          <Figure
            label={t("custom_apps:cycle.remaining")}
            value={formatMinutes(cycle.remaining_minutes)}
            tone={cycle.remaining_minutes < 0 ? "bad" : undefined}
          />
          <Figure label={t("custom_apps:cycle.overage")} value={formatMinutes(cycle.overage_minutes)} tone={over ? "bad" : undefined} />
        </div>

        {over && (
          <p className="text-[13px] leading-relaxed text-red-200">
            {cycle.overage_amount !== null && contract.overage_rate > 0
              ? t("custom_apps:cycle.overage_estimate", {
                  amount: formatMoney(cycle.overage_amount, contract.currency, language),
                  rate: formatMoney(contract.overage_rate, contract.currency, language),
                })
              : t("custom_apps:cycle.overage_no_rate")}
          </p>
        )}

        {cycle.carried.length > 0 && (
          <div>
            <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:cycle.carried_from")}</p>
            <ul className="flex flex-wrap gap-2">
              {cycle.carried.map((bucket) => (
                <li
                  key={`${bucket.from}-${bucket.age}`}
                  className="rounded-[var(--radius-sm)] border border-neutral-800 px-2.5 py-1 text-[12px] text-neutral-300"
                >
                  {t("custom_apps:cycle.carried_bucket", {
                    time: formatMinutes(bucket.minutes),
                    date: formatDay(bucket.from, language),
                    count: bucket.age,
                  })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div>
          <p className="mb-2 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("custom_apps:cycle.by_app")}</p>
          {usage.length === 0 ? (
            <p className="text-[13px] text-neutral-500">{t("custom_apps:cycle.by_app_empty")}</p>
          ) : (
            <ul className="flex flex-col gap-1.5">
              {usage.map((entry) => (
                <li key={entry.app_id ?? "company"} className="flex items-center justify-between gap-3 text-[13px]">
                  {entry.app_id ? (
                    <Link to={customAppsRoute.app(entry.app_id)} className="truncate text-neutral-300 hover:text-text hover:underline">
                      {entry.app_name ?? entry.app_id}
                    </Link>
                  ) : (
                    <span className="truncate text-neutral-400 italic">{t("custom_apps:work_log.whole_company")}</span>
                  )}
                  <span className="shrink-0 tabular-nums text-text">{formatMinutes(entry.minutes)}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </Panel>
  );
};
