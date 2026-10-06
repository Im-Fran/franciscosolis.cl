import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Bell, SignOut, UserCircle} from "@phosphor-icons/react";
import {menuItem, menuSurface} from "@/components/notifications/notification-bell.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {accountRoute} from "@/lib/auth/config.ts";
import {cn} from "@/lib/utils.ts";

/**
 * The signed-in half of a header: who you are, and the three places that follow from it.
 *
 * The name hides below `sm` and the avatar stays, which is what keeps the header on one line at
 * phone widths. Signing out goes through the provider like everywhere else on the site, so the
 * notifications provider sees the session end and drops this browser's push subscription with it.
 */
export const UserMenu = () => {
  const {t} = useTranslation("notifications");
  const {me, signOut} = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  const user = me?.user;
  if (!user) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("menu.label")}
        className="inline-flex max-w-[220px] cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-neutral-800 p-1 transition-colors hover:border-neutral-700 focus-visible:border-accent focus-visible:outline-none sm:pr-3"
      >
        <Avatar name={user.name} email={user.email} picture={user.picture} size={26}/>
        <span className="hidden truncate text-[13px] text-neutral-300 sm:inline">{user.name || user.email}</span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" sideOffset={8} className={cn(menuSurface, "w-60")}>
        <DropdownMenuLabel className="px-2 py-2 font-normal">
          <span className="block truncate text-sm text-text">{user.name || user.email}</span>
          {user.name && <span className="block truncate text-[12px] text-neutral-500">{user.email}</span>}
        </DropdownMenuLabel>
        <DropdownMenuSeparator className="bg-neutral-800"/>
        <DropdownMenuItem asChild className={menuItem}>
          <Link to={accountRoute.profile}>
            <UserCircle size={16}/> {t("menu.account")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild className={menuItem}>
          <Link to={accountRoute.notifications}>
            <Bell size={16}/> {t("menu.notifications")}
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator className="bg-neutral-800"/>
        <DropdownMenuItem
          className={menuItem}
          disabled={signingOut}
          onSelect={() => {
            setSigningOut(true);
            void signOut().finally(() => setSigningOut(false));
          }}
        >
          <SignOut size={16}/> {t("menu.sign_out")}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
