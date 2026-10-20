import {useMemo} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {dayIn} from "@/lib/custom-apps/format.ts";
import type {Maintenance, MaintenanceStatus} from "@/lib/custom-apps/types.ts";
import {WEEKDAYS} from "@/lib/custom-apps/types.ts";
import {formatZonedTime, zonedDay} from "@/lib/custom-apps/zoned-time.ts";
import {cn} from "@/lib/utils.ts";

/** Every `YYYY-MM-DD` of a month. */
const daysOf = (month: string) => {
  const [year, value] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year, value, 0)).getUTCDate();
  return Array.from({length: count}, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
};

/** 0 = Monday, the panel's week. */
const weekdayOf = (day: string) => (new Date(`${day}T12:00:00Z`).getUTCDay() + 6) % 7;

const STATUS_STYLES: Partial<Record<MaintenanceStatus, string>> = {
  scheduled: "border-sky-500/50 bg-sky-500/10 text-sky-200",
  in_progress: "border-accent-600 bg-accent-900/50 text-accent-100",
  completed: "border-emerald-500/40 bg-emerald-500/10 text-emerald-200",
  failed: "border-red-500/50 bg-red-500/10 text-red-200",
  pending_approval: "border-dashed border-amber-500/50 bg-transparent text-amber-200",
  cancelled: "border-neutral-700 bg-transparent text-neutral-500 line-through",
};

type Entry = {key: string; maintenance: Maintenance; startsAt: string; endsAt: string; proposal: boolean};

/** One window in a day: its start time and the maintenance's title, linking to it. */
const EntryLink = ({entry, compact, timezone}: {entry: Entry; compact?: boolean; timezone: string}) => {
  const {t, i18n} = useTranslation("custom_apps");
  return (
    <Link
      to={customAppsRoute.maintenance(entry.maintenance.id)}
      title={`${entry.maintenance.title} · ${entry.maintenance.app_name ?? ""}${entry.proposal ? ` · ${t("maintenances.calendar.proposal")}` : ""}`}
      className={cn(
        "block rounded-[var(--radius-sm)] border px-1.5 py-0.5 text-[11px] leading-snug transition-colors hover:brightness-125",
        STATUS_STYLES[entry.maintenance.status] ?? "border-neutral-700 text-neutral-300",
        entry.maintenance.kind === "security" && "ring-1 ring-red-500/60",
      )}
    >
      <span className="font-mono tabular-nums">{formatZonedTime(entry.startsAt, i18n.language, timezone)}</span>{" "}
      <span className={compact ? "line-clamp-1" : undefined}>{entry.maintenance.title}</span>
      {!compact && entry.maintenance.app_name && <span className="block text-[10px] opacity-75">{entry.maintenance.app_name}</span>}
    </Link>
  );
};

/**
 * A month of maintenance windows, on the service's clock (Santiago). Each maintenance shows the window
 * it runs in once one is fixed; one still waiting on the client shows every window it offers, dashed,
 * because any of them may become the one. A window that crosses midnight is on both days.
 *
 * A seven-column grid needs room, so below `sm` the same entries are listed day by day instead.
 */
