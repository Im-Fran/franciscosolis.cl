import {useCallback, useEffect, useRef, useState} from "react";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeError, useResource, type Resource} from "@/lib/auth/useResource.ts";
import {marketplaceContent} from "@/lib/marketplace/content.ts";
import type {ProductAccess, DownloadTicket, ReleaseFiles} from "@/lib/marketplace/types.ts";

/**
 * The paid half of a product page: who has paid, what that entitles them to, and how a build
 * actually reaches their disk.
 *
 * Kept apart from `content.ts` because it is a different kind of thing. That file reads published
 * content, is cacheable and is the same for everybody; everything here is *per person* and never
 * cached — it depends on the session, and it changes the moment a payment settles.
 */

/** How long the site keeps asking whether a payment landed, after the provider sent the visitor back. */
const CONFIRM_ATTEMPTS = 10;
const CONFIRM_INTERVAL_MS = 2_000;

/**
 * Whether this visitor may download, and what to show them first.
 *
 * Re-read whenever the session changes: signing in is exactly the moment a visitor stops being
 * anonymous and starts being somebody who may already own this. `reload` is what a completed
 * payment calls.
 */
export const useProductAccess = (slug: string, channel?: string): Resource<ProductAccess> => {
  const {status} = useAuth();
  return useResource(
    useCallback(
      (signal: AbortSignal) => {
        /*
         * `status` is touched rather than used: it is a dependency so that signing in re-asks the
         * question, which is the one moment an anonymous visitor turns into somebody who may already
         * own this. The answer itself comes from the token the client attaches.
         */
        void status;
        return marketplaceContent.access(slug, channel, signal);
      },
      [slug, channel, status],
    ),
  );
};

/**
 * The builds attached to one release. Public, so it does not depend on the session.
 *
 * Addressed by channel as well as version because the service keys a release on both: the same
 * `1.4.0` can exist as an `rc` and as a `release`, shipping different files.
 */
export const useReleaseFiles = (slug: string, channel: string, version: string): Resource<ReleaseFiles> =>
  useResource(
    useCallback(
      (signal: AbortSignal) => marketplaceContent.releaseFiles(slug, channel, version, signal),
      [slug, channel, version],
    ),
  );

/**
 * Starts the browser's download without leaving the page.
 *
 * An anchor click rather than assigning `location`: the response carries a `Content-Disposition`,
 * so the browser saves it either way, but a navigation that the browser then cancels blanks the
 * page in some of them for as long as it takes to decide. `rel="noopener"` because the URL carries
 * a ticket, and `noreferrer` keeps it out of the next page's `Referer`.
 */
const triggerDownload = (url: string, filename: string) => {
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener noreferrer";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
};

export type DownloadState = {
  /** The file currently being prepared, so one row can show a spinner without the others doing it. */
  pending: string | null;
  /** Seconds left of the cooldown. Zero for somebody who has paid — their link works at once. */
  secondsLeft: number;
  /**
   * The link, once it works. Rendered as a plain anchor beside the countdown so the download is
   * always reachable by hand: a browser that refuses a programmatic click must not be a dead end.
   *
   * Carries the file's id, not just its name: filenames repeat across releases, and matching on one
   * would light up the manual link on every row that happens to ship a file called `app.jar`.
   */
  ready: {fileId: string; url: string; filename: string} | null;
  error: string | null;
  start: (fileId: string, filename: string) => void;
  dismiss: () => void;
};

/**
 * Turns "I want this build" into a download, cooldown included.
 *
 * The five seconds are the *service's*: the minted link is not valid until `available_at`, and
 * asking for the bytes early answers 425. So this counts down to the time the service gave rather
 * than to one of its own — a page that started the download early would simply fail, and a page
 * that invented the wait could be skipped from the console.
 */
