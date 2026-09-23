import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {UNREAD_POLL_MS} from "@/lib/notifications/config.ts";
import {notificationsApi} from "@/lib/notifications/client.ts";
import {NotificationsContext} from "@/lib/notifications/notifications-context.ts";
import {
  currentSubscription,
  readStoredDevice,
  subscriptionBody,
  unsubscribe,
  writeStoredDevice,
} from "@/lib/notifications/push.ts";

/** A focus and a visibility change usually arrive together; one request answers both. */
const MIN_REFRESH_GAP_MS = 5_000;

/**
 * The unread count, kept live for whoever is signed in to the site.
 *
 * Mounted once, inside the site's own `AuthProvider` and above the router, so the bell on the home
 * page and the account's notifications tab read the same number. It never asks for a session: while
 * nobody is signed in it does nothing at all, which is what lets the home page carry a bell without
 * becoming a gated page.
 *
 * Three things move the number, and the contract names all three:
 *
 * - a **poll** every minute, but only while the tab is visible — a background tab has nobody to
 *   show a badge to, and the next focus asks anyway;
 * - **focus and visibility**, so coming back to the tab is never met with a stale badge;
 * - a **message from the service worker** when a push arrives, which is the one that makes it
 *   immediate on a browser that has push.
 *
 * It also owns the one piece of push bookkeeping that has to happen whatever page is open: a
 * browser's subscription belongs to the account that registered it. Signing out — from any screen,
 * including the one in another tab — drops the subscription locally, so the next person to use
 * this browser does not receive the previous one's sign-in alerts. The service's row goes stale and
 * is pruned the first time a push to it bounces.
 */
export const NotificationsProvider = ({children}: {children: ReactNode}) => {
  const {status, me} = useAuth();
  const sub = me?.user.id ?? null;
  const enabled = status === "authenticated";

  const [unread, setUnread] = useState<number | null>(null);
  const [revision, setRevision] = useState(0);
  const lastFetch = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    lastFetch.current = Date.now();
    try {
      setUnread((await notificationsApi.unreadCount()).unread);
    } catch {
      /* A missed poll changes nothing; the next one, or the next focus, asks again. */
    }
  }, [enabled]);

  /* The poll, plus focus and visibility. Nothing runs while signed out. */
  useEffect(() => {
    if (!enabled) {
      setUnread(null);
      return;
    }

    void refresh();

    const soon = () => {
      if (document.visibilityState !== "visible") return;
      if (Date.now() - lastFetch.current < MIN_REFRESH_GAP_MS) return;
      void refresh();
    };
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, UNREAD_POLL_MS);

    document.addEventListener("visibilitychange", soon);
    window.addEventListener("focus", soon);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", soon);
      window.removeEventListener("focus", soon);
    };
  }, [enabled, refresh]);

  /*
   * Keeps the service's row for this browser pointing at the live subscription. Browsers rotate a
   * subscription's endpoint now and then, and the worker cannot tell the API itself — it holds no
   * token — so the page does it, whenever it is open and signed in as the account that registered.
   */
  const syncDevice = useCallback(async () => {
    const stored = readStoredDevice();
    if (!stored || !sub) return;
    if (stored.sub !== sub) {
      await unsubscribe();
      return;
    }
    const subscription = await currentSubscription();
    if (!subscription) {
      writeStoredDevice(null);
      return;
    }
    if (subscription.endpoint === stored.endpoint) return;
    try {
      const device = await notificationsApi.registerDevice(subscriptionBody(subscription));
      writeStoredDevice({id: device.id, endpoint: subscription.endpoint, sub});
    } catch {
      /* Tried again on the next load. */
    }
  }, [sub]);

  useEffect(() => {
    if (status === "anonymous" && readStoredDevice()) void unsubscribe();
    if (status === "authenticated") void syncDevice();
  }, [status, syncDevice]);

  /* What the service worker says when a push lands, or when the browser replaced its subscription. */
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const container = navigator.serviceWorker;

    const onMessage = (event: MessageEvent) => {
      const message = event.data as {type?: string} | null;
      if (message?.type === "notification") {
        void refresh();
        setRevision((value) => value + 1);
      } else if (message?.type === "pushsubscriptionchange") {
        void syncDevice();
      }
    };

    container.addEventListener("message", onMessage);
    /* `addEventListener` does not start the queue the way assigning `onmessage` would. */
    container.startMessages();
    return () => container.removeEventListener("message", onMessage);
  }, [refresh, syncDevice]);

  const value = useMemo(
    () => ({enabled, unread: enabled ? unread : null, revision, refresh, setUnread}),
    [enabled, unread, revision, refresh],
  );

  return <NotificationsContext value={value}>{children}</NotificationsContext>;
};
