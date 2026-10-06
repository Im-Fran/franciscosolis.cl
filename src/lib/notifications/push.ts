import {SERVICE_WORKER_URL} from "@/lib/notifications/config.ts";

/**
 * Web Push on this side: the service worker, the permission and the subscription.
 *
 * Nothing here talks to the API — `notifications-provider.tsx` and the devices panel do that — so
 * every function is a thin, honest wrapper over what the browser can and cannot do. The part worth
 * reading is `pushSupport`, because "this browser has no push" has three different answers and each
 * needs a different sentence on screen.
 */

/** Where this device's registration is remembered, so the devices list can say which row is this one. */
const DEVICE_KEY = "fs.notifications.device";

export type StoredDevice = {
  /** The service's id for the row, which is what removing it takes. */
  id: string;
  endpoint: string;
  /** The account that registered it — a browser shared by two people must not keep the first one's pushes. */
  sub: string;
};

export const readStoredDevice = (): StoredDevice | null => {
  try {
    const parsed = JSON.parse(localStorage.getItem(DEVICE_KEY) ?? "null") as Partial<StoredDevice> | null;
    return parsed && typeof parsed.id === "string" && typeof parsed.endpoint === "string" && typeof parsed.sub === "string"
      ? (parsed as StoredDevice)
      : null;
  } catch {
    return null;
  }
};

export const writeStoredDevice = (device: StoredDevice | null) => {
  try {
    if (device) localStorage.setItem(DEVICE_KEY, JSON.stringify(device));
    else localStorage.removeItem(DEVICE_KEY);
  } catch {
    /* Storage blocked: the device still works, the list just cannot point at it. */
  }
};

const isIos = () =>
  /iPhone|iPad|iPod/i.test(navigator.userAgent) ||
  /* iPadOS reports itself as a Mac, and is the one Mac with a touch screen. */
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);

const isStandalone = () =>
  window.matchMedia?.("(display-mode: standalone)").matches ||
  (navigator as Navigator & {standalone?: boolean}).standalone === true;

/**
 * What this browser can do about push, in the terms the screen has to explain.
 *
 * - `supported` — service worker, Push API and Notification API are all there.
 * - `ios-install` — iOS and iPadOS only expose push to a site *added to the home screen*. In a Safari
 *   tab the Push API is simply missing, which would otherwise read as "unsupported" and leave the
 *   person with no idea that one tap on Share would fix it.
 * - `unsupported` — anything else without the APIs: an old browser, a private window that withholds
 *   them, an embedded web view.
 */
export type PushSupport = "supported" | "ios-install" | "unsupported";

export const pushSupport = (): PushSupport => {
  const available =
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window;
  if (available) return "supported";
  if (typeof window !== "undefined" && isIos() && !isStandalone()) return "ios-install";
  return "unsupported";
};

/**
 * Registers `/sw.js` over the whole site. Idempotent — the browser returns the existing
 * registration when the script has not changed — so it is called both at startup and right before
 * subscribing, which is what makes enabling push work even if the startup registration failed.
 */
export const registerServiceWorker = async (): Promise<ServiceWorkerRegistration | null> => {
  if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    /*
     * `updateViaCache: "none"` makes the browser revalidate the script itself on every update check
     * rather than trusting an HTTP cache. The worker is small and changes rarely, and a stale one is
     * the only way a fix to click handling would fail to reach an installed app.
     */
    return await navigator.serviceWorker.register(SERVICE_WORKER_URL, {scope: "/", updateViaCache: "none"});
  } catch (cause) {
    console.warn("Service worker registration failed:", cause);
    return null;
  }
};

/** The subscription this browser already holds, if any. Never prompts. */
export const currentSubscription = async (): Promise<PushSubscription | null> => {
  if (pushSupport() !== "supported") return null;
  const registration = await navigator.serviceWorker.getRegistration("/");
  return (await registration?.pushManager.getSubscription()) ?? null;
};

/** A base64url VAPID key, as the Push API wants it: the raw bytes of the uncompressed P-256 point. */
const keyBytes = (base64url: string) => {
  const padded = `${base64url}${"=".repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(padded);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) bytes[index] = raw.charCodeAt(index);
  return bytes;
};

export type SubscribeOutcome =
  | {ok: true; subscription: PushSubscription}
  | {ok: false; reason: "denied" | "dismissed" | "unsupported" | "failed"};

/**
 * Asks for permission and subscribes this browser.
 *
 * Must be called from a click: Safari and Firefox refuse `requestPermission` outside a user
 * gesture, and every browser treats an unprompted request as a reason to start auto-denying.
 *
 * A subscription made under a *different* VAPID key — the service rotated its key pair — cannot be
 * reused and makes `subscribe` throw, so it is dropped and made again rather than reported as a
 * failure the person could do nothing about.
 */
export const subscribe = async (vapidPublicKey: string): Promise<SubscribeOutcome> => {
  if (pushSupport() !== "supported") return {ok: false, reason: "unsupported"};

  const permission = await Notification.requestPermission();
  if (permission === "denied") return {ok: false, reason: "denied"};
  if (permission !== "granted") return {ok: false, reason: "dismissed"};

  const registration = (await registerServiceWorker()) ?? null;
  if (!registration) return {ok: false, reason: "failed"};
  await navigator.serviceWorker.ready;

  const options: PushSubscriptionOptionsInit = {userVisibleOnly: true, applicationServerKey: keyBytes(vapidPublicKey)};
  try {
    return {ok: true, subscription: await registration.pushManager.subscribe(options)};
  } catch {
    try {
      await (await registration.pushManager.getSubscription())?.unsubscribe();
      return {ok: true, subscription: await registration.pushManager.subscribe(options)};
    } catch (cause) {
      console.warn("Push subscription failed:", cause);
      return {ok: false, reason: "failed"};
    }
  }
};

/** Drops this browser's subscription locally. Removing the service's row is the caller's half. */
export const unsubscribe = async () => {
  try {
    await (await currentSubscription())?.unsubscribe();
  } catch {
    /* Already gone, or the browser forgot it: either way there is nothing left to drop. */
  }
  writeStoredDevice(null);
};

/** The body `POST /me/push-subscriptions` takes, read off a live subscription. */
export const subscriptionBody = (subscription: PushSubscription) => {
  const json = subscription.toJSON();
  return {
    endpoint: subscription.endpoint,
    keys: {p256dh: json.keys?.p256dh ?? "", auth: json.keys?.auth ?? ""},
    user_agent: navigator.userAgent,
  };
};
