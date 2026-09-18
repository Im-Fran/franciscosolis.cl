import {useTranslation} from "react-i18next";
import {Link, NavLink} from "react-router-dom";
import {LifebuoyIcon, SignIn, Ticket, UserCircle} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {Avatar} from "@/components/ui/avatar.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {ACCOUNT_ROUTE} from "@/lib/auth/config.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {cn} from "@/lib/utils.ts";

const linkClass = ({isActive}: {isActive: boolean}) =>
  cn(
    "inline-flex items-center gap-1.5 rounded-[var(--radius-md)] px-2.5 py-1.5 text-[13px] transition-colors",
    isActive ? "bg-accent-900/50 text-accent-200" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
  );

/**
 * The help centre's own header.
 *
 * Every section of this site that is a *place* rather than a page says which place it is: the
 * account and the console put the lockup beside the service's name, and the help centre was the one
 * that did not — a visitor arriving from a support email landed on an unlabelled page with the
 * site's footer under it and no way back to anything of their own.
 *
 * What sits on the right is the other half of that: the two things somebody reading the help centre
 * actually wants, which are their own tickets and their account. Both are behind the site's session,
 * and neither is a gate on this section — the help centre stays public, because somebody who cannot
 * sign in is exactly the person most likely to need it. So the links are offered when there is a
 * session and replaced by one sign-in link when there is not; that link points at the tickets page,
 * whose own gate carries the visitor through the hand-off and back to it.
 */
export const HelpHeader = () => {
  const {t} = useTranslation("support");
  const {status, me} = useAuth();

  const user = me?.user;

  return (
    <header className="border-b border-neutral-800 bg-bg/90 backdrop-blur-sm">
      <div className="container mx-auto flex flex-wrap items-center gap-3 px-4 py-3">
        <Link to={helpRoute.home} className="flex items-center gap-2" aria-label={t("help.app_label")} data-fs-hover>
          <BrandLockup size={26} tone="auto"/>
          <span className="flex items-center gap-1.5 text-sm text-neutral-500">
            <LifebuoyIcon size={15} aria-hidden/>
            {t("help.app_name")}
          </span>
        </Link>

        <nav className="ml-auto flex items-center gap-1" aria-label={t("help.nav_label")}>
          {status === "authenticated" && user ? (
            <>
              <NavLink to={helpRoute.myTickets} className={linkClass} data-fs-hover>
                <Ticket size={15} aria-hidden/>
                <span className="max-sm:sr-only">{t("help.nav_tickets")}</span>
              </NavLink>

              <NavLink to={ACCOUNT_ROUTE} end className={linkClass} data-fs-hover>
                <Avatar name={user.name} email={user.email} picture={user.picture} size={22}/>
                <span className="max-w-[160px] truncate max-sm:sr-only">{t("help.nav_account")}</span>
              </NavLink>
            </>
          ) : null}

          {status === "anonymous" ? (
            <NavLink to={helpRoute.myTickets} className={linkClass} data-fs-hover>
              <SignIn size={15} aria-hidden/>
              {t("help.nav_sign_in")}
            </NavLink>
          ) : null}

          {/* While a stored session is being restored, neither state is true yet. Drawing the
              signed-out link and swapping it for the avatar a moment later reads as a flicker, so
              the slot holds its shape and says nothing. */}
          {status === "loading" ? (
            <span className={cn(linkClass({isActive: false}), "opacity-40")} aria-hidden>
              <UserCircle size={15}/>
            </span>
          ) : null}
        </nav>
      </div>
    </header>
  );
};
