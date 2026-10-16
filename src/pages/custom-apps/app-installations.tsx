import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {ArrowClockwise, Devices} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {InstallationStatus, InstallationSummary} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {ConnectedIndicator, LifecycleBadge, ReviewBadge, SocketBadge} from "@/pages/custom-apps/components/badges.tsx";
import {describePlatform, installationLabel} from "@/pages/custom-apps/components/installation-label.ts";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";

const PAGE_SIZE = 50;
const REFRESH_MS = 15_000;

type TriState = "" | "true" | "false";

const asBoolean = (value: TriState) => (value === "" ? undefined : value === "true");

/**
 * Every device an app is installed on, with whether it is connected right now.
 *
 * Refreshed every fifteen seconds while the tab is visible: "connected" is derived from the last
 * heartbeat, and a list that was right when it loaded stops being right within a couple of intervals.
 * The refresh keeps the rows on screen rather than flashing a spinner, so reading the table is never
 * interrupted by it.
 */
export const AppInstallations = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const {app} = useApp();
  const [search, setSearch] = useState("");
  const [debounced] = useDebounceValue(search.trim(), 300);
  const [connected, setConnected] = useState<TriState>("");
  const [needsReview, setNeedsReview] = useState<TriState>("");
  const [status, setStatus] = useState<"" | InstallationStatus>("");
  const [offset, setOffset] = useState(0);

  const installations = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.apps.installations(
          app.id,
          {
            search: debounced,
            connected: asBoolean(connected),
            needs_review: asBoolean(needsReview),
            status: status || undefined,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [app.id, debounced, connected, needsReview, status, offset],
    ),
  );
  useAutoRefresh(installations.reload, REFRESH_MS);

  const rows = installations.data?.data ?? [];
  const total = installations.data?.pagination.total ?? 0;
  const filtered = Boolean(debounced || connected || needsReview || status);

  const filter = (apply: () => void) => {
    apply();
    setOffset(0);
  };

  const columns = useMemo<Column<InstallationSummary>[]>(
    () => [
      {
        key: "connected",
        header: <span className="sr-only">{t("custom_apps:installations.columns.connected")}</span>,
        className: "w-8",
        cell: (row) => <ConnectedIndicator connected={row.connected} compact />,
      },
      {
        key: "name",
        header: t("custom_apps:installations.columns.device"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="flex items-center gap-2 text-sm text-text">
              <span className="truncate">{installationLabel(row)}</span>
              {row.status === "revoked" ? <LifecycleBadge status="revoked" /> : row.needs_review ? <ReviewBadge /> : null}
              {row.socket_connected && row.status !== "revoked" && <SocketBadge />}
            </p>
            {row.alias && row.hostname && <p className="truncate text-[12px] text-neutral-500">{row.hostname}</p>}
          </div>
        ),
      },
      {
        key: "platform",
        header: t("custom_apps:installations.columns.platform"),
        className: "w-48",
        hideBelowLg: true,
        cell: (row) => (
          <div className="min-w-0">
            <p className="text-[13px]">{t(`custom_apps:platforms.${row.platform}`, {defaultValue: row.platform})}</p>
            <p className="truncate text-[12px] text-neutral-500">{describePlatform(row)}</p>
          </div>
        ),
      },
      {
        key: "version",
        header: t("custom_apps:installations.columns.version"),
        className: "w-32",
        cell: (row) => (
          <span className="flex flex-col">
            <span className="font-mono text-[13px]">{row.app_version ?? "—"}</span>
            <span className="text-[12px] text-neutral-500">{t(`custom_apps:channels.${row.channel}`, {defaultValue: row.channel})}</span>
          </span>
        ),
      },
      {
        key: "seen",
        header: t("custom_apps:installations.columns.last_seen"),
        className: "w-36",
        cell: (row) =>
          row.last_seen_at ? (
            <time dateTime={row.last_seen_at} title={formatDateTime(row.last_seen_at, i18n.language) ?? undefined}>
              {formatLastSeen(row.last_seen_at, i18n.language)}
            </time>
          ) : (
            <span className="text-neutral-600">{t("custom_apps:installations.never_seen")}</span>
          ),
      },
    ],
    [i18n.language, t],
  );

  const triStateSelect = (
    value: TriState,
    onChange: (value: TriState) => void,
    label: string,
    yes: string,
    no: string,
  ) => (
    <Select
      value={value}
      onChange={(event) => filter(() => onChange(event.target.value as TriState))}
      aria-label={label}
      className="w-auto min-w-[10rem]"
    >
      <option value="">{label}</option>
      <option value="true">{yes}</option>
      <option value="false">{no}</option>
    </Select>
  );

  return (
    <Panel
      title={t("custom_apps:installations.title")}
      description={
        installations.data ? t("custom_apps:installations.count", {count: total}) : t("custom_apps:installations.description")
      }
      action={
        <Button variant="ghost" size="sm" onClick={installations.reload} disabled={installations.loading}>
          <ArrowClockwise size={14} className={installations.loading ? "animate-spin" : undefined} />
          {t("admin:common.refresh")}
        </Button>
      }
    >
      <div className="mb-5 flex flex-wrap items-center gap-3">
        <SearchBox
          value={search}
          onChange={(value) => filter(() => setSearch(value))}
          placeholder={t("custom_apps:installations.search")}
        />
        {triStateSelect(
          connected,
          setConnected,
          t("custom_apps:installations.filters.connection"),
          t("custom_apps:installations.connected"),
          t("custom_apps:installations.offline"),
        )}
        {triStateSelect(
          needsReview,
          setNeedsReview,
          t("custom_apps:installations.filters.review"),
          t("custom_apps:installations.needs_review"),
          t("custom_apps:installations.reviewed"),
        )}
        <Select
          value={status}
          onChange={(event) => filter(() => setStatus(event.target.value as "" | InstallationStatus))}
          aria-label={t("custom_apps:installations.filters.status")}
          className="w-auto min-w-[10rem]"
        >
          <option value="">{t("custom_apps:installations.filters.status")}</option>
          <option value="active">{t("custom_apps:lifecycle.active")}</option>
          <option value="revoked">{t("custom_apps:lifecycle.revoked")}</option>
        </Select>
        {filtered && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() =>
              filter(() => {
                setSearch("");
                setConnected("");
                setNeedsReview("");
                setStatus("");
              })
            }
          >
            {t("admin:common.clear_filters")}
          </Button>
        )}
      </div>

      <PanelState
        loading={installations.loading && !installations.data}
        error={installations.data ? null : installations.error}
        forbidden={installations.status === 403}
        onRetry={installations.reload}
        ns="admin"
      >
        {rows.length === 0 ? (
          filtered ? (
            <p className="py-4 text-sm text-neutral-500">{t("custom_apps:installations.no_matches")}</p>
          ) : (
            <EmptyState
              icon={<Devices size={28} />}
              title={t("custom_apps:installations.empty_title")}
              description={t("custom_apps:installations.empty_description")}
            />
          )
        ) : (
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            onRowClick={(row) => navigate(customAppsRoute.installation(row.id))}
            caption={t("custom_apps:installations.title")}
          />
        )}

        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={total}
          onChange={setOffset}
          disabled={installations.loading}
        />
      </PanelState>
    </Panel>
  );
};
