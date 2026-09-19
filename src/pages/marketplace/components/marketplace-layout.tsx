import {Suspense} from "react";
import {Outlet} from "react-router-dom";
import {useTranslation} from "react-i18next";
import {ArrowClockwise} from "@phosphor-icons/react";
import {AuthLoading} from "@/components/auth/auth-loading.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useMarketplace} from "@/lib/marketplace/marketplace-context.ts";
import {MarketplaceShell} from "@/pages/marketplace/components/marketplace-shell.tsx";
import {NoAccess} from "@/pages/marketplace/components/no-access.tsx";

/**
 * The one place the console answers "may this account edit the marketplace at all".
 *
 * A live session and the editorial permission are two different questions: `RequireAuth` settles
 * the first and `/marketplace/admin/me` the second. Asking it once above the whole subtree is what
 * keeps an account without the permission from meeting nine panels that each fail with their own
 * 403 — and what makes the answer a sentence rather than a wall of errors.
 */
export const MarketplaceLayout = () => {
  const {t} = useTranslation(["marketplace_admin", "admin"]);
  const {me} = useAuth();
  const {loading, forbidden, error, reload} = useMarketplace();

  if (loading) return <AuthLoading label={t("admin:common.checking")} />;

  if (forbidden) return <NoAccess email={me?.user.email} />;

  if (error) {
    return (
      <MarketplaceShell>
        <Alert tone="error" title={t("admin:common.failed")}>
          <div className="flex flex-wrap items-center gap-3">
            <span>{error}</span>
            <Button variant="ghost" size="sm" onClick={reload}>
              <ArrowClockwise size={14} /> {t("admin:common.retry")}
            </Button>
          </div>
        </Alert>
      </MarketplaceShell>
    );
  }

  /*
   * A second boundary inside the shell rather than relying on the one around the whole subtree:
   * each screen fetches its own chunk on first visit, and suspending above the shell would blank
   * the header and the navigation every time somebody changed section.
   */
  return (
    <MarketplaceShell>
      <Suspense fallback={<AuthLoading label={t("admin:common.loading")} />}>
        <Outlet />
      </Suspense>
    </MarketplaceShell>
  );
};
