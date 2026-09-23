import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowClockwise, Checks, Envelope, EnvelopeOpen, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {CategoryIcon} from "@/components/notifications/category-icon.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useA11y} from "@/lib/a11y";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {describeError} from "@/lib/auth/useResource.ts";
import {NOTIFICATION_CATEGORIES, PAGE_SIZE} from "@/lib/notifications/config.ts";
import {notificationsApi} from "@/lib/notifications/client.ts";
import {formatRelative, isSitePath} from "@/lib/notifications/format.ts";
import {useNotifications} from "@/lib/notifications/notifications-context.ts";
import type {AppNotification, NotificationCategory, NotificationFilter} from "@/lib/notifications/types.ts";
import {Panel, PanelState} from "@/pages/auth/components/panel.tsx";
import {cn} from "@/lib/utils.ts";

const filterClass = (active: boolean) =>
  cn(
    "rounded-[var(--radius-md)] px-3 py-1.5 text-[13px] transition-colors",
    active ? "bg-accent-900/50 text-accent-200" : "text-neutral-400 hover:bg-neutral-800/50 hover:text-text",
  );

const isCategory = (value: string | null): value is NotificationCategory =>
  (NOTIFICATION_CATEGORIES as readonly string[]).includes(value ?? "");

/**
 * Every notification the account has, newest first, paged by the service's cursor.
 *
 * The filters live in the query string, the way the console's do, so "my unread support
 * notifications" is an address somebody can come back to. Paging is a "load more" rather than
 * numbered pages because the service pages by cursor and knows no totals — a page number would be
 * a promise this screen could not keep.
 *
 * Every write answers with the row as the service now holds it, and that is what replaces the row
 * on screen. The unread badge is then asked again rather than adjusted here, since the service is
 * the only one that knows whether another tab marked something in between.
 */
