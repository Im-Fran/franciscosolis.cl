import {Suspense, useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, Outlet, useParams} from "react-router-dom";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import type {App} from "@/lib/custom-apps/types.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {AppContext} from "@/pages/custom-apps/components/app-context.ts";
import {AppNav} from "@/pages/custom-apps/components/app-nav.tsx";
import {StateBadge} from "@/pages/custom-apps/components/badges.tsx";

/**
 * One app, above its five tabs: loads the record once, draws the header and the tab bar, and hands
 * the app to whichever tab is open.
 *
 * A write that answers with the updated app (the kill switch, a settings save) puts it straight
 * into the context, so the state badge in this header changes with the tab that changed it rather
 * than one round trip later.
 */
export const AppLayout = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {appId = ""} = useParams<{appId: string}>();
  const record = useResource(useCallback((signal: AbortSignal) => customAppsApi.apps.get(appId, signal), [appId]));
  const [app, setApp] = useState<App | null>(null);

  useEffect(() => {
    if (record.data) setApp(record.data);
  }, [record.data]);

  /* A different app in the same layout must not show the previous one's header for a moment. */
  const current = app && app.id === appId ? app : null;

  const value = useMemo(
    () => (current ? {app: current, reload: record.reload, replace: setApp} : null),
    [current, record.reload],
  );

  if (!value) {
    return (
      <>
        <PageHeader
          title={t("custom_apps:apps.loading_title")}
          back={{to: customAppsRoute.apps, label: t("custom_apps:apps.back")}}
        />
        <Panel title={t("custom_apps:app_nav.summary")}>
          <PanelState
            loading={record.loading}
            error={record.error}
            forbidden={record.status === 403}
            onRetry={record.reload}
            ns="admin"
          >
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const company = value.app.company;

  return (
    <AppContext value={value}>
      <PageHeader
        title={value.app.name}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <StateBadge state={value.app.state} />
            <span>{t(`custom_apps:kinds.${value.app.kind}`, {defaultValue: value.app.kind})}</span>
            {company && (
              <>
                <span className="text-neutral-700" aria-hidden="true">·</span>
                <Link to={customAppsRoute.company(company.id)} className="hover:text-text hover:underline">
                  {company.trade_name || company.legal_name}
                </Link>
              </>
            )}
          </span>
        }
        back={{to: customAppsRoute.apps, label: t("custom_apps:apps.back")}}
      />
      <AppNav id={value.app.id} needsReview={value.app.needs_review_count} />
      <Suspense fallback={<AuthLoading label={t("admin:common.loading")} />}>
        <Outlet />
      </Suspense>
    </AppContext>
  );
};
