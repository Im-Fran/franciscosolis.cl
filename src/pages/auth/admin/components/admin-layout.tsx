import {Suspense} from "react";
import {Outlet, useSearchParams} from "react-router-dom";
import {Navigate} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {ToastProvider} from "@/lib/admin/toast-provider.tsx";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {AdminProvider} from "@/lib/auth/admin-provider.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {legacyAdminTab} from "@/lib/auth/config.ts";
import {AdminShell} from "@/pages/auth/admin/components/admin-shell.tsx";
import {NoAccess} from "@/pages/auth/admin/components/no-access.tsx";

/** The console's gate, inside the provider so it can read the one `/admin/me` answer. */
const Gate = () => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const {me} = useAuth();
  const {loading, forbidden, error, reload} = useAdmin();
  const [params] = useSearchParams();

  /*
   * The console used to be one screen with its sections in `?tab=`. Those URLs were shared, and
   * this repo's own docs still quote "Admin → Applications", so they are forwarded to the real
   * route rather than silently landing on the overview.
   */
  const legacy = legacyAdminTab(params.get("tab"));
  if (legacy) return <Navigate to={legacy} replace/>;

  if (loading) return <AuthLoading label={t("auth_admin:common.checking")}/>;

  if (forbidden) return <NoAccess email={me?.user.email}/>;

  /* Nothing in the console is readable without this answer, so a failure replaces it entirely. */
  if (error) {
    return (
      <div className="container mx-auto w-full flex-1 px-4 py-10">
        <Alert tone="error" title={t("admin:common.failed")}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{t(`admin:errors.${error}`, {defaultValue: error})}</span>
            <Button variant="ghost" size="sm" onClick={reload} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.retry")}
            </Button>
          </div>
        </Alert>
      </div>
    );
  }

  return (
    <AdminShell>
      {/*
        * A second boundary inside the shell, rather than relying on the one around the whole
        * subtree: each section fetches its own chunk on first visit, and suspending above the shell
        * would blank the header and the navigation every time.
        */}
      <Suspense fallback={<AuthLoading label={t("admin:common.loading")}/>}>
        <Outlet/>
      </Suspense>
    </AdminShell>
  );
};

/**
 * Everything under `/auth/admin`.
 *
 * Two questions are asked before a screen renders, and both are answered by the API: `RequireAuth`
 * above this route settles "is there a live session", and `AdminProvider` settles "does this
 * account belong in the console" with a single `/admin/me`. A per-endpoint 403 is a different
 * thing and still possible — an account that may read users but not the audit trail — and those
 * are handled where they happen.
 */
export const AdminLayout = () => (
  <AdminProvider>
    <ToastProvider>
      <Gate/>
    </ToastProvider>
  </AdminProvider>
);
