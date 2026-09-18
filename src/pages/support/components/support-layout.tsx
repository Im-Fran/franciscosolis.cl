import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useSupport} from "@/lib/support/support-context.ts";
import {NoAccess} from "@/pages/support/components/no-access.tsx";
import {SupportShell} from "@/pages/support/components/support-shell.tsx";

/**
 * The one place the console answers "is this account an agent at all".
 *
 * A live session and a support role are two different questions: `RequireAuth` settles the first and
 * `/support/admin/me` the second. Asking it once above the whole subtree is what keeps an account
 * with no role from meeting six panels that each fail with their own 403.
 */
export const SupportLayout = () => {
  const {t} = useTranslation(["support_agent", "admin"]);
  const {me} = useAuth();
  const {loading, forbidden, error, reload} = useSupport();

  if (loading) return <AuthLoading label={t("admin:common.checking")} />;

  if (forbidden) return <NoAccess email={me?.user.email} />;

  if (error) {
    return (
      <SupportShell>
        <Alert tone="error" title={t("admin:common.failed")}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={reload} data-fs-hover>
              <ArrowClockwise size={14} /> {t("admin:common.retry")}
            </Button>
          </div>
        </Alert>
      </SupportShell>
    );
  }

  /*
   * A second boundary inside the shell rather than relying on the one around the whole subtree:
   * each screen fetches its own chunk on first visit, and suspending above the shell would blank
   * the header and the navigation every time somebody changed section.
   */
  return (
    <SupportShell>
      <Suspense fallback={<AuthLoading label={t("admin:common.loading")} />}>
        <Outlet />
      </Suspense>
    </SupportShell>
  );
};
