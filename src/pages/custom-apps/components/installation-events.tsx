import {useCallback, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {CaretRight, ListBullets} from "@phosphor-icons/react";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {UsageEvent} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";

const PAGE_SIZE = 25;

/** The event types the ingest accepts. A type the service adds later still lists, just unfiltered. */
const EVENT_TYPES = ["session_start", "session_end", "screen", "action", "custom"] as const;

const EventItem = ({event}: {event: UsageEvent}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const properties = event.properties && Object.keys(event.properties).length > 0 ? JSON.stringify(event.properties, null, 2) : null;

  return (
    <li className="border-b border-neutral-800/70 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <p className="flex min-w-0 items-center gap-2 text-sm">
          <span className="rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 px-1.5 py-0.5 font-mono text-[11px] text-neutral-300">
            {t(`events.types.${event.type}`, {defaultValue: event.type})}
          </span>
          {event.name && <span className="truncate text-text">{event.name}</span>}
        </p>
        <time dateTime={event.occurred_at} title={event.occurred_at} className="shrink-0 text-xs text-neutral-500">
          {formatDateTime(event.occurred_at, i18n.language)}
          <span className="text-neutral-600"> · {formatLastSeen(event.occurred_at, i18n.language)}</span>
        </time>
      </div>
      {(event.session_id || properties) && (
        <div className="mt-1 flex flex-wrap items-center gap-3 text-[12px] text-neutral-500">
          {event.session_id && (
            <span className="font-mono" title={event.session_id}>
              {t("events.session", {id: event.session_id.slice(0, 8)})}
            </span>
          )}
          {properties && (
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={detailsId}
              className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text"
            >
              <CaretRight size={12} className={cn("transition-transform", open && "rotate-90")} aria-hidden="true" />
              {open ? t("events.hide_properties") : t("events.show_properties")}
            </button>
          )}
        </div>
      )}
      {open && properties && (
        <pre
          id={detailsId}
          className="mt-2 max-h-64 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300"
        >
          {properties}
        </pre>
      )}
    </li>
  );
};

/** What the app said happened on this device, newest first, as the client sent it. */
export const InstallationEvents = ({installationId}: {installationId: string}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [type, setType] = useState("");
  const [offset, setOffset] = useState(0);

  const events = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.installations.events(installationId, {type: type || undefined, limit: PAGE_SIZE, offset}, signal),
      [installationId, type, offset],
    ),
  );

  const rows = events.data?.data ?? [];

  return (
    <Panel
      title={t("custom_apps:events.title")}
      description={t("custom_apps:events.description")}
      action={
        <Select
          value={type}
          onChange={(event) => {
            setType(event.target.value);
            setOffset(0);
          }}
          aria-label={t("custom_apps:events.type")}
          className="h-9 w-auto text-[13px]"
        >
          <option value="">{t("custom_apps:events.any_type")}</option>
          {EVENT_TYPES.map((value) => (
            <option key={value} value={value}>
              {t(`custom_apps:events.types.${value}`)}
            </option>
          ))}
        </Select>
      }
    >
      <PanelState loading={events.loading && !events.data} error={events.error} onRetry={events.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={<ListBullets size={28} />} title={t("custom_apps:events.empty")} description={t("custom_apps:events.empty_description")} />
        ) : (
          <ul className={events.loading ? "opacity-60 transition-opacity" : undefined}>
            {rows.map((event) => (
              <EventItem key={event.id} event={event} />
            ))}
          </ul>
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={events.data?.pagination.total}
          onChange={setOffset}
          disabled={events.loading}
        />
      </PanelState>
    </Panel>
  );
};
