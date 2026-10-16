import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Code, Devices, Plugs, Warning} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatDuration} from "@/lib/custom-apps/format.ts";
import {WEEKDAYS} from "@/lib/custom-apps/types.ts";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {CopyButton, CopyField} from "@/pages/custom-apps/components/copy-button.tsx";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";
import {StatCard} from "@/pages/custom-apps/components/stat-card.tsx";

/**
 * The `<script>` tag a web app pastes into its page. Subresource integrity pins the exact bytes the
 * service published, and `crossorigin` is what lets the browser check them across origins.
 */
const scriptTag = (url: string, integrity: string) =>
  `<script src="${url}" integrity="${integrity}" crossorigin="anonymous" async></script>`;

/**
 * What an app is and how to wire a client to it: its counts, its facts, and the ingest addresses —
 * the only part of the service the client app ever talks to.
 */
export const AppSummary = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {app} = useApp();
  const isWeb = app.kind === "web";

  const sdk = useResource(
    useCallback((signal: AbortSignal) => (isWeb ? customAppsApi.apps.sdk(app.id, signal) : Promise.resolve(null)), [app.id, isWeb]),
  );

  const hours = app.operating_hours;
  const openDays = hours ? WEEKDAYS.filter((day) => (hours.days[day] ?? []).length > 0) : [];

  return (
    <div className="flex flex-col gap-6">
      {app.state !== "active" && (
        <Alert tone={app.state === "suspended" ? "error" : "info"} title={t(`custom_apps:status.banner.${app.state}`, {defaultValue: app.state})}>
          {[app.state_message, app.state_until && t("custom_apps:status.until_value", {date: formatDateTime(app.state_until, i18n.language)})]
            .filter(Boolean)
            .join(" · ") || t("custom_apps:status.no_message")}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label={t("custom_apps:summary.connected")}
          icon={<Plugs size={18} />}
          value={app.connected_count}
          detail={t("custom_apps:summary.connected_detail", {
            interval: formatDuration(app.heartbeat_interval_seconds),
          })}
          to={customAppsRoute.appInstallations(app.id)}
        />
        <StatCard
          label={t("custom_apps:summary.installations")}
          icon={<Devices size={18} />}
          value={app.installation_count}
          to={customAppsRoute.appInstallations(app.id)}
        />
        <StatCard
          label={t("custom_apps:summary.needs_review")}
          icon={<Warning size={18} />}
          value={app.needs_review_count}
          attention={app.needs_review_count > 0}
          to={customAppsRoute.appInstallations(app.id)}
        />
      </div>

      <Panel title={t("custom_apps:summary.details")}>
        <DetailList>
          <Detail label={t("custom_apps:apps.fields.company")}>
            <Link to={customAppsRoute.company(app.company_id)} className="hover:underline">
              {app.company?.trade_name || app.company?.legal_name || app.company_id}
            </Link>
          </Detail>
          <Detail label={t("custom_apps:apps.fields.kind")}>{t(`custom_apps:kinds.${app.kind}`, {defaultValue: app.kind})}</Detail>
          <Detail label={t("custom_apps:apps.fields.domain")} mono>
            {app.domain}
          </Detail>
          <Detail label={t("custom_apps:apps.fields.repository")}>
            {app.repository_url && (
              <a href={app.repository_url} target="_blank" rel="noopener noreferrer" className="break-all hover:underline">
                {app.repository_url}
              </a>
            )}
          </Detail>
          <Detail label={t("custom_apps:apps.fields.presence")}>
            {t(`custom_apps:presence.${app.presence_mode}`, {defaultValue: app.presence_mode})} ·{" "}
            {t("custom_apps:summary.every", {interval: formatDuration(app.heartbeat_interval_seconds)})}
          </Detail>
          <Detail label={t("custom_apps:apps.fields.modules")}>
            {app.modules.length > 0
              ? app.modules.map((module) => t(`custom_apps:modules.${module}`, {defaultValue: module})).join(", ")
              : t("custom_apps:summary.heartbeat_only")}
          </Detail>
          <Detail label={t("custom_apps:apps.fields.hours")}>
            {hours
              ? openDays.length === 0
                ? t("custom_apps:hours.closed_all")
                : openDays
                    .map(
                      (day) =>
                        `${t(`custom_apps:weekdays_short.${day}`)} ${(hours.days[day] ?? [])
                          .map((window) => `${window.start}–${window.end}`)
                          .join(", ")}`,
                    )
                    .join(" · ")
              : t("custom_apps:hours.none_short")}
          </Detail>
          <Detail label={t("custom_apps:summary.created")}>{formatDateTime(app.created_at, i18n.language)}</Detail>
          <Detail label={t("custom_apps:summary.updated")}>
            {formatDateTime(app.updated_at, i18n.language)}
            {app.updated_by && <span className="text-neutral-500"> · {app.updated_by}</span>}
          </Detail>
        </DetailList>
        {app.description && (
          <p className="mt-6 border-t border-neutral-800 pt-5 text-sm leading-relaxed whitespace-pre-line text-neutral-300">
            {app.description}
          </p>
        )}
      </Panel>

      <Panel title={t("custom_apps:ingest.title")} description={t("custom_apps:ingest.description")}>
        <div className="grid gap-4">
          {[
            {label: t("custom_apps:ingest.base"), value: app.ingest.base_url},
            {label: t("custom_apps:ingest.openapi"), value: app.ingest.openapi_url},
            {label: t("custom_apps:ingest.sdk"), value: app.ingest.sdk_url},
          ].map((entry) => (
            <div key={entry.label} className="flex flex-col gap-1.5">
              <span className="text-[12px] font-medium tracking-wide text-neutral-500 uppercase">{entry.label}</span>
              <CopyField value={entry.value} label={entry.label} />
            </div>
          ))}
        </div>
      </Panel>

      {isWeb && (
        <Panel
          title={t("custom_apps:sdk.title")}
          description={t("custom_apps:sdk.description")}
          action={sdk.data?.available ? <CopyButton value={scriptTag(sdk.data.url, sdk.data.integrity)} label={t("custom_apps:sdk.title")} withText /> : undefined}
        >
          <PanelState loading={sdk.loading} error={sdk.error} onRetry={sdk.reload} ns="admin">
            {sdk.data && !sdk.data.available ? (
              <Alert tone="info" title={t("custom_apps:sdk.unavailable_title")}>
                {t("custom_apps:sdk.unavailable_body")}{" "}
                <Link to={customAppsRoute.appSettings(app.id)} className="underline">
                  {t("custom_apps:sdk.unavailable_link")}
                </Link>
              </Alert>
            ) : sdk.data ? (
              <div className="flex flex-col gap-3">
                <pre className="overflow-x-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-all text-neutral-300">
                  <Code size={14} className="mr-2 inline align-[-2px] text-neutral-600" aria-hidden="true" />
                  {scriptTag(sdk.data.url, sdk.data.integrity)}
                </pre>
                <p className="text-[12px] leading-relaxed text-neutral-500">
                  {t("custom_apps:sdk.modules", {
                    modules:
                      sdk.data.modules.length > 0
                        ? sdk.data.modules.map((module) => t(`custom_apps:modules.${module}`, {defaultValue: module})).join(", ")
                        : t("custom_apps:summary.heartbeat_only"),
                  })}
                </p>
              </div>
            ) : null}
          </PanelState>
        </Panel>
      )}
    </div>
  );
};
