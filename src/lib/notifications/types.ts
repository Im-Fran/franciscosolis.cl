import type {CHANNELS, EMAIL_FREQUENCIES, NOTIFICATION_CATEGORIES} from "@/lib/notifications/config.ts";

/**
 * The notifications service's shapes, as its contract states them.
 *
 * Titles and bodies arrive already written in the language asked for with `?locale=`, so nothing
 * here is translated on this side: the service owns the catalogue, and a notification about a
 * sign-in reads the same in the bell, in the push banner and in the digest email.
 */

export type NotificationCategory = (typeof NOTIFICATION_CATEGORIES)[number];
export type EmailFrequency = (typeof EMAIL_FREQUENCIES)[number];
export type NotificationChannel = (typeof CHANNELS)[number];

export type AppNotification = {
  id: string;
  /** `<category>.<event>`, e.g. `account.sign_in`. */
  type: string;
  category: NotificationCategory;
  title: string;
  body: string;
  /** A path on this site, or null when there is nowhere in particular to go. */
  url: string | null;
  data: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

/** `GET /me/notifications` answers its paging and the unread count beside `data`, not inside it. */
export type NotificationPage = {
  code: number;
  data: AppNotification[];
  next_cursor: string | null;
  unread: number;
};

export type NotificationFilter = "all" | "unread";

export type NotificationPreferences = {
  email_frequency: EmailFrequency;
  categories: Record<NotificationCategory, Record<NotificationChannel, boolean>>;
  locale: "en" | "es";
};

/** What `PUT /me/preferences` accepts: any subset, merged by the service. */
export type PreferencesPatch = {
  email_frequency?: EmailFrequency;
  categories?: Partial<Record<NotificationCategory, Partial<Record<NotificationChannel, boolean>>>>;
  locale?: "en" | "es";
};

export type PushDevice = {
  id: string;
  user_agent: string | null;
  created_at: string;
  last_used_at: string | null;
};

/** The public `GET /` answer: the closed vocabularies, the digest schedule and the VAPID key. */
export type NotificationsStatus = {
  message: string;
  categories: NotificationCategory[];
  types: string[];
  email_frequencies: EmailFrequency[];
  digest: {timezone: string; hour: number; weekly_day: string};
  push: {vapid_public_key: string | null};
};