export const useDownload = (slug: string): DownloadState => {
  const [pending, setPending] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [ready, setReady] = useState<DownloadState["ready"]>(null);
  const [error, setError] = useState<string | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const begin = useCallback(
    (ticket: DownloadTicket, fileId: string, filename: string) => {
      const waitMs = Math.max(0, new Date(ticket.available_at).getTime() - Date.now());
      const seconds = Math.ceil(waitMs / 1000);
      setSecondsLeft(seconds);

      /* One timer per remaining second, so the number on screen is the one the link is waiting for. */
      for (let left = seconds - 1; left >= 0; left--) {
        timers.current.push(setTimeout(() => setSecondsLeft(left), (seconds - left) * 1000));
      }

      timers.current.push(
        setTimeout(() => {
          setPending(null);
          setReady({fileId, url: ticket.url, filename});
          triggerDownload(ticket.url, filename);
        }, waitMs),
      );
    },
    [],
  );

  const start = useCallback(
    (fileId: string, filename: string) => {
      clearTimers();
      setError(null);
      setReady(null);
      setPending(fileId);

      marketplaceContent
        .downloadTicket(slug, fileId)
        .then((ticket) => begin(ticket, fileId, filename))
        .catch((cause: unknown) => {
          setPending(null);
          setSecondsLeft(0);
          setError(describeError(cause).message);
        });
    },
    [slug, begin, clearTimers],
  );

  const dismiss = useCallback(() => {
    clearTimers();
    setPending(null);
    setSecondsLeft(0);
    setReady(null);
    setError(null);
  }, [clearTimers]);

  return {pending, secondsLeft, ready, error, start, dismiss};
};

/** Query keys MercadoPago appends when it sends the browser back to us. */
const RETURN_KEYS = ["collection_status", "collection_id", "payment_id", "preference_id", "status", "merchant_order_id"];

export type PaymentReturn = {
  /** True while the site is waiting for the payment to be confirmed. */
  confirming: boolean;
  /** Set once a payment came back and was confirmed, so the page can say so. */
  confirmed: boolean;
};

/**
 * Handles the visitor coming back from the payment provider.
 *
 * The provider returns them the moment *it* is done, which is before the notification that settles
 * the payment has necessarily reached the service — so "did it work" is answered by polling our own
 * `access`, not by reading the status the provider put in the query string. That status is the
 * payer's browser talking; the entitlement is the webhook's.
 *
 * The query string is cleaned either way, so a reload or a shared link does not look like a fresh
 * return from a payment that already happened.
 */
export const usePaymentReturn = (access: Resource<ProductAccess>): PaymentReturn => {
  const [confirming, setConfirming] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const reload = access.reload;
  const hasPaid = access.data?.has_paid ?? false;
  const attempts = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    if (armed.current) return;
    const params = new URLSearchParams(window.location.search);
    if (!RETURN_KEYS.some((key) => params.has(key))) return;

    armed.current = true;
    setConfirming(true);

    for (const key of RETURN_KEYS) params.delete(key);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, []);

  useEffect(() => {
    if (!confirming) return;

    if (hasPaid) {
      setConfirming(false);
      setConfirmed(true);
      return;
    }

    if (attempts.current >= CONFIRM_ATTEMPTS) {
      /* Giving up quietly: the payment may still land, and the page says what it knows now. */
      setConfirming(false);
      return;
    }

    const timer = setTimeout(() => {
      attempts.current += 1;
      reload();
    }, CONFIRM_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [confirming, hasPaid, reload]);

  return {confirming, confirmed};
};

/*
 * `formatAmount` moved to `money.ts` when the sales console started needing it: the console must
 * not import this module, whose hooks and public content client it has no use for. Re-exported here
 * so the product page's own imports read as they always have.
 */
export {formatAmount} from "@/lib/marketplace/money.ts";

/** A file size somebody can read at a glance. Binary units, because that is what a build is measured in. */
export const formatBytes = (bytes: number, locale: string): string => {
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  const formatted = new Intl.NumberFormat(locale, {maximumFractionDigits: value < 10 && unit > 0 ? 1 : 0}).format(value);
  return `${formatted} ${units[unit]}`;
};
