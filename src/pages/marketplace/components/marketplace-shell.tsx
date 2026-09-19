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
import {MARKETPLACE_ADMIN_ROUTE, PRODUCT_ROUTE} from "@/lib/marketplace/config.ts";
import {cn} from "@/lib/utils.ts";
import {NAV_ITEMS} from "@/pages/marketplace/components/marketplace-nav.ts";

/**
 * Whether `to` counts as the current screen.
 *
 * A `nested` entry covers its own deeper routes, which is what makes "Products" stay lit while an
 * editor is three levels down inside one of them — on a release, or on a sale. Without it the menu
 * would go blank the moment somebody opened a product, which reads as having navigated out of the
 * console.
 */
const isActive = (to: string, nested: boolean | undefined, pathname: string) => {
  if (pathname === to) return true;
  return nested === true && pathname.startsWith(`${to}/`);
};

const Nav = ({onNavigate}: {onNavigate?: () => void}) => {
  const {t} = useTranslation("marketplace_admin");
  const location = useLocation();

  return (
    <nav className="flex flex-col gap-1" aria-label={t("shell.label")}>
      {NAV_ITEMS.map(({to, label, icon: Icon, nested}) => (
        <Link
          key={to}
          to={to}
          onClick={onNavigate}
          className={cn(
            "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors",
            isActive(to, nested, location.pathname)
              ? "bg-accent-900/50 text-accent-200"
              : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
          )}
        >
          <Icon size={16} className="shrink-0" />
          <span className="truncate">{t(label)}</span>
        </Link>
      ))}
    </nav>
  );
};

/**
 * The frame every signed-in console screen sits in.
 *
 * Same shape as the CMS's shell and the support console's — a drawer below `lg`, a column beside
 * the content above it, both rendering the same `<Nav>` so a section cannot exist on one and be
 * missing from the other.
 */
export const MarketplaceShell = ({children}: {children: ReactNode}) => {
  const {t} = useTranslation("marketplace_admin");
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
            aria-label={t("shell.label")}
            onClick={() => setDrawer((open) => !open)}
          >
            {drawer ? <X size={18} /> : <List size={18} />}
          </Button>

          <Link to={MARKETPLACE_ADMIN_ROUTE} className="flex items-center gap-2">
            <BrandLockup className="h-6 w-auto" />
            <span className="text-sm text-neutral-500">{t("app_name")}</span>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLanguage}>
              <GlobeSimple size={16} />
              <span className="uppercase">{language}</span>
            </Button>

            {/* The storefront this console edits, so "how does it actually look" is one click. */}
            <Button variant="ghost" size="sm" asChild>
              <Link to={PRODUCT_ROUTE} target="_blank" rel="noreferrer">
                <ArrowSquareOut size={16} />
                <span className="max-sm:sr-only">{t("shell.storefront")}</span>
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
              aria-label={t("shell.label")}
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
