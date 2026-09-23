/**
 * Where the notifications service lives, and the few numbers the front-end half of it runs on.
 *
 * The service is `apps/notifications` in the API repository, behind the gateway at
 * `/notifications`. It accepts the *site's* own session (`franciscosolis-web`) and nothing else, and
 * it answers only for the account the token belongs to — there is no console and no permission, so
 * this section needs no client application of its own and signs in with `webAuth`.
 *
 * The base URL is a build-time variable like every other service's, which is how the development
 * build ends up talking to `api-dev.franciscosolis.cl` (see `.env.dev` and docs/ENVIRONMENTS.md).
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const NOTIFICATIONS_BASE_URL = trimTrailingSlash(
  import.meta.env.VITE_NOTIFICATIONS_BASE_URL ?? "https://api.franciscosolis.cl/notifications",
);

/**
 * How often the unread count is asked again while the tab is visible.
 *
 * A minute is the compromise the contract settled on: push is what makes a notification feel
 * immediate, and the poll is the safety net for a browser without it — frequent enough that the
 * badge is never stale for long, rare enough that an idle tab costs nothing worth measuring.
 */
export const UNREAD_POLL_MS = 60_000;

/** How many notifications the bell's panel shows. The account tab is where the rest are. */
export const BELL_LIMIT = 8;

/** Page size of the account tab's list. */
export const PAGE_SIZE = 20;

/**
 * The service worker's address. It sits at the root on purpose: a worker's default scope is the
 * directory it is served from, and a push that opens `/account/sessions` needs one that covers the
 * whole site.
 */
export const SERVICE_WORKER_URL = "/sw.js";

export const NOTIFICATION_CATEGORIES = ["account", "support", "marketplace"] as const;

export const EMAIL_FREQUENCIES = ["immediate", "daily", "weekly", "never"] as const;

export const CHANNELS = ["push", "email"] as const;
