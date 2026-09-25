/*
 * The site's service worker. It does two things and deliberately nothing else: it shows a Web Push
 * notification when one arrives, and it takes the browser somewhere when one is clicked.
 *
 * There is no `fetch` handler and no cache. A worker that serves the SPA from a cache is the classic
 * way to keep an old bundle alive after a deploy — the page asks for chunks the new deploy no longer
 * has, and the fix is on the visitor's side. Installing the site as an app does not need one either:
 * browsers only require the manifest and a registered worker. So this file never touches a request.
 *
 * Plain JavaScript, served verbatim from `public/`: it is not part of the Vite bundle, it is loaded
 * by the browser at /sw.js, and its scope is the whole site because that is where it sits. See
 * docs/NOTIFICATIONS.md.
 */

const ICON = "/icon-192.png";
/* Android draws the badge as a silhouette from its alpha channel, so the mono mark is the one. */
const BADGE = "/brand/png/fs-mark-mono-white.png";

self.addEventListener("install", () => {
  /* Nothing to precache, so nothing is gained by waiting behind an older worker. */
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

/* Every open tab of this site, whether or not this worker controls it yet. */
const windows = () => self.clients.matchAll({type: "window", includeUncontrolled: true});

/* Tells open tabs something changed, so the bell can re-read the unread count now instead of a minute from now. */
const broadcast = async (message) => {
  for (const client of await windows()) client.postMessage(message);
};

/*
 * Only paths on this site are opened. The service writes paths, and holding it to that means a
 * payload that somehow carried an absolute URL cannot turn a notification into an off-site link.
 */
const sitePath = (value) =>
  typeof value === "string" && value.startsWith("/") && !value.startsWith("//") && !value.includes("\\")
    ? value
    : "/";

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    /* A body that is not JSON still earns a notification — a push with nothing shown is penalised. */
    payload = {body: event.data ? event.data.text() : ""};
  }

  const title = typeof payload.title === "string" && payload.title ? payload.title : "FranciscoSolis";
  const options = {
    body: typeof payload.body === "string" ? payload.body : "",
    icon: ICON,
    badge: BADGE,
    data: {url: sitePath(payload.url), id: payload.id ?? null},
  };
  /* Same tag, same slot: a second alert about the same thing replaces the first instead of stacking. */
  if (typeof payload.tag === "string" && payload.tag) {
    options.tag = payload.tag;
    options.renotify = true;
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      broadcast({type: "notification", id: payload.id ?? null}),
    ]),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(sitePath(event.notification.data && event.notification.data.url), self.location.origin);

  event.waitUntil(
    (async () => {
      const open = await windows();
      /* A tab already on that page is focused as it is; any other tab of this site is taken there. */
      const exact = open.find((client) => client.url === url.href);
      if (exact) return exact.focus();

      const any = open.find((client) => new URL(client.url).origin === self.location.origin);
      if (any && "navigate" in any) {
        try {
          const focused = await any.focus();
          return await focused.navigate(url.href);
        } catch {
          /* `navigate` refuses a tab this worker does not control; a new window always works. */
        }
      }
      return self.clients.openWindow(url.href);
    })(),
  );
});

/*
 * The browser replaced this device's subscription (an expiry, a key rotation on its side). The
 * worker holds no token, so it cannot tell the API; it tells any open tab, which re-registers
 * through the signed-in session. A browser with no tab open catches up on the next visit.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(broadcast({type: "pushsubscriptionchange"}));
});
