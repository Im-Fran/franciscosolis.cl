import {useEffect, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, useLocation} from "react-router-dom";
import {ArrowSquareOut, GlobeSimple, List, SignOut, X} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {ToastViewport} from "@/components/admin/toast-viewport.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {SUPPORT_ROUTE} from "@/lib/support/config.ts";
import {useSupport} from "@/lib/support/support-context.ts";
import {cn} from "@/lib/utils.ts";
import {buildNav} from "@/pages/support/components/support-nav.ts";

/**
 * Whether `to` counts as the current screen.
 *
 * `NavLink`'s own `isActive` matches on pathname alone and ignores the query string, which is a
 * problem exactly once here: the inbox and its unassigned filter are the same route
 * (`supportRoute.inbox`) distinguished only by `?unassigned=true`, so both items lit up together
 * regardless of which was actually selected. Matching search too — exactly, since a nested item's
 * `to` never carries one — fixes that without changing how every other, query-less item matches.
 */
const isNavItemActive = (to: string, nested: boolean | undefined, location: {pathname: string; search: string}) => {
  const url = new URL(to, "https://support.internal");
  if (nested) return location.pathname === url.pathname || location.pathname.startsWith(`${url.pathname}/`);
  return location.pathname === url.pathname && location.search === url.search;
};

const Nav = ({onNavigate}: {onNavigate?: () => void}) => {
  const {t} = useTranslation("support_agent");
  const {canAdminister} = useSupport();
  const location = useLocation();
  const sections = buildNav(canAdminister);

  return (
    <nav className="flex flex-col gap-6" aria-label={t("nav.label")}>
      {sections.map((section, index) => {
        if (section.items.length === 0) return null;
        return (
          <div key={section.title ?? index} className="flex flex-col gap-1">
            {section.title ? (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">
                {t(section.title)}
              </p>
            ) : null}
            {section.items.map(({to, label, icon: Icon, nested}) => (
              <Link
                key={to}
                to={to}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors",
                  isNavItemActive(to, nested, location)
                    ? "bg-accent-900/50 text-accent-200"
                    : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
                )}
                data-fs-hover
              >
                <Icon size={16} className="shrink-0" />
                <span className="truncate">{t(label)}</span>
              </Link>
            ))}
          </div>
        );
      })}
    </nav>
  );
};

/**
 * The frame every signed-in console screen sits in.
 *
 * Same shape as the CMS's shell — a drawer below `lg`, a column beside the content above it, both
 * rendering the same `<Nav>` so a section cannot exist on one and be missing from the other.
 */
export const SupportShell = ({children}: {children: ReactNode}) => {
  const {t} = useTranslation("support_agent");
  const {language, toggleLanguage} = useLanguageToggle();
  const {me, signOut} = useAuth();
  const [signingOut, setSigningOut] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const location = useLocation();

  /* A route change closes the drawer; leaving it open over the new screen reads as a stuck menu. */
  useEffect(() => setDrawer(false), [location.pathname]);

  const user = me?.user;

  return (
    <div className="flex flex-1 flex-col">
      <header className="sticky top-0 z-30 border-b border-neutral-800 bg-bg/90 backdrop-blur-sm">
        <div className="mx-auto flex w-full max-w-[1600px] flex-wrap items-center gap-3 px-4 py-3">
          <Button
            variant="ghost"
            size="sm"
            className="lg:hidden"
            aria-expanded={drawer}
            aria-label={t("nav.label")}
            onClick={() => setDrawer((open) => !open)}
            data-fs-hover
          >
            {drawer ? <X size={18} /> : <List size={18} />}
          </Button>

          <Link to={SUPPORT_ROUTE} className="flex items-center gap-2" data-fs-hover>
            <BrandLockup className="h-6 w-auto" />
            <span className="text-sm text-neutral-500">{t("app_name")}</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLanguage} data-fs-hover>
              <GlobeSimple size={16} />
              <span className="uppercase">{language}</span>
            </Button>

            <Button variant="ghost" size="sm" asChild data-fs-hover>
              <Link to="/help" target="_blank" rel="noreferrer">
                <ArrowSquareOut size={16} />
                <span className="max-sm:sr-only">{t("nav.knowledge")}</span>
              </Link>
            </Button>

            {user ? <Avatar name={user.name} email={user.email} picture={user.picture} size={28} /> : null}

            <Button
              variant="ghost"
              size="sm"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().finally(() => setSigningOut(false));
              }}
              data-fs-hover
            >
              {signingOut ? <Spinner size={16} /> : <SignOut size={16} />}
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-8 px-4 py-6">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-20">
            <Nav />
          </div>
        </aside>

        {drawer ? (
          <div className="fixed inset-0 z-40 lg:hidden">
            <button
              type="button"
              className="absolute inset-0 bg-black/60"
              aria-label={t("nav.label")}
              onClick={() => setDrawer(false)}
            />
            <div className="absolute inset-y-0 left-0 w-64 overflow-y-auto border-r border-neutral-800 bg-bg p-4">
              <Nav onNavigate={() => setDrawer(false)} />
            </div>
          </div>
        ) : null}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      <ToastViewport />
    </div>
  );
};
