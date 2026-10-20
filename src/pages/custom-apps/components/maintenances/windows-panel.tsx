import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {ArrowDown, ArrowUp, CalendarPlus, CheckCircle, Lightbulb, Plus, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {FormHelpButton, RequiredLegend} from "@/components/ui/help.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatDuration, formatMinutes} from "@/lib/custom-apps/format.ts";
import type {App, Maintenance, MaintenanceSuggestion, MaintenanceWindow, NewMaintenanceWindow} from "@/lib/custom-apps/types.ts";
import {WEEKDAYS} from "@/lib/custom-apps/types.ts";
import {formatZonedWindow, fromZonedInput, toZonedInput, zonedSlot} from "@/lib/custom-apps/zoned-time.ts";
import {cn} from "@/lib/utils.ts";
import {Pill} from "@/pages/custom-apps/components/badges.tsx";
import {Heatmap} from "@/pages/custom-apps/components/charts/heatmap.tsx";
import {isWithinHours} from "@/pages/custom-apps/components/operating-hours.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const HOURS = Array.from({length: 24}, (_, hour) => `${String(hour).padStart(2, "0")}`);

/** Sorted the way the client sees them. */
const ordered = (windows: MaintenanceWindow[]) => [...windows].sort((a, b) => a.position - b.position || a.starts_at.localeCompare(b.starts_at));

/** What the service's refusals of a window mean, in words. */
const useWindowFailure = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  return (status: number | null, message: string) => {
    if (status === 409 && /overlap/i.test(message)) return t("custom_apps:maintenance_windows.errors.overlap");
    if (status === 409 && /at most/i.test(message)) return t("custom_apps:maintenance_windows.errors.too_many");
    if (status === 409) return t("custom_apps:maintenances.errors.not_editable");
    if (status === 422 && /future/i.test(message)) return t("custom_apps:maintenance_windows.errors.past");
    if (status === 422 && /at least/i.test(message)) return t("custom_apps:maintenance_windows.errors.too_short");
    if (status === 400 && /after/i.test(message)) return t("custom_apps:maintenance_windows.errors.order");
    return t(`admin:errors.${message}`, {defaultValue: message});
  };
};

/**
 * The windows a maintenance is offered in — and, while it can still change (draft, or nobody
 * answered), the editor for them: reorder with the arrows (the client sees them in this order, and
 * the first one still far enough away is where it is applied when nobody answers), remove one, or add
 * one by hand. Times are typed and shown on Santiago's clock, the service's, whatever zone this
 * browser is in; the end starts as the start plus the estimated duration and can be lengthened.
 *
 * Every write answers the whole list, which replaces this one: positions are renumbered on the service.
 */
