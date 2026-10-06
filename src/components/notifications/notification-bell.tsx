import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {Bell, Checks} from "@phosphor-icons/react";
import {CategoryIcon} from "@/components/notifications/category-icon.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useA11y} from "@/lib/a11y";
import {accountRoute} from "@/lib/auth/config.ts";
import {BELL_LIMIT} from "@/lib/notifications/config.ts";
import {notificationsApi} from "@/lib/notifications/client.ts";
import {formatRelative, isSitePath} from "@/lib/notifications/format.ts";
import {useNotifications} from "@/lib/notifications/notifications-context.ts";
import type {AppNotification} from "@/lib/notifications/types.ts";
import {cn} from "@/lib/utils.ts";

/** The menu surface, restated in this site's tokens: the primitive ships shadcn's, which it has none of. */
export const menuSurface = "border-neutral-800 bg-surface p-1 text-text shadow-[var(--shadow-md)]";
export const menuItem = "cursor-pointer gap-2 text-neutral-300 focus:bg-neutral-800/70 focus:text-text";

/** What the badge says. Past 99 the exact figure stops being information. */
const badgeText = (count: number) => (count > 99 ? "99+" : String(count));

/**
 * The bell in the home page's header, and the latest few notifications under it.
 *
 * The panel reads the list only when it opens — the badge is the provider's poll, and fetching eight
 * notifications a minute for a menu nobody opened would be most of this feature's traffic. While
 * it is open, a push landing bumps `revision` and the list is read again.
 *
 * Choosing a notification marks it read and follows its link; that is the per-row "mark as read",
 * because a menu item holding a second button of its own is a control inside a control, which
 * neither a keyboard nor a screen reader can make sense of. The explicit per-row toggle, deleting
 * and filtering live on the account tab this panel links to.
 */
export const NotificationBell = () => {
  const {t} = useTranslation("notifications");
  const {preferences} = useA11y();
  const language = preferences.language;
  const navigate = useNavigate();
  const {unread, revision, refresh, setUnread} = useNotifications();

  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (!open) return;
    const controller = new AbortController();
    notificationsApi
      .list({locale: language, limit: BELL_LIMIT, signal: controller.signal})
      .then((page) => {
        setItems(page.data);
        setUnread(page.unread);
        setFailed(false);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [open, language, revision, setUnread]);

  const choose = (notification: AppNotification) => {
    if (!notification.read_at) {
      const now = new Date().toISOString();
      setItems((current) => current?.map((item) => (item.id === notification.id ? {...item, read_at: now} : item)) ?? null);
      notificationsApi.markRead(notification.id, language).then(() => refresh(), () => undefined);
    }
    if (isSitePath(notification.url)) navigate(notification.url);
  };

  const markAll = () => {
    const now = new Date().toISOString();
    setItems((current) => current?.map((item) => ({...item, read_at: item.read_at ?? now})) ?? null);
    setUnread(0);
    notificationsApi.markAllRead().then(() => refresh(), () => void refresh());
  };

  const count = unread ?? 0;
  const label = count > 0 ? t("bell.label_unread", {count}) : t("bell.label");

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      {/* The badge sits beside the button rather than in it: the button clips its own overflow for
          the ripple, which would cut the badge in half. */}
      <span className="relative inline-flex">
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-9 w-9" aria-label={label} title={t("bell.label")}>
            <Bell size={18} weight={count > 0 ? "fill" : "regular"}/>
          </Button>
        </DropdownMenuTrigger>
        {count > 0 && (
          <span
            aria-hidden
            className="pointer-events-none absolute -top-1 -right-1 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-accent px-1 text-[10px] font-semibold leading-none text-bg"
          >
            {badgeText(count)}
          </span>
        )}
      </span>

      <DropdownMenuContent align="end" sideOffset={8} className={cn(menuSurface, "w-[min(24rem,calc(100vw-2rem))] p-0")}>
        <div className="flex items-center justify-between gap-3 px-4 py-3">
          <p className="text-sm font-medium text-text">{t("bell.title")}</p>
          {count > 0 && (
            <DropdownMenuItem
              className={cn(menuItem, "px-2 py-1 text-[12px] text-accent-300")}
              onSelect={(event) => {
                /* Stays open: the point is to watch the list go quiet, not to be dismissed. */
                event.preventDefault();
                markAll();
              }}
            >
              <Checks size={14}/> {t("bell.mark_all")}
            </DropdownMenuItem>
          )}
        </div>
        <DropdownMenuSeparator className="mx-0 my-0 bg-neutral-800"/>

        <div className="max-h-[min(60vh,28rem)] overflow-y-auto p-1">
          {items === null && !failed && (
            <div className="flex items-center gap-3 px-3 py-6 text-sm text-neutral-400">
              <Spinner size={16}/>
            </div>
          )}
          {failed && items === null && <p className="px-3 py-6 text-sm text-neutral-400">{t("bell.failed")}</p>}
          {items?.length === 0 && <p className="px-3 py-6 text-sm text-neutral-400">{t("bell.empty")}</p>}
          {items?.map((notification) => (
            <DropdownMenuItem
              key={notification.id}
              className={cn(menuItem, "items-start px-3 py-2.5")}
              onSelect={() => choose(notification)}
            >
              <CategoryIcon category={notification.category} size={18} className="mt-0.5 shrink-0 text-neutral-500"/>
              <span className="min-w-0 flex-1">
                <span className={cn("block text-sm", notification.read_at ? "text-neutral-300" : "font-medium text-text")}>
                  {notification.title}
                </span>
                <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-neutral-400">
                  {notification.body}
                </span>
                <time dateTime={notification.created_at} className="mt-1 block text-[11px] text-neutral-500">
                  {formatRelative(notification.created_at, language)}
                </time>
              </span>
              {!notification.read_at && (
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-accent" aria-label={t("bell.unread")}/>
              )}
            </DropdownMenuItem>
          ))}
        </div>

        <DropdownMenuSeparator className="mx-0 my-0 bg-neutral-800"/>
        <div className="p-1">
          <DropdownMenuItem asChild className={cn(menuItem, "justify-center py-2 text-[13px]")}>
            <Link to={accountRoute.notifications}>{t("bell.see_all")}</Link>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};