export const NotificationsList = () => {
  const {t} = useTranslation(["notifications", "auth"]);
  const {preferences} = useA11y();
  const language = preferences.language;
  const {notify} = useToast();
  const {revision, refresh, setUnread} = useNotifications();

  const [params, setParams] = useSearchParams();
  const filter: NotificationFilter = params.get("filter") === "unread" ? "unread" : "all";
  const rawCategory = params.get("category");
  const category = isCategory(rawCategory) ? rawCategory : "";

  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);
  const [deleting, setDeleting] = useState<AppNotification | null>(null);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    notificationsApi
      .list({locale: language, limit: PAGE_SIZE, filter, category, signal: controller.signal})
      .then((page) => {
        setItems(page.data);
        setCursor(page.next_cursor);
        setUnread(page.unread);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setError(describeError(cause).message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [language, filter, category, revision, nonce, setUnread]);

  const loadMore = async () => {
    if (!cursor) return;
    setLoadingMore(true);
    try {
      const page = await notificationsApi.list({locale: language, limit: PAGE_SIZE, filter, category, cursor});
      /* A row can arrive twice if something new landed between pages; the first copy wins. */
      setItems((current) => {
        const seen = new Set((current ?? []).map((item) => item.id));
        return [...(current ?? []), ...page.data.filter((item) => !seen.has(item.id))];
      });
      setCursor(page.next_cursor);
      setUnread(page.unread);
    } catch (cause) {
      const message = describeError(cause).message;
      notify(t(`auth:errors.${message}`, {defaultValue: message}), "error");
    } finally {
      setLoadingMore(false);
    }
  };

  const setParam = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    setParams(next, {replace: true});
  };

  const replace = (updated: AppNotification) =>
    setItems((current) => current?.map((item) => (item.id === updated.id ? updated : item)) ?? null);

  const toggleRead = useMutation(
    useCallback(
      (notification: AppNotification) =>
        notification.read_at
          ? notificationsApi.markUnread(notification.id, language)
          : notificationsApi.markRead(notification.id, language),
      [language],
    ),
  );
  const markAll = useMutation(useCallback((scope?: NotificationCategory) => notificationsApi.markAllRead(scope), []));
  const remove = useMutation(useCallback((id: string) => notificationsApi.remove(id), []));

  const onToggle = async (notification: AppNotification) => {
    const result = await toggleRead.run(notification);
    if (!result.ok) {
      notify(t(`auth:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    replace(result.data);
    void refresh();
  };

  const onMarkAll = async () => {
    const result = await markAll.run(category || undefined);
    if (!result.ok) {
      notify(t(`auth:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    notify(t("notifications:list.marked_all", {count: result.data.updated}));
    void refresh();
    reload();
  };

  const onDelete = async () => {
    if (!deleting) return;
    const result = await remove.run(deleting.id);
    if (!result.ok) return;
    setItems((current) => current?.filter((item) => item.id !== deleting.id) ?? null);
    setDeleting(null);
    notify(t("notifications:list.deleted"));
    void refresh();
  };

  const hasUnread = (items ?? []).some((item) => !item.read_at);

  return (
    <Panel
      title={t("notifications:list.title")}
      description={t("notifications:list.description")}
      action={
        <span className="flex flex-wrap gap-1">
          <Button variant="ghost" size="sm" onClick={reload}>
            <ArrowClockwise size={14}/> {t("auth:common.refresh")}
          </Button>
          {(hasUnread || filter === "unread") && (
            <Button variant="ghost" size="sm" onClick={() => void onMarkAll()} disabled={markAll.pending}>
              {markAll.pending ? <Spinner size={14}/> : <Checks size={14}/>} {t("notifications:list.mark_all")}
            </Button>
          )}
        </span>
      }
    >
      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
        <div role="group" aria-label={t("notifications:list.filter_label")} className="flex gap-1">
          {(["all", "unread"] as const).map((value) => (
            <button
              key={value}
              type="button"
              aria-pressed={filter === value}
              className={filterClass(filter === value)}
              onClick={() => setParam("filter", value === "all" ? "" : value)}
            >
              {t(`notifications:list.filter_${value}`)}
            </button>
          ))}
        </div>

        <label className="flex flex-col gap-1 text-[13px] text-neutral-400">
          {t("notifications:list.category_label")}
          <select
            value={category}
            onChange={(changed) => setParam("category", changed.target.value)}
            className="h-9 min-w-48 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
          >
            <option value="">{t("notifications:list.category_all")}</option>
            {NOTIFICATION_CATEGORIES.map((value) => (
              <option key={value} value={value}>
                {t(`notifications:categories.${value}`)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <PanelState
        loading={loading && items === null}
        error={items === null ? error : null}
        empty={(items ?? []).length === 0}
        emptyLabel={filter === "unread" ? t("notifications:list.empty_unread") : t("notifications:list.empty")}
        onRetry={reload}
      >
        <ul className={cn("flex flex-col divide-y divide-neutral-800", loading && "opacity-60")}>
          {(items ?? []).map((notification) => (
            <li key={notification.id} className="flex flex-wrap items-start gap-x-4 gap-y-2 py-4 first:pt-0 last:pb-0">
              <CategoryIcon category={notification.category} size={20} className="mt-0.5 shrink-0 text-neutral-500"/>

              <div className="min-w-0 flex-1 basis-60">
                <p className="flex flex-wrap items-center gap-2 text-sm">
                  {!notification.read_at && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-accent" aria-label={t("notifications:bell.unread")}/>
                  )}
                  {isSitePath(notification.url) ? (
                    <Link
                      to={notification.url}
                      className={cn(
                        "underline-offset-2 hover:underline",
                        notification.read_at ? "text-neutral-300" : "font-medium text-text",
                      )}
                    >
                      {notification.title}
                    </Link>
                  ) : (
                    <span className={notification.read_at ? "text-neutral-300" : "font-medium text-text"}>
                      {notification.title}
                    </span>
                  )}
                  <Badge variant="neutral" size="sm">
                    {t(`notifications:categories.${notification.category}`, {defaultValue: notification.category})}
                  </Badge>
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-neutral-400">{notification.body}</p>
                <time
                  dateTime={notification.created_at}
                  title={formatDateTime(notification.created_at, language) ?? undefined}
                  className="mt-1 block text-xs text-neutral-600"
                >
                  {formatRelative(notification.created_at, language)}
                </time>
              </div>

              <span className="flex shrink-0 gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => void onToggle(notification)}
                  disabled={toggleRead.pending}
                  aria-label={notification.read_at ? t("notifications:list.mark_unread") : t("notifications:list.mark_read")}
                  title={notification.read_at ? t("notifications:list.mark_unread") : t("notifications:list.mark_read")}
                >
                  {notification.read_at ? <Envelope size={14}/> : <EnvelopeOpen size={14}/>}
                  <span className="max-sm:sr-only">
                    {notification.read_at ? t("notifications:list.mark_unread") : t("notifications:list.mark_read")}
                  </span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setDeleting(notification)}
                  aria-label={t("notifications:list.delete")}
                  title={t("notifications:list.delete")}
                >
                  <Trash size={14}/>
                </Button>
              </span>
            </li>
          ))}
        </ul>

        {cursor && (
          <div className="mt-5 flex justify-center">
            <Button variant="secondary" size="sm" onClick={() => void loadMore()} disabled={loadingMore}>
              {loadingMore && <Spinner size={14}/>} {t("notifications:list.load_more")}
            </Button>
          </div>
        )}
      </PanelState>

      <ConfirmDialog
        open={deleting !== null}
        title={t("notifications:list.delete_title")}
        body={t("notifications:list.delete_body", {title: deleting?.title ?? ""})}
        confirmLabel={t("notifications:list.delete")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={() => void onDelete()}
      />
    </Panel>
  );
};
