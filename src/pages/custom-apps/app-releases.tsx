import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {ArrowClockwise, CaretRight, Package} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatLastSeen, formatNumber} from "@/lib/custom-apps/format.ts";
import type {Arch, Channel, Platform, ReleaseListItem, ReleaseStatus} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {ReleaseStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {ModuleGate} from "@/pages/custom-apps/components/module-gate.tsx";
import {CiUploadHelp} from "@/pages/custom-apps/components/releases/ci-upload-help.tsx";
import {releaseLine} from "@/pages/custom-apps/components/releases/release-format.ts";

const PAGE_SIZE = 25;

type Filters = {channel: "" | Channel; platform: "" | Platform; arch: "" | Arch; status: "" | ReleaseStatus};
const NO_FILTERS: Filters = {channel: "", platform: "", arch: "", status: ""};

/** The share of the line a release reaches, as a figure and a thin bar under it. */
const RolloutCell = ({release}: {release: ReleaseListItem}) => {
  const {t} = useTranslation("custom_apps");
  if (release.status === "draft") return <span className="text-neutral-600">—</span>;
  const named = release.rollout_installations.length;
  return (
    <span className="flex flex-col gap-1">
      <span className="tabular-nums">
        {release.rollout_percent} %
        {named > 0 && <span className="text-[12px] text-neutral-500"> {t("releases.named_short", {count: named})}</span>}
      </span>
      <span className="h-1 w-20 overflow-hidden rounded-full bg-neutral-800" aria-hidden="true">
        <span
          className={cn("block h-full rounded-full", release.status === "published" ? "bg-emerald-400/80" : "bg-neutral-600")}
          style={{width: `${release.rollout_percent}%`}}
        />
      </span>
    </span>
  );
};

/**
 * The app's releases, newest upload first. They arrive from CI as drafts — the panel never uploads
 * one — and everything after that is decided on each release's own page.
 *
 * With nothing uploaded yet, the screen is the instructions: the key pair, the CI token and the
 * upload command for this app, with the first two ticked off once they exist.
 */
export const AppReleases = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const {app} = useApp();
  const {channels, platforms, arches, releaseStatuses, releaseMaxBytes} = useServiceVocabulary();
  const language = i18n.language;
  const [filters, setFilters] = useState<Filters>(NO_FILTERS);
  const [offset, setOffset] = useState(0);

  const releases = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.releases.list(
          app.id,
          {
            channel: filters.channel || undefined,
            platform: filters.platform || undefined,
            arch: filters.arch || undefined,
            status: filters.status || undefined,
            limit: PAGE_SIZE,
            offset,
          },
          signal,
        ),
      [app.id, filters, offset],
    ),
  );
  const tokens = useResource(useCallback((signal: AbortSignal) => customAppsApi.ciTokens.list(app.id, signal), [app.id]));

  const hasKey = Boolean(app.release_public_key);
  const hasToken = tokens.data ? tokens.data.some((token) => !token.revoked_at) : null;
  const rows = releases.data?.data ?? [];
  const filtered = Object.values(filters).some(Boolean);
  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((current) => ({...current, [key]: value}));
    setOffset(0);
  };

  const columns = useMemo<Column<ReleaseListItem>[]>(
    () => [
      {
        key: "version",
        header: t("custom_apps:releases.columns.version"),
        cell: (row) => (
          <div className="min-w-0">
            <p className="font-mono text-sm text-text">{row.version}</p>
            <p className="truncate font-mono text-[11px] text-neutral-600" title={row.filename}>
              {row.filename}
            </p>
          </div>
        ),
      },
      {
        key: "line",
        header: t("custom_apps:releases.columns.line"),
        cell: (row) => <span className="text-[13px] whitespace-nowrap">{releaseLine(row, t)}</span>,
      },
      {
        key: "status",
        header: t("custom_apps:releases.columns.status"),
        className: "w-32",
        cell: (row) => (
          <span className="flex flex-col items-start gap-1">
            <ReleaseStatusBadge value={row.status} />
            {row.status === "paused" && row.status_reason?.automatic && (
              <span className="text-[11px] text-amber-300/80">{t("custom_apps:releases.auto_paused")}</span>
            )}
          </span>
        ),
      },
      {
        key: "rollout",
        header: t("custom_apps:releases.columns.rollout"),
        className: "w-28",
        cell: (row) => <RolloutCell release={row} />,
      },
      {
        key: "devices",
        header: t("custom_apps:releases.columns.devices"),
        className: "w-40",
        cell: (row) => (
          <span className="flex flex-col text-[12px] text-neutral-400 tabular-nums">
            <span>{t("custom_apps:releases.installed", {count: row.installed_count, value: formatNumber(row.installed_count, language)})}</span>
            <span className="text-emerald-300/80">
              {t("custom_apps:releases.healthy", {count: row.healthy_count, value: formatNumber(row.healthy_count, language)})}
            </span>
            {row.rolled_back_count > 0 && (
              <span className="text-red-300/90">
                {t("custom_apps:releases.rolled_back", {count: row.rolled_back_count, value: formatNumber(row.rolled_back_count, language)})}
              </span>
            )}
          </span>
        ),
      },
      {
        key: "dates",
        header: t("custom_apps:releases.columns.dates"),
        className: "w-40",
        hideBelowLg: true,
        cell: (row) => (
          <span className="flex flex-col text-[12px] text-neutral-400">
            <time dateTime={row.created_at} title={formatDateTime(row.created_at, language) ?? undefined}>
              {t("custom_apps:releases.uploaded", {when: formatLastSeen(row.created_at, language)})}
            </time>
            {row.published_at && (
              <time dateTime={row.published_at} title={formatDateTime(row.published_at, language) ?? undefined}>
                {t("custom_apps:releases.published", {when: formatLastSeen(row.published_at, language)})}
              </time>
            )}
          </span>
        ),
      },
    ],
    [language, t],
  );

  const select = <K extends keyof Filters>(key: K, label: string, anyLabel: string, values: readonly string[], prefix: string) => (
    <Select
      value={filters[key]}
      onChange={(event) => setFilter(key, event.target.value as Filters[K])}
      aria-label={label}
      className="w-auto min-w-[9rem]"
    >
      <option value="">{anyLabel}</option>
      {values.map((value) => (
        <option key={value} value={value}>
          {t(`custom_apps:${prefix}.${value}`, {defaultValue: value})}
        </option>
      ))}
    </Select>
  );

  const nothingYet = releases.data && rows.length === 0 && !filtered;

  return (
    <ModuleGate modules={["updates"]}>
      <div className="flex flex-col gap-6">
        {releases.data && !nothingYet && (hasKey === false || hasToken === false) && (
          <Alert tone="info" title={t("custom_apps:releases.setup_incomplete_title")}>
            {!hasKey ? t("custom_apps:releases.setup_no_key") : t("custom_apps:releases.setup_no_token")}{" "}
            <Link to={customAppsRoute.appSettings(app.id)} className="underline">
              {t("custom_apps:releases.help.settings_link")}
            </Link>
          </Alert>
        )}

        <Panel
          title={t("custom_apps:releases.title")}
          description={
            releases.data && !nothingYet
              ? t("custom_apps:releases.count", {count: releases.data.pagination.total})
              : t("custom_apps:releases.description")
          }
          action={
            <Button variant="ghost" size="sm" onClick={releases.reload} disabled={releases.loading}>
              <ArrowClockwise size={14} className={releases.loading ? "animate-spin" : undefined} />
              {t("admin:common.refresh")}
            </Button>
          }
        >
          {!nothingYet && (
            <div className="mb-5 flex flex-wrap items-center gap-3">
              {select("channel", t("custom_apps:releases.filters.channel"), t("custom_apps:releases.filters.any_channel"), channels, "channels")}
              {select("platform", t("custom_apps:releases.filters.platform"), t("custom_apps:releases.filters.any_platform"), platforms, "platforms")}
              {select("arch", t("custom_apps:releases.filters.arch"), t("custom_apps:releases.filters.any_arch"), arches, "arches")}
              {select("status", t("custom_apps:releases.filters.status"), t("custom_apps:releases.filters.any_status"), releaseStatuses, "release_statuses")}
              {filtered && (
                <Button variant="ghost" size="sm" onClick={() => {
                  setFilters(NO_FILTERS);
                  setOffset(0);
                }}>
                  {t("admin:common.clear_filters")}
                </Button>
              )}
            </div>
          )}

          <PanelState
            loading={releases.loading && !releases.data}
            error={releases.data ? null : releases.error}
            onRetry={releases.reload}
            ns="admin"
          >
            {nothingYet ? (
              <div className="flex flex-col gap-6">
                <div className="flex items-start gap-3">
                  <Package size={28} className="mt-0.5 shrink-0 text-neutral-600" aria-hidden="true" />
                  <div>
                    <p className="text-sm text-text">{t("custom_apps:releases.empty")}</p>
                    <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{t("custom_apps:releases.empty_description")}</p>
                  </div>
                </div>
                <CiUploadHelp appId={app.id} hasKey={hasKey} hasToken={hasToken} maxBytes={releaseMaxBytes} />
              </div>
            ) : rows.length === 0 ? (
              <p className="py-4 text-sm text-neutral-500">{t("custom_apps:releases.no_matches")}</p>
            ) : (
              <DataTable
                columns={columns}
                rows={rows}
                rowKey={(row) => row.id}
                onRowClick={(row) => navigate(customAppsRoute.release(row.id))}
                caption={t("custom_apps:releases.title")}
                className={releases.loading ? "opacity-60 transition-opacity" : undefined}
              />
            )}
            {!nothingYet && (
              <Pagination
                offset={offset}
                limit={PAGE_SIZE}
                count={rows.length}
                total={releases.data?.pagination.total}
                onChange={setOffset}
                disabled={releases.loading}
              />
            )}
          </PanelState>
        </Panel>

        {!nothingYet && releases.data && (
          <details className="group rounded-[var(--radius-lg)] bg-surface px-6 py-4 shadow-[var(--shadow-sm)]">
            <summary className="flex cursor-pointer items-center gap-2 text-sm text-neutral-300 transition-colors hover:text-text">
              <CaretRight size={14} className="transition-transform group-open:rotate-90" aria-hidden="true" />
              {t("custom_apps:releases.help.title")}
            </summary>
            <div className="mt-5">
              <CiUploadHelp appId={app.id} hasKey={hasKey} hasToken={hasToken} maxBytes={releaseMaxBytes} />
            </div>
          </details>
        )}
      </div>
    </ModuleGate>
  );
};
