import {useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {SignIn, UserCircle} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {BrandLockup} from "@/components/brand";
import {NotificationBell} from "@/components/notifications/notification-bell.tsx";
import {UserMenu} from "@/components/notifications/user-menu.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {AUTH_ROUTE} from "@/lib/auth/config.ts";

const links: Array<{ href: string; labelKey: string }> = [
  {href: "#home", labelKey: "nav:home"},
  {href: "#stack", labelKey: "nav:stack"},
  {href: "#projects", labelKey: "nav:projects"},
  {href: "#experience", labelKey: "nav:experience"},
  {href: "#contact", labelKey: "nav:contact"},
];

/**
 * The account corner of the header.
 *
 * The home page is public and stays that way: this reads the site's session from the `AuthProvider`
 * mounted over the whole application and never asks for one. Anonymous visitors get a button that
 * starts the same hand-off `/auth` does, returning here; a signed-in one gets the bell and their
 * own menu. While a stored session is being restored neither is true yet, so the slot holds its
 * shape instead of flashing the sign-in button at somebody who is signed in.
 */
const AccountCorner = () => {
  const {t} = useTranslation("notifications");
  const {status, me, client} = useAuth();
  const navigate = useNavigate();
  const [starting, setStarting] = useState(false);

  if (status === "loading") {
    return <span aria-hidden className="inline-flex h-9 w-9 items-center justify-center opacity-40"><UserCircle size={20}/></span>;
  }

  if (status === "anonymous") {
    return (
      <Button
        variant="secondary"
        size="sm"
        disabled={starting}
        onClick={() => {
          setStarting(true);
          /* A hand-off that never left the browser falls back to /auth, which explains and retries. */
          client.flow.startAuthorization("/").catch(() => {
            setStarting(false);
            navigate(`${AUTH_ROUTE}?return_to=${encodeURIComponent("/")}`);
          });
        }}
      >
        {starting ? <Spinner size={14}/> : <SignIn size={16}/>}
        {t("menu.sign_in")}
      </Button>
    );
  }

  return (
    <>
      <NotificationBell/>
      {/* The profile could not be read (a network fault kept the session): the bell still works,
          and there is no name or picture to draw the menu with. */}
      {me ? <UserMenu/> : null}
    </>
  );
};

export const Nav = () => {
  const {t} = useTranslation();
  const {language, toggleLanguage} = useLanguageToggle();

  return (
    <header className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-800 bg-bg/78 backdrop-blur-[14px]">
      <nav className="container mx-auto flex items-center justify-between gap-3 px-4 py-4">
        {/* The header's own px-4/py-4 already exceeds the brand's clear space at this mark size. */}
        <a href="#home" className="inline-flex shrink-0 items-center">
          <BrandLockup size={26} tone="auto"/>
        </a>
        <div className="flex items-center gap-2 sm:gap-6">
          {/* From `lg` rather than `sm`: with the account corner beside them, five links no longer
              fit on one line at tablet widths, and the sections are one scroll away regardless. */}
          {links.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="hidden text-sm text-neutral-300 hover:text-text transition-colors lg:inline"
            >
              {t(link.labelKey)}
            </a>
          ))}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleLanguage}
              aria-label={t("common:toggle_lang", {lang: language === "es" ? "EN" : "ES"})}
            >
              {language === "es" ? "EN" : "ES"}
            </Button>
            <AccountCorner/>
          </div>
        </div>
      </nav>
    </header>
  );
};
