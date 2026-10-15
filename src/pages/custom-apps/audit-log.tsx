import {useCallback, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {ArrowClockwise, ClockCounterClockwise, MagnifyingGlassPlus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {AuditEntry} from "@/lib/custom-apps/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {AuditDiff} from "@/pages/custom-apps/components/audit-diff.tsx";

const PAGE_SIZE = 50;

/** The resource types worth suggesting in the filter. The service may write others; the field is free text. */
const RESOURCE_TYPES = ["company", "contact", "app", "app_key", "installation"] as const;

/** Where a resource lives in this panel, for the types that have a screen. */
const resourceRoute = (type: string | null, id: string | null) => {
  if (!type || !id) return null;
  switch (type) {
    case "company":
      return customAppsRoute.company(id);
    case "contact":
      return customAppsRoute.contact(id);
    case "app":
      return customAppsRoute.app(id);
    case "installation":
      return customAppsRoute.installation(id);
    default:
      return null;
  }
};

/** A `YYYY-MM-DD` from a date input as the instant that day starts, here; `endOfDay` for the bound after it. */
const dayBound = (value: string, endOfDay: boolean) => {
  if (!value) return undefined;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day + (endOfDay ? 1 : 0));
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
};

/**
 * Every write the panel made, newest first, and who made it.
 *
 * Unlike the CMS's log, this endpoint filters on the service — by event, resource, actor and date —
 * and reports a total, so the filters reach the whole log rather than the loaded page. An entry's
 * changes open in a dialog as a before/after table, because that is the question an audit log is
 * opened to answer.
 */
export const AuditLog = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const [event, setEvent] = useState("");
  const [resourceType, setResourceType] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [offset, setOffset] = useState(0);
  const [open, setOpen] = useState<AuditEntry | null>(null);
  const typesId = useId();

  const [filters] = useDebounceValue({event: event.trim(), resource_type: resourceType.trim(), actor: actor.trim()}, 300, {
    equalityFn: (a, b) => JSON.stringify(a) === JSON.stringify(b),
  });

  const entries = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.audit(
          {...filters, from: dayBound(from, false), to: dayBound(to, true), limit: PAGE_SIZE, offset},
          signal,
        ),
      [filters, from, to, offset],
    ),
  );

  const rows = entries.data?.data ?? [];
  const filtered = Boolean(event || resourceType || actor || from || to);

  const filter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  return (
    <>
      <PageHeader
        title={t("custom_apps:audit.title")}
        description={t("custom_apps:audit.description")}
        actions={
          <Button variant="secondary" size="sm" onClick={entries.reload} disabled={entries.loading}>
            <ArrowClockwise size={14} /> {t("admin:common.refresh")}
          </Button>
        }
      />

      <Panel
        title={t("custom_apps:audit.panel_title")}
        description={entries.data ? t("custom_apps:audit.count", {count: entries.data.pagination.total}) : undefined}
      >
        <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <Field label={t("custom_apps:audit.filters.event")} htmlFor="audit-event">
            <Input
              id="audit-event"
              value={event}
              onChange={(change) => filter(() => setEvent(change.target.value))}
              placeholder="app.status.updated"
              className="font-mono text-[13px]"
            />
          </Field>
          <Field label={t("custom_apps:audit.filters.resource")} htmlFor="audit-resource">
            <Input
              id="audit-resource"
              list={typesId}
              value={resourceType}
              onChange={(change) => filter(() => setResourceType(change.target.value))}
              className="font-mono text-[13px]"
            />
            <datalist id={typesId}>
              {RESOURCE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {t(`custom_apps:audit.resources.${type}`)}
                </option>
              ))}
            </datalist>
          </Field>
          <Field label={t("custom_apps:audit.filters.actor")} htmlFor="audit-actor">
            <Input
              id="audit-actor"
              value={actor}
              onChange={(change) => filter(() => setActor(change.target.value))}
              placeholder="fran@franciscosolis.cl"
            />
          </Field>
          <Field label={t("custom_apps:audit.filters.from")} htmlFor="audit-from">
            <Input id="audit-from" type="date" value={from} max={to || undefined} onChange={(change) => filter(() => setFrom(change.target.value))} />
          </Field>
          <Field label={t("custom_apps:audit.filters.to")} htmlFor="audit-to">
            <Input id="audit-to" type="date" value={to} min={from || undefined} onChange={(change) => filter(() => setTo(change.target.value))} />
          </Field>
        </div>
        {filtered && (
          <div className="-mt-2 mb-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() =>
                filter(() => {
                  setEvent("");
                  setResourceType("");
                  setActor("");
                  setFrom("");
                  setTo("");
                })
              }
            >
              {t("admin:common.clear_filters")}
            </Button>
          </div>
        )}

        <PanelState
          loading={entries.loading && !entries.data}
          error={entries.error}
          forbidden={entries.status === 403}
          onRetry={entries.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={<ClockCounterClockwise size={28} />}
              title={filtered ? t("custom_apps:audit.no_matches") : t("custom_apps:audit.empty")}
            />
          ) : (
            <div className={entries.loading ? "opacity-60 transition-opacity" : undefined}>
              <div className="-mx-6 overflow-x-auto px-6">
                <table className="w-full min-w-[44rem] border-collapse text-left">
                  <caption className="sr-only">{t("custom_apps:audit.title")}</caption>
                  <thead>
                    <tr className="border-b border-neutral-800">
                      {["when", "event", "actor", "resource", "origin", "details"].map((column) => (
                        <th
                          key={column}
                          scope="col"
                          className="py-2.5 pr-4 text-[12px] font-medium tracking-wide text-neutral-500 uppercase"
                        >
                          {column === "details" ? <span className="sr-only">{t("custom_apps:audit.columns.details")}</span> : t(`custom_apps:audit.columns.${column}`)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((entry) => {
                      const route = resourceRoute(entry.resource_type, entry.resource_id);
                      const resource = [entry.resource_type, entry.resource_id].filter(Boolean).join(" ");
                      return (
                        <tr key={entry.id} className="border-b border-neutral-800/70 align-top text-[13px] text-neutral-300 last:border-0">
                          <td className="py-3 pr-4 whitespace-nowrap">
                            <time dateTime={entry.created_at} title={entry.created_at}>
                              {formatDateTime(entry.created_at, language)}
                            </time>
                            <span className="block text-[12px] text-neutral-600">{formatLastSeen(entry.created_at, language)}</span>
                          </td>
                          <td className="py-3 pr-4">
                            <span className="block text-text">{t(`custom_apps:audit.events.${entry.event}`, {defaultValue: entry.event})}</span>
                            <span className="block font-mono text-[11px] text-neutral-600">{entry.event}</span>
                          </td>
                          <td className="py-3 pr-4 break-all">
                            {entry.actor_email || entry.actor_id || <span className="text-neutral-600 italic">{t("custom_apps:audit.system")}</span>}
                          </td>
                          <td className="py-3 pr-4">
                            {resource ? (
                              route ? (
                                <Link to={route} className="font-mono text-[12px] break-all hover:text-text hover:underline">
                                  {resource}
                                </Link>
                              ) : (
                                <span className="font-mono text-[12px] break-all">{resource}</span>
                              )
                            ) : (
                              <span className="text-neutral-600">—</span>
                            )}
                          </td>
                          <td className="py-3 pr-4 text-[12px] text-neutral-500">
                            {entry.ip && <span className="block font-mono">{entry.ip}</span>}
                            {entry.user_agent && <span title={entry.user_agent}>{describeUserAgent(entry.user_agent)}</span>}
                          </td>
                          <td className="py-3 text-right">
                            {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setOpen(entry)}
                                aria-label={t("custom_apps:audit.view_aria", {event: entry.event})}
                              >
                                <MagnifyingGlassPlus size={14} /> {t("custom_apps:audit.view")}
                              </Button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={entries.data?.pagination.total}
            onChange={setOffset}
            disabled={entries.loading}
          />
        </PanelState>
      </Panel>

      <Modal
        open={open !== null}
        onClose={() => setOpen(null)}
        title={open ? t(`custom_apps:audit.events.${open.event}`, {defaultValue: open.event}) : undefined}
        className="max-w-3xl"
      >
        {open && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-neutral-500">
              {[formatDateTime(open.created_at, language), open.actor_email || open.actor_id, [open.resource_type, open.resource_id].filter(Boolean).join(" ")]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {open.metadata && <AuditDiff metadata={open.metadata} />}
          </div>
        )}
      </Modal>
    </>
  );
};
