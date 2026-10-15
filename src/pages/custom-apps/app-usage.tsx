import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatDuration, formatHours, lastDays} from "@/lib/custom-apps/format.ts";
import {WEEKDAYS} from "@/lib/custom-apps/types.ts";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {BarChart} from "@/pages/custom-apps/components/charts/bar-chart.tsx";
import {Heatmap} from "@/pages/custom-apps/components/charts/heatmap.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";
import {isWithinHours} from "@/pages/custom-apps/components/operating-hours.ts";

const DAYS = 30;

/** A `YYYY-MM-DD` key read as a calendar date, at noon UTC so no zone can move it to another day. */
const dateOf = (day: string) => new Date(`${day}T12:00:00Z`);

const HOURS = Array.from({length: 24}, (_, hour) => `${String(hour).padStart(2, "0")}`);

/**
 * How much an app is used, over the last month and across the week.
 *
 * The daily chart answers "is it used at all, and is that changing"; the heatmap answers "when". The
 * second one is what maintenance windows get planned on, so it is drawn to be read rather than
 * glanced at: Monday first (the service's order, and the Chilean week), every hour its own column,
 * the shading linear, the client's operating hours outlined, and the exact figure for any cell in
 * words underneath.
 */
export const AppUsage = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {app} = useApp();
  const {timezone} = useServiceVocabulary();
  const [installationId, setInstallationId] = useState("");
  const language = i18n.language;

  const days = useMemo(() => lastDays(DAYS, timezone), [timezone]);

  const usage = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.apps.usage(app.id, {from: days[0], to: days[days.length - 1]}, signal),
      [app.id, days],
    ),
  );
  const heatmap = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.apps.heatmap(app.id, {installation_id: installationId || undefined}, signal),
      [app.id, installationId],
    ),
  );
  const installations = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.apps.installations(app.id, {limit: 200}, signal), [app.id]),
  );

  /* Every day of the window, reported or not: a day nobody used it is a zero, not a missing bar. */
  const daily = useMemo(() => {
    const byDay = new Map((usage.data ?? []).map((entry) => [entry.day, entry]));
    return days.map(
      (day) => byDay.get(day) ?? {day, online_seconds: 0, active_seconds: 0, installations: 0, events: 0},
    );
  }, [days, usage.data]);

  const dayLabel = useMemo(() => new Intl.DateTimeFormat(language, {day: "numeric", month: "short", timeZone: "UTC"}), [language]);
  const dayTitle = useMemo(
    () => new Intl.DateTimeFormat(language, {weekday: "long", day: "numeric", month: "long", timeZone: "UTC"}),
    [language],
  );

  const totals = daily.reduce(
    (sum, entry) => ({online: sum.online + entry.online_seconds, active: sum.active + entry.active_seconds}),
    {online: 0, active: 0},
  );

  const weekdayLabels = WEEKDAYS.map((day) => t(`custom_apps:weekdays_short.${day}`));
  const grid = heatmap.data;

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title={t("custom_apps:usage.daily_title")}
        description={
          usage.data
            ? t("custom_apps:usage.daily_totals", {
                active: formatDuration(totals.active),
                online: formatDuration(totals.online),
                days: DAYS,
              })
            : t("custom_apps:usage.daily_description", {days: DAYS})
        }
      >
        <PanelState loading={usage.loading} error={usage.error} onRetry={usage.reload} ns="admin">
          <BarChart
            categories={daily.map((entry) => ({
              key: entry.day,
              label: dayLabel.format(dateOf(entry.day)),
              title: dayTitle.format(dateOf(entry.day)),
            }))}
            series={[
              {key: "active", label: t("custom_apps:usage.active"), values: daily.map((entry) => entry.active_seconds), tone: "primary"},
              {key: "online", label: t("custom_apps:usage.online"), values: daily.map((entry) => entry.online_seconds), tone: "secondary"},
            ]}
            yStep={3600}
            formatY={(value) => formatHours(value, language)}
            extra={(index) => [
              t("custom_apps:usage.installations_that_day", {count: daily[index]?.installations ?? 0}),
              t("custom_apps:usage.events_that_day", {count: daily[index]?.events ?? 0}),
            ]}
            label={t("custom_apps:usage.daily_title")}
            emptyLabel={t("custom_apps:usage.empty")}
          />
        </PanelState>
      </Panel>

      <Panel
        title={t("custom_apps:usage.heatmap_title")}
        description={t("custom_apps:usage.heatmap_description", {
          days: grid?.days ?? DAYS,
          timezone: grid?.timezone ?? timezone,
        })}
        action={
          <Select
            value={installationId}
            onChange={(event) => setInstallationId(event.target.value)}
            aria-label={t("custom_apps:usage.scope")}
            className="h-9 w-auto max-w-[16rem] text-[13px]"
          >
            <option value="">{t("custom_apps:usage.all_installations")}</option>
            {(installations.data?.data ?? []).map((installation) => (
              <option key={installation.id} value={installation.id}>
                {installationLabel(installation)}
              </option>
            ))}
          </Select>
        }
      >
        <PanelState loading={heatmap.loading && !grid} error={grid ? null : heatmap.error} onRetry={heatmap.reload} ns="admin">
          {grid &&
            (grid.max > 0 ? (
              <div className={heatmap.loading ? "opacity-60 transition-opacity" : undefined}>
                <Heatmap
                  cells={grid.cells}
                  max={grid.max}
                  rowLabels={weekdayLabels}
                  columnLabels={HOURS}
                  showColumnLabel={(column) => column % 3 === 0}
                  outline={
                    app.operating_hours ? (row, column) => isWithinHours(app.operating_hours, WEEKDAYS[row], column) : undefined
                  }
                  describe={(row, column) =>
                    t("custom_apps:usage.cell", {
                      day: t(`custom_apps:weekdays.${WEEKDAYS[row]}`),
                      from: `${HOURS[column]}:00`,
                      to: `${HOURS[(column + 1) % 24]}:00`,
                      active: formatDuration(grid.cells[row]?.[column] ?? 0),
                      online: formatDuration(grid.online?.[row]?.[column] ?? 0),
                    })
                  }
                  legend={{
                    low: t("custom_apps:usage.legend_low"),
                    high: formatDuration(grid.max) ?? "",
                    outline: app.operating_hours ? t("custom_apps:usage.legend_hours") : undefined,
                  }}
                  label={t("custom_apps:usage.heatmap_title")}
                  hint={t("custom_apps:usage.heatmap_hint")}
                />
              </div>
            ) : (
              <p className="py-6 text-center text-[13px] text-neutral-500">{t("custom_apps:usage.empty")}</p>
            ))}
        </PanelState>
      </Panel>
    </div>
  );
};