export const WindowsPanel = ({
  maintenance,
  editable,
  onChanged,
}: {
  maintenance: Maintenance;
  editable: boolean;
  onChanged: (windows: MaintenanceWindow[]) => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const language = i18n.language;
  const {timezone, maintenanceLimits} = useServiceVocabulary();
  const describeFailure = useWindowFailure();
  const windows = ordered(maintenance.windows);
  const now = Date.now();

  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  /* Until the end is typed over, it follows the start. */
  const [endTouched, setEndTouched] = useState(false);
  const [errors, setErrors] = useState<{start?: string; end?: string}>({});

  const add = useMutation(useCallback((body: NewMaintenanceWindow) => customAppsApi.maintenances.addWindow(maintenance.id, body), [maintenance.id]));
  const move = useMutation(
    useCallback((windowId: string, position: number) => customAppsApi.maintenances.updateWindow(maintenance.id, windowId, {position}), [maintenance.id]),
  );
  const remove = useMutation(useCallback((windowId: string) => customAppsApi.maintenances.removeWindow(maintenance.id, windowId), [maintenance.id]));

  const endFor = useCallback(
    (value: string) => {
      const iso = fromZonedInput(value, timezone);
      return iso ? toZonedInput(new Date(new Date(iso).getTime() + maintenance.estimated_minutes * 60_000), timezone) : "";
    },
    [maintenance.estimated_minutes, timezone],
  );

  const changeStart = (value: string) => {
    setStart(value);
    if (!endTouched) setEnd(endFor(value));
    setErrors({});
  };

  const full = windows.length >= maintenanceLimits.max_windows;
  const minStart = toZonedInput(new Date(now + 60_000), timezone);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found: {start?: string; end?: string} = {};
    const startsAt = fromZonedInput(start, timezone);
    const endsAt = end ? fromZonedInput(end, timezone) : null;
    if (!startsAt) found.start = t("custom_apps:validation.required");
    else if (new Date(startsAt).getTime() <= Date.now()) found.start = t("custom_apps:maintenance_windows.errors.past");
    if (startsAt && end && !endsAt) found.end = t("custom_apps:validation.required");
    if (startsAt && endsAt) {
      const length = new Date(endsAt).getTime() - new Date(startsAt).getTime();
      if (length <= 0) found.end = t("custom_apps:maintenance_windows.errors.order");
      else if (length < maintenance.estimated_minutes * 60_000) {
        found.end = t("custom_apps:maintenance_windows.errors.too_short_value", {duration: formatMinutes(maintenance.estimated_minutes)});
      }
    }
    setErrors(found);
    if (Object.keys(found).length > 0 || !startsAt) return;
    const outcome = await add.run({starts_at: startsAt, ...(endsAt ? {ends_at: endsAt} : {}), source: "manual"});
    if (!outcome.ok) return;
    onChanged(outcome.data);
    setStart("");
    setEnd("");
    setEndTouched(false);
  };

  const reorder = async (window: MaintenanceWindow, delta: number) => {
    const index = windows.findIndex((entry) => entry.id === window.id);
    const target = index + delta;
    if (target < 0 || target >= windows.length) return;
    const outcome = await move.run(window.id, target);
    if (outcome.ok) onChanged(outcome.data);
  };

  const drop = async (window: MaintenanceWindow) => {
    const outcome = await remove.run(window.id);
    if (outcome.ok) onChanged(outcome.data);
  };

  const busy = add.pending || move.pending || remove.pending;
  const listError = move.error ? describeFailure(move.status, move.error) : remove.error ? describeFailure(remove.status, remove.error) : null;

  return (
    <Panel
      title={t("custom_apps:maintenance_windows.title")}
      description={
        editable
          ? t("custom_apps:maintenance_windows.description_editable", {count: windows.length, max: maintenanceLimits.max_windows, timezone})
          : t("custom_apps:maintenance_windows.description", {timezone})
      }
      action={editable ? <FormHelpButton help={help.form("maintenance_windows.form_help", {lead: maintenanceLimits.min_lead_hours})} /> : undefined}
    >
      {windows.length === 0 ? (
        <p className="py-2 text-[13px] text-neutral-500">
          {editable ? t("custom_apps:maintenance_windows.empty_editable") : t("custom_apps:maintenance_windows.empty")}
        </p>
      ) : (
        <ol className="flex flex-col gap-2">
          {windows.map((window, index) => {
            const started = new Date(window.starts_at).getTime() <= now;
            return (
              <li
                key={window.id}
                className={cn(
                  "flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border px-3 py-2.5",
                  window.chosen ? "border-emerald-500/50 bg-emerald-500/5" : "border-neutral-800",
                )}
              >
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-neutral-800 text-[12px] text-neutral-300 tabular-nums" aria-hidden="true">
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-text">{formatZonedWindow(window.starts_at, window.ends_at, language, timezone)}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-neutral-500">
                    <span>{formatMinutes(Math.round((new Date(window.ends_at).getTime() - new Date(window.starts_at).getTime()) / 60_000))}</span>
                    <Pill tone={window.source === "suggested" ? "planned" : "inert"}>
                      {t(`custom_apps:maintenance_window_sources.${window.source}`, {defaultValue: window.source})}
                    </Pill>
                    {window.chosen && (
                      <span className="inline-flex items-center gap-1 text-emerald-300">
                        <CheckCircle size={13} aria-hidden="true" /> {t("custom_apps:maintenance_windows.chosen")}
                      </span>
                    )}
                    {editable && started && <span className="text-amber-300">{t("custom_apps:maintenance_windows.started")}</span>}
                  </p>
                </div>
                {editable && (
                  <span className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={busy || index === 0}
                      onClick={() => void reorder(window, -1)}
                      aria-label={t("custom_apps:maintenance_windows.move_up", {position: index + 1})}
                    >
                      <ArrowUp size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      disabled={busy || index === windows.length - 1}
                      onClick={() => void reorder(window, 1)}
                      aria-label={t("custom_apps:maintenance_windows.move_down", {position: index + 1})}
                    >
                      <ArrowDown size={14} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8 text-red-300"
                      disabled={busy}
                      onClick={() => void drop(window)}
                      aria-label={t("custom_apps:maintenance_windows.remove", {position: index + 1})}
                    >
                      <Trash size={14} />
                    </Button>
                  </span>
                )}
              </li>
            );
          })}
        </ol>
      )}

      {listError && (
        <Alert tone="error" title={t("admin:common.failed")} className="mt-4">
          {listError}
        </Alert>
      )}

      {editable && (
        <form onSubmit={submit} className="mt-6 flex flex-col gap-4 border-t border-neutral-800 pt-5" noValidate>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[12px] font-medium tracking-wider text-neutral-500 uppercase">{t("custom_apps:maintenance_windows.add_title")}</h3>
            <RequiredLegend />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("custom_apps:maintenance_windows.fields.start")}
              htmlFor="maintenance-window-start"
              error={errors.start}
              hint={t("custom_apps:maintenance_windows.hints.start", {timezone})}
              help={help.field("maintenance_windows.help.start", {timezone})}
              required
            >
              <Input
                id="maintenance-window-start"
                type="datetime-local"
                value={start}
                min={minStart}
                step={300}
                onChange={(event) => changeStart(event.target.value)}
                disabled={busy || full}
                aria-invalid={Boolean(errors.start)}
                required
              />
            </Field>
            <Field
              label={t("custom_apps:maintenance_windows.fields.end")}
              htmlFor="maintenance-window-end"
              error={errors.end}
              hint={t("custom_apps:maintenance_windows.hints.end", {duration: formatMinutes(maintenance.estimated_minutes)})}
              help={help.field("maintenance_windows.help.end", {duration: formatMinutes(maintenance.estimated_minutes)})}
            >
              <Input
                id="maintenance-window-end"
                type="datetime-local"
                value={end}
                min={start || minStart}
                step={300}
                onChange={(event) => {
                  setEnd(event.target.value);
                  setEndTouched(event.target.value !== "");
                  setErrors({});
                }}
                disabled={busy || full}
                aria-invalid={Boolean(errors.end)}
              />
            </Field>
          </div>
          {full && <p className="text-[12px] text-amber-300">{t("custom_apps:maintenance_windows.errors.too_many")}</p>}
          {add.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {describeFailure(add.status, add.error)}
            </Alert>
          )}
          <div className="flex justify-end">
            <Button type="submit" disabled={busy || full || !start}>
              {add.pending ? <Spinner size={16} /> : <CalendarPlus size={16} />}
              {t("custom_apps:maintenance_windows.add")}
            </Button>
          </div>
        </form>
      )}
    </Panel>
  );
};

