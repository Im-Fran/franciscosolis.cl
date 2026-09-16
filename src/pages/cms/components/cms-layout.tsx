import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useCms} from "@/lib/cms/cms-context.ts";
import {CmsShell} from "@/pages/cms/components/cms-shell.tsx";
import {NoAccess} from "@/pages/cms/components/no-access.tsx";

/**
 * The one place the CMS answers "is this account admitted here at all".
 *
 * A live session and a role in this application are two different questions: `RequireAuth` settles
 * the first, and `/cms/admin/me` settles the second. Asking it once above the whole subtree is what
 * keeps a no-access account from meeting five panels that each fail with their own 403.
 */
export const CmsLayout = () => {
  const {t} = useTranslation();
  const {me} = useAuth();
  const {loading, forbidden, error, reload} = useCms();

  if (loading) return <AuthLoading label={t("admin:common.checking")}/>;

  if (forbidden) return <NoAccess email={me?.user.email}/>;

  /* The collections are public, so the navigation still stands even when the identity call failed. */
  if (error) {
    return (
      <CmsShell>
        <Alert tone="error" title={t("admin:common.failed")}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{t(`admin:errors.${error}`, {defaultValue: error})}</span>
            <Button variant="ghost" size="sm" onClick={reload} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.retry")}
            </Button>
          </div>
        </Alert>
      </CmsShell>
    );
  }

  /*
   * A second boundary inside the shell, rather than relying on the one around the whole subtree:
   * each section fetches its own chunk and its own translation namespace on first visit, and
   * suspending above the shell would blank the header and the navigation every time.
   */
  return (
    <CmsShell>
      <Suspense fallback={<AuthLoading label={t("admin:common.loading")}/>}>
        <Outlet/>
      </Suspense>
    </CmsShell>
  );
};
