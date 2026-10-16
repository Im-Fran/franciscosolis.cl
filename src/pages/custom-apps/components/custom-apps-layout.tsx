import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useCustomApps} from "@/lib/custom-apps/custom-apps-context.ts";
import {CustomAppsShell} from "@/pages/custom-apps/components/custom-apps-shell.tsx";
import {NoAccess} from "@/pages/custom-apps/components/no-access.tsx";

/**
 * The one place the panel answers "may this account use it at all".
 *
 * A live session and the service's own gate are two different questions: `RequireAuth` settles the
 * first and `GET /v1/me` the second. Asking once above the whole subtree is what makes a refused
 * account meet a sentence instead of every screen failing with its own 403.
 */
export const CustomAppsLayout = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {me} = useAuth();
  const {loading, forbidden, error, reload} = useCustomApps();

  if (loading) return <AuthLoading label={t("admin:common.checking")} />;

  if (forbidden) return <NoAccess email={me?.user.email} />;

  if (error) {
    return (
      <CustomAppsShell>
        <Alert tone="error" title={t("admin:common.failed")}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{t(`admin:errors.${error}`, {defaultValue: error})}</span>
            <Button variant="ghost" size="sm" onClick={reload}>
              <ArrowClockwise size={14} /> {t("admin:common.retry")}
            </Button>
          </div>
        </Alert>
      </CustomAppsShell>
    );
  }

  /*
   * A second boundary inside the shell: each screen fetches its own chunk on first visit, and
   * suspending above the shell would blank the header and the navigation on every section change.
   */
  return (
    <CustomAppsShell>
      <Suspense fallback={<AuthLoading label={t("admin:common.loading")} />}>
        <Outlet />
      </Suspense>
    </CustomAppsShell>
  );
};