/**
 * Where to put it: the least-used blocks of the coming days, scored on the usage heatmap of what the
 * maintenance includes, at least a day ahead and inside the app's operating hours when it declares
 * them — asked of the service, which saves nothing. Each one is drawn on the week-by-hour heatmap,
 * numbered by rank, and "Add" offers it as a window marked as suggested.
 *
 * The heatmap drawn is the app's (or the one installation's, when it names exactly one); the
 * suggestions are scored on exactly the included installations, which is said in words when they
 * differ.
 */
export const SuggestionsPanel = ({
  maintenance,
  app,
  onChanged,
}: {
  maintenance: Maintenance;
  app: App | null;
  onChanged: (windows: MaintenanceWindow[]) => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const {timezone} = useServiceVocabulary();
  const describeFailure = useWindowFailure();
  const windowsKey = maintenance.windows.map((window) => `${window.id}:${window.starts_at}`).join(",");
  const single = maintenance.installation_ids.length === 1 ? maintenance.installation_ids[0] : "";

  const suggestions = useResource(
    /* Asked again when the windows change: a window already offered is never suggested. */
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useCallback((signal: AbortSignal) => customAppsApi.maintenances.suggest(maintenance.id, signal), [maintenance.id, maintenance.estimated_minutes, windowsKey]),
  );
  const heatmap = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.apps.heatmap(maintenance.app_id, {installation_id: single || undefined}, signal),
      [maintenance.app_id, single],
    ),
  );

  const add = useMutation(
    useCallback(
      (suggestion: MaintenanceSuggestion) =>
        customAppsApi.maintenances.addWindow(maintenance.id, {starts_at: suggestion.starts_at, ends_at: suggestion.ends_at, source: "suggested"}),
      [maintenance.id],
    ),
  );
  const [adding, setAdding] = useState<string | null>(null);
  const {reset} = add;
  useEffect(() => reset(), [windowsKey, reset]);

  const data = suggestions.data;
  const offered = new Set(maintenance.windows.map((window) => window.starts_at));

  /* The cells each suggestion covers, with its rank: the scored hours from its start, on Santiago's clock. */
  const marks = useMemo(() => {
    const map = new Map<string, string>();
    for (const suggestion of data?.suggestions ?? []) {
      for (let hour = 0; hour < (data?.scored_hours ?? 1); hour += 1) {
        const slot = zonedSlot(new Date(new Date(suggestion.starts_at).getTime() + hour * 3_600_000), timezone);
        const key = `${slot.weekday}:${slot.hour}`;
        if (!map.has(key)) map.set(key, String(suggestion.rank));
      }
    }
    return map;
  }, [data, timezone]);

  const choose = async (suggestion: MaintenanceSuggestion) => {
    setAdding(suggestion.starts_at);
    const outcome = await add.run(suggestion);
    setAdding(null);
    if (outcome.ok) onChanged(outcome.data);
  };

  const grid = heatmap.data;
  const weekdayLabels = WEEKDAYS.map((day) => t(`custom_apps:weekdays_short.${day}`));

  return (
    <Panel
      title={t("custom_apps:maintenance_windows.suggest_title")}
      description={
        data
          ? t("custom_apps:maintenance_windows.suggest_description", {
              days: data.days,
              lead: data.min_lead_hours,
              heatmap: data.heatmap_days,
              hours: data.scored_hours,
            })
          : undefined
      }
      action={
        <Button variant="ghost" size="sm" onClick={suggestions.reload} disabled={suggestions.loading}>
          <Lightbulb size={14} /> {t("custom_apps:maintenance_windows.suggest_again")}
        </Button>
      }
    >
      <PanelState loading={suggestions.loading && !data} error={data ? null : suggestions.error} onRetry={suggestions.reload} ns="admin">
        {data && (
          <div className="flex flex-col gap-5">
            <p className="text-[12px] leading-relaxed text-neutral-500">
              {data.operating_hours_applied ? t("custom_apps:maintenance_windows.hours_applied") : t("custom_apps:maintenance_windows.hours_not_applied")}{" "}
              {maintenance.installation_ids.length > 1 && t("custom_apps:maintenance_windows.heatmap_scope_note", {count: maintenance.installation_ids.length})}
            </p>

            {data.suggestions.length === 0 ? (
              <Alert tone="info" title={t("custom_apps:maintenance_windows.no_suggestions_title")}>
                {t("custom_apps:maintenance_windows.no_suggestions_body")}
              </Alert>
            ) : (
              <ol className="flex flex-col gap-2">
                {data.suggestions.map((suggestion) => {
                  const already = offered.has(suggestion.starts_at);
                  return (
                    <li key={suggestion.starts_at} className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-3 py-2.5">
                      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/15 text-[12px] text-emerald-200 tabular-nums">
                        {suggestion.rank}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-text">{formatZonedWindow(suggestion.starts_at, suggestion.ends_at, language, timezone)}</p>
                        <p className="text-[12px] text-neutral-500">
                          {suggestion.expected_active_seconds > 0
                            ? t("custom_apps:maintenance_windows.expected_use", {time: formatDuration(suggestion.expected_active_seconds)})
                            : t("custom_apps:maintenance_windows.expected_none")}
                        </p>
                      </div>
                      <Button size="sm" variant="secondary" onClick={() => void choose(suggestion)} disabled={already || add.pending}>
                        {adding === suggestion.starts_at ? <Spinner size={14} /> : already ? <CheckCircle size={14} /> : <Plus size={14} />}
                        {already ? t("custom_apps:maintenance_windows.added") : t("custom_apps:maintenance_windows.add_suggestion")}
                      </Button>
                    </li>
                  );
                })}
              </ol>
            )}

            {add.error && (
              <Alert tone="error" title={t("admin:common.failed")}>
                {describeFailure(add.status, add.error)}
              </Alert>
            )}

            {grid && grid.max > 0 ? (
              <Heatmap
                cells={grid.cells}
                max={grid.max}
                rowLabels={weekdayLabels}
                columnLabels={HOURS}
                showColumnLabel={(column) => column % 3 === 0}
                outline={app?.operating_hours ? (row, column) => isWithinHours(app.operating_hours, WEEKDAYS[row], column) : undefined}
                mark={(row, column) => marks.get(`${row}:${column}`) ?? null}
                describe={(row, column) => {
                  const rank = marks.get(`${row}:${column}`);
                  const cell = t("custom_apps:usage.cell", {
                    day: t(`custom_apps:weekdays.${WEEKDAYS[row]}`),
                    from: `${HOURS[column]}:00`,
                    to: `${HOURS[(column + 1) % 24]}:00`,
                    active: formatDuration(grid.cells[row]?.[column] ?? 0),
                    online: formatDuration(grid.online?.[row]?.[column] ?? 0),
                  });
                  return rank ? `${cell} · ${t("custom_apps:maintenance_windows.suggestion_cell", {rank})}` : cell;
                }}
                legend={{
                  low: t("custom_apps:usage.legend_low"),
                  high: formatDuration(grid.max) ?? "",
                  outline: app?.operating_hours ? t("custom_apps:usage.legend_hours") : undefined,
                  mark: t("custom_apps:maintenance_windows.legend_suggestion"),
                }}
                label={t("custom_apps:maintenance_windows.heatmap_label")}
                hint={t("custom_apps:usage.heatmap_hint")}
              />
            ) : heatmap.loading ? null : (
              <p className="text-[12px] text-neutral-500">{t("custom_apps:usage.empty")}</p>
            )}
          </div>
        )}
      </PanelState>
    </Panel>
  );
};
