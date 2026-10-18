import {useCallback, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ClockCounterClockwise} from "@phosphor-icons/react";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {AuditEntry, AuditQuery} from "@/lib/custom-apps/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";

const PAGE_SIZE = 10;

/**
 * A slice of the audit log about one record, newest first — a contract's history, an installation's
 * support requests. The full log, with its before/after diffs, stays at `/custom-apps/audit-log`;
 * this is the part of it a record's own page is asked about.
 *
 * `describe` renders the line under each event — the reason a contract was cancelled, the subject of
 * a support request — from the entry's metadata, which only the caller knows how to read.
 */
export const AuditTrail = ({
  title,
  description,
  query,
  describe,
  emptyTitle,
  emptyDescription,
  icon,
  systemActor,
}: {
  title: string;
  description?: string;
  query: Pick<AuditQuery, "event" | "resource_type" | "resource_id">;
  describe?: (entry: AuditEntry) => ReactNode;
  emptyTitle: string;
  emptyDescription?: string;
  icon?: ReactNode;
  /** Who an entry without an actor came from, when it is not the service — a device, for support requests. */
  systemActor?: string;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const language = i18n.language;
  const [offset, setOffset] = useState(0);
  const {event, resource_type: resourceType, resource_id: resourceId} = query;

  const entries = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.audit({event, resource_type: resourceType, resource_id: resourceId, limit: PAGE_SIZE, offset}, signal),
      [event, resourceType, resourceId, offset],
    ),
  );
  const rows = entries.data?.data ?? [];

  return (
    <Panel
      title={title}
      description={description}
      action={
        <Link to={customAppsRoute.audit} className="text-[13px] text-neutral-400 hover:text-text hover:underline">
          {t("custom_apps:audit_trail.full_log")}
        </Link>
      }
    >
      <PanelState loading={entries.loading && !entries.data} error={entries.error} onRetry={entries.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={icon ?? <ClockCounterClockwise size={28} />} title={emptyTitle} description={emptyDescription} />
        ) : (
          <ul className={entries.loading ? "opacity-60 transition-opacity" : undefined}>
            {rows.map((entry) => {
              const line = describe?.(entry);
              return (
                <li key={entry.id} className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-neutral-800/70 py-3 last:border-0">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-text">{t(`custom_apps:audit.events.${entry.event}`, {defaultValue: entry.event})}</p>
                    {line && <div className="mt-0.5 text-[13px] text-neutral-400">{line}</div>}
                    <p className="mt-0.5 text-[12px] text-neutral-500">
                      {entry.actor_email || entry.actor_id || (
                        <span className="italic">
                          {entry.metadata?.automatic === true
                            ? t("custom_apps:audit.automatic")
                            : (systemActor ?? t("custom_apps:audit.system"))}
                        </span>
                      )}
                    </p>
                  </div>
                  <time dateTime={entry.created_at} title={entry.created_at} className="shrink-0 text-xs text-neutral-500">
                    {formatDateTime(entry.created_at, language)}
                    <span className="text-neutral-600"> · {formatLastSeen(entry.created_at, language)}</span>
                  </time>
                </li>
              );
            })}
          </ul>
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
  );
};
