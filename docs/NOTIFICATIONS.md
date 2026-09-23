# Notifications

The bell on the home page, the notifications tab at `/account/notifications` and Web Push are the
front-end of [`apps/notifications`](https://github.com/Im-Fran/api.franciscosolis.cl/tree/dev/apps/notifications),
reached through `https://api.franciscosolis.cl/notifications` (`VITE_NOTIFICATIONS_BASE_URL`;
`api-dev` in `.env.dev`).

| Where | What it is |
| --- | --- |
| Home page header | *Sign in* when signed out; the bell and the account menu when signed in |
| `/account/notifications` | The list, the preferences and the push devices, as three panels on one tab |
| `public/sw.js` | The service worker: shows a push, opens its link, tells open tabs |
| `public/site.webmanifest` | What makes the site installable — and, on iOS, what makes push possible at all |

## The site's own session, and nobody else's

The service accepts access tokens minted for `franciscosolis-web` only and answers each account for
its own rows. There is no console and no permission, so this section has no client application of
its own: `src/lib/notifications/client.ts` is built over `webSession`, the same way the store half of
the marketplace is.

## Reading a session without asking for one

The home page is public and stays public. It never sits behind `RequireAuth`; it reads the
`AuthProvider` that `main.tsx` already mounts over the whole application, which restores a stored
session on load and otherwise reports `anonymous` without redirecting anywhere. The header shows:

- `loading` — a placeholder the size of the avatar, so a signed-in visitor never sees the sign-in
  button flash first;
- `anonymous` — *Sign in*, which calls `client.flow.startAuthorization("/")`: the same hand-off
  `/auth` performs, returning to the home page. A hand-off that never left the browser falls back to
  `/auth?return_to=/`, which explains and retries;
- `authenticated` — the bell and the avatar menu (*My account*, *Notifications*, *Sign out*).

The CMS, support and marketplace consoles nest their own providers over their own routes, so none
of this touches their sessions.

## Keeping the badge honest

`NotificationsProvider` (`src/lib/notifications/`) sits inside the site's `AuthProvider` and above
the router, so the bell and the tab read one count. It does nothing while signed out. While signed
in, the count moves on three things:

1. a poll of `GET /me/notifications/unread-count` every 60 s, **only while the tab is visible**;
2. `visibilitychange` and `focus`, collapsed to one request if they arrive together;
3. a `{type: "notification"}` message from the service worker when a push lands — the one that
   makes it immediate. It also bumps `revision`, so an open list reads itself again.

The list endpoint answers `next_cursor` and `unread` *beside* `data`, so it is called with the HTTP
client's `envelope` option, which hands back the whole body instead of unwrapping it. Every list
read feeds its `unread` back into the provider.

Titles and bodies arrive already written in the reader's language: every read passes `?locale=`
from the accessibility preferences, and nothing about a notification is translated on this side.

## The bell

The panel reads the latest eight only when it opens — fetching them every minute for a menu nobody
opened would be most of this feature's traffic. Choosing a notification marks it read and follows
its `url`; that *is* the per-row "mark as read", because a second button inside a menu item is a
control inside a control. The explicit read/unread toggle, deleting and filtering are on the tab.
A `url` is followed only when it is a path on this site (`isSitePath`), never `//host` or a
backslash.

## The tab

- **List.** All / unread and a category, kept in the query string so a filtered view is an address.
  Paging is *Load more* over `next_cursor` — the service has no totals, so page numbers would be a
  promise the screen cannot keep. Deleting is confirmed; nothing on these APIs is undoable.
- **Preferences.** One email frequency (immediate, a daily digest at 09:00 Chile time, a weekly one
  on Mondays at 09:00, or never) and a push/email switch per category. Each control writes straight
  through with a partial `PUT` and shows what the service answers, like the console's settings. The
  copy states that in-site notifications cannot be switched off and that some mail — sign-in links,
  invitations, receipts, refunds, support replies — is sent by its producer whatever is chosen.
- **Push.** The switch for this browser, the devices the account registered, and *Send a test*.

## Web Push

`src/lib/notifications/push.ts` wraps what the browser can do. `pushSupport()` distinguishes three
answers, because each has a different fix:

| State | Why | What the tab says |
| --- | --- | --- |
| `ios-install` | iOS/iPadOS only expose the Push API to a site added to the home screen | Share → *Add to Home Screen*, then come back |
| `unsupported` | No service worker, Push API or Notification API | Use a recent browser; the list still works |
| `supported` | — | Then: permission `denied` → how to unblock it; no VAPID key on the service → unavailable; otherwise the button |

Enabling asks for permission **from the click** (browsers refuse or penalise unprompted requests),
subscribes with the `vapid_public_key` from `GET /notifications/`, and posts the subscription to
`POST /me/push-subscriptions`. A subscription made under an older key is dropped and made again.

The service's device list carries no endpoint, deliberately — an endpoint is a capability to push to
somebody — so which row is *this* browser is remembered locally under `fs.notifications.device`
(`{id, endpoint, sub}`). That record is also what the provider uses for two pieces of bookkeeping
that have to run whatever page is open:

- **A subscription belongs to the account that registered it.** When the session ends — from any
  screen, or another tab — or a different account signs in, the browser's subscription is dropped
  locally, so the next person on this browser does not receive the previous one's sign-in alerts.
  The service's row goes stale and is pruned the first time a push to it bounces.
- **Endpoints rotate.** The worker holds no token and cannot tell the API, so it posts
  `{type: "pushsubscriptionchange"}` to open tabs, and on every signed-in load the provider
  re-registers a subscription whose endpoint no longer matches the one it recorded.

## The service worker

`public/sw.js` is plain JavaScript served verbatim at `/sw.js`, outside the Vite bundle. Sitting at
the root gives it the whole site as its scope, so it needs no `Service-Worker-Allowed` header.

- `push` shows the payload's `title` and `body` with `/icon-192.png` and the mono mark as the
  badge, uses the payload's `tag` so a repeat alert replaces rather than stacks, and posts
  `{type: "notification", id}` to every open tab.
- `notificationclick` focuses a tab already on the target path, otherwise navigates an open tab of
  this site there, otherwise opens a window. Only site paths are opened.

It has **no `fetch` handler and caches nothing**. A worker that serves the SPA from a cache is the
classic way to keep an old bundle alive after a deploy, and installability does not need one. That
is also why it is registered in every build, `vite dev` included (`main.tsx`, after `load`): it
cannot serve a stale chunk or interfere with HMR. It is registered with `updateViaCache: "none"`,
and `public/_headers` sends `Cache-Control: no-cache` for it and for the manifest, so a fix to the
worker reaches installed apps on their next update check.

## Installing the site

`site.webmanifest` declares `id`, `scope`, `start_url`, `display: standalone`, the brand's ink
background and iris theme, the regular and maskable icons, and shortcuts to the account and the
notifications tab. `index.html` adds the Apple tags iOS still reads instead of the manifest. On
iPhone and iPad this is not optional polish: installing is the only way push works there.

## Layout of the code

```
src/lib/notifications/
  config.ts                   base URL, poll interval, page sizes, the closed vocabularies
  types.ts                    the contract's shapes
  client.ts                   one function per endpoint, over the site's session
  push.ts                     support detection, service worker, subscribe/unsubscribe, device record
  notifications-context.ts / notifications-provider.tsx   the live unread count
  format.ts                   relative times and the site-path guard
src/components/notifications/ the bell, the account menu and the category icons
src/pages/auth/account/notifications/   the tab: list, preferences and push panels
public/sw.js                  the service worker
```

Copy lives in the `notifications` namespace, preloaded in `main.tsx` because the bell is on the
home page; the tab's label is `auth:account.tabs.notifications` like every other tab.