export const MaintenanceCalendar = ({
  month,
  maintenances,
  timezone,
}: {
  /** `YYYY-MM`. */
  month: string;
  maintenances: Maintenance[];
  timezone: string;
}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const language = i18n.language;
  const days = useMemo(() => daysOf(month), [month]);
  const today = dayIn(new Date(), timezone);

  const byDay = useMemo(() => {
    const map = new Map<string, Entry[]>();
    const add = (day: string, entry: Entry) => map.set(day, [...(map.get(day) ?? []), entry]);
    for (const maintenance of maintenances) {
      const windows = maintenance.chosen_window
        ? [{window: maintenance.chosen_window, proposal: false}]
        : maintenance.status === "pending_approval"
          ? maintenance.windows.map((window) => ({window, proposal: true}))
          : [];
      for (const {window, proposal} of windows) {
        const first = zonedDay(window.starts_at, timezone);
        /* The instant just before the end, so a window ending at 00:00 stays on its own day. */
        const last = zonedDay(new Date(new Date(window.ends_at).getTime() - 1), timezone);
        const entry = {key: `${maintenance.id}-${window.id}`, maintenance, startsAt: window.starts_at, endsAt: window.ends_at, proposal};
        add(first, entry);
        if (last !== first) add(last, {...entry, key: `${entry.key}-end`});
      }
    }
    for (const entries of map.values()) entries.sort((a, b) => a.startsAt.localeCompare(b.startsAt));
    return map;
  }, [maintenances, timezone]);

  const lead = weekdayOf(days[0]);
  const cells: Array<string | null> = [...Array.from({length: lead}, () => null), ...days];
  while (cells.length % 7 !== 0) cells.push(null);

  const dayNumber = (day: string) => Number(day.slice(8));
  const longDay = new Intl.DateTimeFormat(language, {weekday: "long", day: "numeric", month: "long", timeZone: "UTC"});

  const withEntries = days.filter((day) => (byDay.get(day) ?? []).length > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="hidden sm:block">
        <div className="grid grid-cols-7 gap-px overflow-hidden rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-800" role="grid" aria-label={t("maintenances.calendar.label")}>
          {WEEKDAYS.map((weekday) => (
            <div key={weekday} role="columnheader" className="bg-surface px-2 py-1.5 text-center text-[11px] font-medium tracking-wide text-neutral-500 uppercase">
              {t(`weekdays_short.${weekday}`)}
            </div>
          ))}
          {cells.map((day, index) => {
            const entries = day ? (byDay.get(day) ?? []) : [];
            return (
              <div
                key={day ?? `blank-${index}`}
                role="gridcell"
                aria-label={day ? longDay.format(new Date(`${day}T12:00:00Z`)) : undefined}
                className={cn("flex min-h-24 flex-col gap-1 bg-surface p-1.5", !day && "bg-bg/40")}
              >
                {day && (
                  <>
                    <span
                      className={cn(
                        "self-end rounded-full px-1.5 text-[11px] tabular-nums",
                        day === today ? "bg-accent text-bg" : "text-neutral-500",
                      )}
                    >
                      {dayNumber(day)}
                    </span>
                    {entries.slice(0, 3).map((entry) => (
                      <EntryLink key={entry.key} entry={entry} compact timezone={timezone} />
                    ))}
                    {entries.length > 3 && (
                      <span className="text-[10px] text-neutral-500">{t("maintenances.calendar.more", {count: entries.length - 3})}</span>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="sm:hidden">
        {withEntries.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-neutral-500">{t("maintenances.calendar.empty")}</p>
        ) : (
          <ol className="flex flex-col gap-3">
            {withEntries.map((day) => (
              <li key={day}>
                <p className={cn("mb-1.5 text-[12px] font-medium", day === today ? "text-accent-200" : "text-neutral-400")}>
                  {longDay.format(new Date(`${day}T12:00:00Z`))}
                </p>
                <div className="flex flex-col gap-1.5">
                  {(byDay.get(day) ?? []).map((entry) => (
                    <EntryLink key={entry.key} entry={entry} timezone={timezone} />
                  ))}
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-neutral-500">
        {(["scheduled", "in_progress", "completed", "failed", "pending_approval"] as const).map((status) => (
          <li key={status} className="flex items-center gap-1.5">
            <span aria-hidden="true" className={cn("size-3 rounded-[3px] border", STATUS_STYLES[status])} />
            {status === "pending_approval" ? t("maintenances.calendar.proposal") : t(`maintenance_statuses.${status}`)}
          </li>
        ))}
        <li className="flex items-center gap-1.5">
          <span aria-hidden="true" className="size-3 rounded-[3px] border border-neutral-700 ring-1 ring-red-500/60" />
          {t("maintenance_kinds.security")}
        </li>
      </ul>
    </div>
  );
};
