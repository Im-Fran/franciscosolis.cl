import {useEffect, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, NavLink, useLocation} from "react-router-dom";
import {ArrowSquareOut, GlobeSimple, List, SignOut, X} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useCms} from "@/lib/cms/cms-context.ts";
import {CMS_ROUTE} from "@/lib/cms/config.ts";
import {cn} from "@/lib/utils.ts";
import {buildNav} from "@/pages/cms/components/cms-nav.ts";
import {ToastViewport} from "@/components/admin/toast-viewport.tsx";

const Nav = ({onNavigate}: {onNavigate?: () => void}) => {
  const {t} = useTranslation();
  const {collections} = useCms();
  const sections = buildNav(collections);

  return (
    <nav className="flex flex-col gap-6" aria-label={t("cms:nav.label")}>
      {sections.map((section, index) => {
        if (section.items.length === 0) return null;
        return (
          <div key={section.title ?? index} className="flex flex-col gap-1">
            {section.title && (
              <p className="px-3 pb-1 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">
                {t(`cms:${section.title}`)}
              </p>
            )}
            {section.items.map(({to, label, literal, icon: Icon, nested}) => (
              <NavLink
                key={to}
                to={to}
                end={!nested}
                onClick={onNavigate}
                className={({isActive}) =>
                  cn(
                    "flex items-center gap-2.5 rounded-[var(--radius-md)] px-3 py-2 text-[13px] transition-colors",
                    isActive
                      ? "bg-accent-900/50 text-accent-200"
                      : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
                  )
                }
              >
                <Icon size={16} className="shrink-0"/>
                <span className="truncate">{literal ? label : t(`cms:${label}`)}</span>
              </NavLink>
            ))}
          </div>
        );
      })}
    </nav>
  );
};

/**
 * The frame every signed-in CMS screen sits in: the header, the section navigation and the one
 * place transient confirmations are announced from.
 *
 * The navigation is a drawer below `lg` and a column beside the content above it. Both render the
 * same `<Nav>`, so a section can never exist on one and be missing from the other.
 */
export const CmsShell = ({children}: {children: ReactNode}) => {
  const {t} = useTranslation();
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
            aria-label={t("cms:nav.menu")}
            onClick={() => setDrawer((open) => !open)}
          >
            {drawer ? <X size={18}/> : <List size={18}/>}
          </Button>

          <Link to={CMS_ROUTE} className="flex items-center gap-2.5">
            <BrandLockup size={26} tone="auto"/>
            <Badge variant="accent" size="sm">{t("cms:app_name")}</Badge>
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/">
                <ArrowSquareOut size={16}/>
                <span className="hidden sm:inline">{t("cms:nav.site_link")}</span>
              </Link>
            </Button>

            <Button variant="ghost" size="sm" onClick={toggleLanguage}>
              <GlobeSimple size={16}/> {language === "es" ? "EN" : "ES"}
            </Button>

            {user && (
              <span className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-neutral-800 py-1.5 pr-3 pl-1.5 md:inline-flex">
                <Avatar name={user.name} email={user.email} picture={user.picture} size={26}/>
                <span className="max-w-[180px] truncate text-[13px] text-neutral-300">{user.email}</span>
              </span>
            )}

            <Button
              variant="secondary"
              size="sm"
              disabled={signingOut}
              onClick={() => {
                setSigningOut(true);
                void signOut().finally(() => setSigningOut(false));
              }}
            >
              {signingOut ? <Spinner size={14}/> : <SignOut size={16}/>}
              <span className="hidden sm:inline">{t("cms:nav.sign_out")}</span>
            </Button>
          </div>
        </div>

        {drawer && (
          <div className="border-t border-neutral-800 px-4 py-4 lg:hidden">
            <Nav onNavigate={() => setDrawer(false)}/>
          </div>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[1600px] flex-1 gap-8 px-4 py-8">
        <aside className="hidden w-56 shrink-0 lg:block">
          <div className="sticky top-24">
            <Nav/>
          </div>
        </aside>

        {/* A plain div, not a <main>: the site's root layout already owns the document's main. */}
        <div className="min-w-0 flex-1">{children}</div>
      </div>

      <ToastViewport/>
    </div>
  );
};
