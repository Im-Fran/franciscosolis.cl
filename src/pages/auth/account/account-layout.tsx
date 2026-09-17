import {Suspense} from "react";
import {useTranslation} from "react-i18next";
import {Outlet, useLocation} from "react-router-dom";
import {ArrowClockwise} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {ToastViewport} from "@/components/admin/toast-viewport.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {ToastProvider} from "@/lib/admin/toast-provider.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {AuthShell} from "@/pages/auth/components/auth-shell.tsx";
import {accountSections, sectionFromPath} from "@/pages/auth/account/account-nav.ts";

/**
 * What the account holds: profile, granted access, linked providers and live sessions.
 *
 * This is not the console and does not pretend to be one — it has no sidebar, because it is one
 * account — but everything on it is the console's furniture: the same page header, the same panels,
 * the same confirmation before a destructive write and the same place a saved change is announced.
 *
 * The sections used to sit stacked in two columns, which made the screen a long scroll where the
 * sessions list pushed the rest out of sight. They are tabs now, beside the content rather than
 * above it, and — like the console's — each one is a route, so a section can be reloaded into and
 * linked to. This is the layout they share: the header, the tab column and the toast host, which
 * sits outside the section so a write announced during a reload is not unmounted with it.
 */
const AccountLayout = () => {
  const {t} = useTranslation();
  const {me, error, reload} = useAuth();
  const {pathname} = useLocation();

  const heading = <PageHeader title={t("auth:account.title")} description={t("auth:account.subtitle")}/>;

  /*
   * The session outlived a profile load that failed: the provider keeps a session whose fault says
   * nothing about the tokens, which leaves this screen with nothing to render. Rendering nothing is
   * what it used to do — a page with only the footer on it, no message, and no way to reach the
   * shell's sign-out. The shell stays; what is missing is said, with a way to ask again.
   */
  if (!me) {
    return (
      <AuthShell title={t("auth:account.title")}>
        {heading}
        <Alert tone="error" title={t("auth:common.failed")} className="mb-5">
          {t(`auth:errors.${error ?? "unexpected"}`, {defaultValue: t("auth:errors.unexpected")})}
        </Alert>
        <Button variant="secondary" onClick={() => void reload()} data-fs-hover>
          <ArrowClockwise size={16}/> {t("auth:common.retry")}
        </Button>
      </AuthShell>
    );
  }

  const section = sectionFromPath(pathname);
  const sections = accountSections(me.user.email);

  return (
    <AuthShell title={t("auth:account.title")}>
      {heading}

      {error === "network" && (
        <Alert tone="error" className="mb-6">{t("auth:errors.network")}</Alert>
      )}

      {/* The route is the selection, so the tabs are read-only: opening one is following its link. */}
      <Tabs value={section}>
        <TabsList aria-label={t("auth:account.tabs.label")}>
          {sections.map(({value, to, label, icon: SectionIcon}) => (
            <TabsTrigger key={value} value={value} to={to} icon={<SectionIcon size={16}/>}>
              {t(label)}
            </TabsTrigger>
          ))}
        </TabsList>

        {/*
          * One panel, holding whichever section the route resolved to. A panel per tab would mean
          * five routed outlets, of which four render nothing.
          */}
        <TabsContent value={section}>
          <Suspense
            fallback={
              <div className="flex items-center gap-3 py-6 text-sm text-neutral-400">
                <Spinner size={18} label={t("auth:common.loading")}/>
                {t("auth:common.loading")}
              </div>
            }
          >
            <Outlet/>
          </Suspense>
        </TabsContent>
      </Tabs>
    </AuthShell>
  );
};

/** The toast host sits outside the sections, so a write announced during a reload is not unmounted. */
export const Account = () => (
  <ToastProvider>
    <AccountLayout/>
    <ToastViewport/>
  </ToastProvider>
);
