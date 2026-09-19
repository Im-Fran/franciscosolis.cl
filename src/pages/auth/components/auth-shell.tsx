import type {ReactNode} from "react";
import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, NavLink} from "react-router-dom";
import {GlobeSimple, SignOut} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {ACCOUNT_ROUTE, ADMIN_ROUTE} from "@/lib/auth/config.ts";
import {cn} from "@/lib/utils.ts";

const navLinkClass = ({isActive}: {isActive: boolean}) =>
  cn(
    "rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
    isActive ? "bg-accent-900/50 text-accent-200" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
  );

/** Header, navigation and page frame shared by the account and admin screens. */
export const AuthShell = ({title, children}: {title: string; children: ReactNode}) => {
  const {t} = useTranslation();
  const {language, toggleLanguage} = useLanguageToggle();
  const {me, signOut, canAdminister} = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const user = me?.user;

  return (
    <div className="flex flex-1 flex-col">
      <header className="border-b border-neutral-800">
        <div className="container mx-auto flex flex-wrap items-center gap-4 px-4 py-4">
          <Link to="/" aria-label="FranciscoSolis">
            <BrandLockup size={28} tone="auto"/>
          </Link>

          <nav className="flex items-center gap-1" aria-label={title}>
            <NavLink to={ACCOUNT_ROUTE} className={navLinkClass}>
              {t("auth:nav.account")}
            </NavLink>
            {canAdminister && (
              <NavLink to={ADMIN_ROUTE} className={navLinkClass}>
                {t("auth:nav.admin")}
              </NavLink>
            )}
          </nav>

          <div className="ml-auto flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={toggleLanguage}>
              <GlobeSimple size={16}/> {language === "es" ? "EN" : "ES"}
            </Button>

            {user && (
              <span className="hidden items-center gap-2 rounded-[var(--radius-md)] border border-neutral-800 py-1.5 pr-3 pl-1.5 sm:inline-flex">
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
              <span className="hidden sm:inline">{t("auth:nav.sign_out")}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto w-full flex-1 px-4 py-10">{children}</div>
    </div>
  );
};
