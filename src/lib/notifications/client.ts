import {createHttpClient} from "@/lib/auth/client.ts";
import {webSession} from "@/lib/auth/session.ts";
import type {Language} from "@/lib/a11y";
import {NOTIFICATIONS_BASE_URL} from "@/lib/notifications/config.ts";
import type {
  AppNotification,
  NotificationCategory,
  NotificationFilter,
  NotificationPage,
  NotificationPreferences,
  NotificationsStatus,
  PreferencesPatch,
  PushDevice,
} from "@/lib/notifications/types.ts";

/**
 * One function per endpoint of the notifications service.
 *
 * Built over the site's own session: the service accepts tokens minted for `franciscosolis-web`
 * only, and every `/me/*` row it answers belongs to the token's `sub`. The HTTP client is shared
 * for its timeout, its refresh-and-retry on a 401 and its error taxonomy.
 */
const http = createHttpClient(NOTIFICATIONS_BASE_URL, webSession);

const query = (params: Record<string, string | number | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    search.set(key, String(value));
  }
  const serialized = search.toString();
  return serialized ? `?${serialized}` : "";
};

const seg = (value: string) => encodeURIComponent(value);

export type ListOptions = {
  locale?: Language;
  limit?: number;
  cursor?: string | null;
  filter?: NotificationFilter;
  category?: NotificationCategory | "";
  signal?: AbortSignal;
};

export const notificationsApi = {
  /** Public: the vocabularies, the digest schedule and the VAPID key a push subscription needs. */
  status: (signal?: AbortSignal) => http.request<NotificationsStatus>("/", {auth: false, signal}),

  list: ({locale, limit, cursor, filter, category, signal}: ListOptions = {}) =>
    http.request<NotificationPage>(
      `/me/notifications${query({
        locale,
        limit,
        cursor: cursor ?? undefined,
        filter: filter === "all" ? undefined : filter,
        category,
      })}`,
      {envelope: true, signal},
    ),

  unreadCount: (signal?: AbortSignal) =>
    http.request<{unread: number}>("/me/notifications/unread-count", {signal}),

  markRead: (id: string, locale?: Language) =>
    http.request<AppNotification>(`/me/notifications/${seg(id)}/read${query({locale})}`, {method: "POST"}),

  markUnread: (id: string, locale?: Language) =>
    http.request<AppNotification>(`/me/notifications/${seg(id)}/unread${query({locale})}`, {method: "POST"}),

  /** Every unread notification, or every one in a category when one is named. */
  markAllRead: (category?: NotificationCategory) =>
    http.request<{updated: number}>("/me/notifications/read-all", {
      method: "POST",
      json: category ? {category} : {},
    }),

  remove: (id: string) => http.request<void>(`/me/notifications/${seg(id)}`, {method: "DELETE"}),

  preferences: (signal?: AbortSignal) => http.request<NotificationPreferences>("/me/preferences", {signal}),

  /** Partial on purpose: the service merges, and answers with the whole resulting set. */
  updatePreferences: (patch: PreferencesPatch) =>
    http.request<NotificationPreferences>("/me/preferences", {method: "PUT", json: patch}),

  devices: (signal?: AbortSignal) => http.request<PushDevice[]>("/me/push-subscriptions", {signal}),

  /** Upserts on the endpoint, so registering the same browser twice leaves one row. */
  registerDevice: (subscription: {endpoint: string; keys: {p256dh: string; auth: string}; user_agent?: string}) =>
    http.request<PushDevice>("/me/push-subscriptions", {method: "POST", json: subscription}),

  removeDevice: (id: string) => http.request<void>(`/me/push-subscriptions/${seg(id)}`, {method: "DELETE"}),

  /** Sends a test push to every device the account registered, and says how many it reached. */
  testPush: () => http.request<{sent: number}>("/me/push-subscriptions/test", {method: "POST"}),
};
