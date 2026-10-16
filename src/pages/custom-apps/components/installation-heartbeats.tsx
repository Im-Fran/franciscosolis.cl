import {useCallback, useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {CaretRight, Heartbeat} from "@phosphor-icons/react";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatBytes, formatDuration, formatLastSeen, formatPercent} from "@/lib/custom-apps/format.ts";
import type {HeartbeatEntry} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";

const PAGE_SIZE = 25;

const HeartbeatItem = ({entry}: {entry: HeartbeatEntry}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const language = i18n.language;
  const snapshot = entry.snapshot && Object.keys(entry.snapshot).length > 0 ? entry.snapshot : null;

  const cpu = formatPercent(snapshot?.cpu_percent, language, 1);
  const used = formatBytes(snapshot?.memory_used_bytes, language);
  const total = formatBytes(snapshot?.memory_total_bytes, language);

  /* The gauges worth reading at a glance; the full snapshot is one click away. */
  const facts = [
    entry.app_version ? t("heartbeats.version", {version: entry.app_version}) : null,
    entry.active_seconds !== null ? t("heartbeats.active", {active: formatDuration(entry.active_seconds)}) : null,
    entry.credited_seconds > 0 ? t("heartbeats.credited", {credited: formatDuration(entry.credited_seconds)}) : null,
    cpu ? t("heartbeats.cpu", {value: cpu}) : null,
    used && total ? t("heartbeats.memory", {used, total}) : null,
  ].filter((fact): fact is string => fact !== null);

  return (
    <li className="border-b border-neutral-800/70 py-3 last:border-0">
      <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <time dateTime={entry.received_at} title={entry.received_at} className="text-sm text-text">
          {formatDateTime(entry.received_at, language)}
          <span className="text-neutral-500"> · {formatLastSeen(entry.received_at, language)}</span>
        </time>
        {entry.ip && <span className="font-mono text-[12px] text-neutral-500">{t("heartbeats.from_ip", {ip: entry.ip})}</span>}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-neutral-500">
        {facts.map((fact) => (
          <span key={fact}>{fact}</span>
        ))}
        {entry.credited_seconds === 0 && <span className="text-neutral-600">{t("heartbeats.not_credited")}</span>}
        {snapshot ? (
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={detailsId}
            className="inline-flex cursor-pointer items-center gap-1 transition-colors hover:text-text"
          >
            <CaretRight size={12} className={cn("transition-transform", open && "rotate-90")} aria-hidden="true" />
            {open ? t("heartbeats.hide_snapshot") : t("heartbeats.show_snapshot")}
          </button>
        ) : (
          <span className="text-neutral-600">{t("heartbeats.no_snapshot")}</span>
        )}
      </div>
      {open && snapshot && (
        <pre
          id={detailsId}
          className="mt-2 max-h-64 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300"
        >
          {JSON.stringify(snapshot, null, 2)}
        </pre>
      )}
    </li>
  );
};

/**
 * Every heartbeat the device sent, as the service received it.
 *
 * The charts above deliberately show one point per minute — the last heartbeat of it — so a device
 * that reports every few seconds does not crowd them. This is the other half of that decision: the
 * complete record, for when the question is "what exactly did this device send, and when".
 */
export const InstallationHeartbeats = ({installationId}: {installationId: string}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [offset, setOffset] = useState(0);

  const heartbeats = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.installations.heartbeats(installationId, {limit: PAGE_SIZE, offset}, signal),
      [installationId, offset],
    ),
  );

  const rows = heartbeats.data?.data ?? [];

  return (
    <Panel title={t("custom_apps:heartbeats.title")} description={t("custom_apps:heartbeats.description")}>
      <PanelState loading={heartbeats.loading && !heartbeats.data} error={heartbeats.error} onRetry={heartbeats.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Heartbeat size={28} />}
            title={t("custom_apps:heartbeats.empty")}
            description={t("custom_apps:heartbeats.empty_description")}
          />
        ) : (
          <ul className={heartbeats.loading ? "opacity-60 transition-opacity" : undefined}>
            {rows.map((entry) => (
              <HeartbeatItem key={entry.id} entry={entry} />
            ))}
          </ul>
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={heartbeats.data?.pagination.total}
          onChange={setOffset}
          disabled={heartbeats.loading}
        />
      </PanelState>
    </Panel>
  );
};
