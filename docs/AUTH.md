# Auth interface

The screens under `/auth`, your account at `/account` and the hosted sign-in screen at `/apps/auth`
are the front-end of
[`franciscosolis-auth`](https://api.franciscosolis.cl/auth/openapi.json), the centralized auth
service for franciscosolis.cl and its services. That service is a pure API — it renders no HTML —
so every page a user sees during a sign-in is one of these.

| Route            | What it is                                                              |
| ---------------- | ----------------------------------------------------------------------- |
| `/auth`          | Hands the browser to the hosted sign-in screen and waits — collects nothing |
| `/auth/callback` | Where every provider returns; redeems the authorization code            |
| `/auth/admin/*`  | The administration console — see below                                   |
| `/account/*`     | Your account, one tab per section — see below                            |
| `/apps/auth`     | The service's **hosted** sign-in screen — see below                      |

`/account` and `/auth/admin` need a session; anonymous visitors are sent to `/auth` with a
`return_to` so the flow resumes where they were headed.

Two things moved, and both old shapes still resolve. The account used to answer under
`/auth/account`; `/auth/account/*` is forwarded to `/account/*`, sub-path and query string intact,
so a bookmarked tab still lands on that tab. And `/auth` used to be a credential form of its own —
the only screen on this origin that was — which is covered under
[the hosted sign-in screen](#the-hosted-sign-in-screen) below.

## The email signature

`/account` grows one extra tab for accounts whose address is on `@franciscosolis.cl`: a
generator for the corporate email signature, ready to paste into Gmail, Outlook or anything else.

It is deliberately the *only* thing on these screens that talks to no API. A signature is not
account state — it is a block of HTML a person pastes into their mail client once and then owns —
so there is nothing for the service to store and nothing for an administrator to manage. The draft
lives in this browser's `localStorage` under `fs.auth.signature.v2` so that returning to the screen
does not mean retyping every link, keyed to the address that wrote it; the profile is the default it
is restored from. A `v1` draft — one list of links, written before they were split in two — is read
once as the person's own links and rewritten in the current shape.

**Tables, not the design system.** `build-signature.ts` emits nested tables with every rule inline,
because mail clients are not browsers: Gmail drops `<style>` blocks and Outlook renders through Word,
which ignores flexbox, grid and most of `display`. The preview beside the form renders that same
string, so what is previewed is what is pasted. The person's picture is circled with
`border-radius`, which every webmail honours and Word does not — it falls back to a square, which is
why the picture is square to begin with. It is the only image in the block that is not a favicon:
the company's name set in ink above its address carries that half, where a second circled mark a few
lines under the first one read as another avatar, and an unloaded pair read as damage.

**Two rows of links, not one.** The person's go under their address and the company's under the
website, because a recipient looking for the person and a recipient looking for the business read
different halves of a signature, and one mixed row makes them guess which icon is which. Both are
edited with the same list in the form. The company's row is seeded from `COMPANY.socials` rather
than fixed by it: that keeps the official set canonical and restorable, while adding the company
somewhere new stays one field on the screen instead of a release.

**Icons come from the host, not from a list.** A social link is just a URL; the icon is
`https://favicon.is/<host>` and the `alt` is read from the same host. A per-network mapping would be
one more table to keep in step, and a link to whatever network exists next year would have no icon.

**Only `http`, `https` and `mailto` are linked.** A signature is pasted into other people's
mailboxes, so `safeUrl` is where a `javascript:` or `data:` href stops. A bare host is read as
`https://`, because that is what people paste; a path is refused rather than prefixed, since
`/foto.webp` is something only this origin can resolve and turning it into a host would put a
permanently broken image in someone's signature. Every value the builder interpolates is escaped,
and the preview is passed through DOMPurify on the way to `dangerouslySetInnerHTML`.

Copying writes the clipboard twice, as `text/html` and as `text/plain`: the rich flavour is what a
mail client pastes as a formatted signature, and the plain one is the source a "paste HTML" settings
box expects. A browser without `ClipboardItem` — or one that refuses the rich write — gets the
source, which still works everywhere.

## The hosted sign-in screen

`api.franciscosolis.cl` is a backend end to end: it answers JSON and redirects and renders no
pages at all. An OAuth flow has exactly one step that must face a human, and `/apps/auth` is it.

The service's `GET /oauth/authorize` validates a request, parks it, and redirects the browser to
`https://franciscosolis.cl/apps/auth?request=<handle>` (its `AUTH_LOGIN_URL`). The screen then:

1. reads `GET /oauth/authorize/<handle>` for the client's name and the providers this deployment
   actually has configured — it hardcodes none of them;
2. posts an address to `POST /oauth/authorize/<handle>/magic-link`, or navigates to a provider's
   `start_url` — unless the read came back already naming an account, in which case it offers to
   [authorize instead](#already-signed-in-authorize-rather-than-authenticate);
3. leaves the rest to the service, which redirects back to the *client's* registered redirect URI
   with a single-use code.

This is what sets it apart from `/auth`, and why it is a separate screen rather than a mode of the
same one. `/auth` signs **this site** in: it mints its own PKCE verifier and `state` and drives the
flow as a client, under this site's client id. `/apps/auth` signs in whichever application parked
the request — which need not be one of this site's — so it holds no session, no client id and no
transaction of its own. The handle in the query string is its entire context, and holding it grants
nothing: a provider still has to authenticate someone, and the code still goes to the client's
registered redirect URI.

Its two `fetch` endpoints are cross-origin by construction; the auth service allows them from any
origin an active client registered (`CORS_PARKED_REQUEST` in its `middleware/cors.ts`).

Two fields on the parked request shape what the screen offers, and both come from the service
rather than from anything this repository configures:

- **`turnstile`** — when the deployment has a Cloudflare Turnstile key pair, the magic-link form
  carries the widget and the submit button stays disabled until it is solved. The token rides the
  `POST` and the service verifies it against Cloudflare before it writes or sends anything, so this
  is a courtesy rather than the check itself: submitting without one earns a `400`. A deployment
  with no key pair says `required: false`, and then the widget's script is never even loaded — the
  fallback for "no bot check configured" is no third-party request at all. `components/auth/turnstile.tsx`
  owns the widget; a token is single-use, so a refused submit resets it before the next attempt.
- **`registration_open`** — whether an address nobody invited would get an account here. It only
  changes the footer: with registration closed the screen says sign-up is invitation only, and with
  it open it says anybody with a working address can create one. The answer to a submitted address
  stays deliberately identical either way, which is what keeps this screen from being a way to ask
  whether an address has an account.

### Already signed in: authorize rather than authenticate

The auth service keeps a session of its own for the browser — a cookie on `api.franciscosolis.cl`,
scoped to `/auth` — opened by whichever provider last authenticated here. A second application
therefore does not need a second sign-in, and this screen is where that shows.

The parked request comes back with `authenticated` when the browser holds one: the account's `sub`,
address, name, picture, the `auth_time` of the sign-in itself, and a `continue_url`. The screen then
names the account and offers a single button, and **that button is a navigation**, never a `fetch`.
It has to be: the cookie proving the session only rides a navigation, which is the same reason this
screen cannot read the session itself — `GET /oauth/authorize/<handle>` is cross-origin, where no
cookie is sent, so the service resolving it server-side and putting the answer on the parked request
is the only way the screen learns anything. The service re-checks the cookie at `continue_url` and
refuses a handle presented by a different browser, so what arrives here is a statement to render and
never a credential to act on.

*Use another account* reveals the providers again — it changes nothing server-side, because signing
in through a provider replaces the session on this browser, which is exactly what changing account
means. The way back is offered while the form is up, since the session is still there. A client that
wants to force the form regardless asks the service for it with `prompt=login` and never this screen;
one that wants no screen at all sends `prompt=none` and is answered with a code or `login_required`
before the browser ever gets here.

A picture is rendered from the account's `picture`, which is either a provider's photo or an avatar an
administrator published — the `Avatar` component falls back to initials for an account with neither,
and for one whose picture fails to load.

**Every** application on this origin goes through it, this site included.
`flow.startAuthorization(returnTo)` mints a PKCE transaction and navigates to
`GET /oauth/authorize`, which is all an application needs to do to sign a user in — the CMS
(see [CMS.md](./CMS.md)) and `/auth` both do exactly that and nothing else.

`/auth` used to be the exception, on the grounds that it is the front-end of this issuer and so
would be redirecting to itself. It is not: `/apps/auth` and `/auth` are two screens with two jobs,
one authenticating whoever parked a request and the other asking for a session of its own. What the
exception actually bought was a second credential form to keep in step — every provider the
deployment gained had to be taught twice, the two screens could drift apart in copy and in
behaviour, and a person signing in to this site answered a form served by the application asking for
the access rather than by the issuer granting it. So `/auth` collects nothing now: it starts the
request, shows a spinner, and offers the attempt again if the navigation never left the browser.
Nothing else about the flow changed — the code still lands on `/auth/callback`, the path this client
is registered under, and the PKCE transaction is still minted on this side.

## How sign-in works

This SPA is a **public OAuth 2.0 client**: it holds no secret and authenticates with PKCE alone.

1. A verifier, its S256 challenge and a `state` are generated and stored as a pending *transaction*.
2. The browser is sent to `GET /oauth/authorize`, which parks the request and takes it to the hosted
   screen; that is `startAuthorization`, and it is the only entry point `flow.ts` still has.
3. The hosted screen authenticates the user — a magic link, or a provider's `start_url` — and the
   browser lands back on the client's registered redirect URI with `?code=…&state=…`.
4. The callback checks `state`, then exchanges the code and the verifier at `POST /oauth/token`.

Which provider ran in step 3 is invisible from here, which is the point: a deployment that gains one
is a change to the service and its hosted screen, not to every front-end that signs in against it.
`flow.ts` used to carry a `startMagicLink` and a `startGoogleSignIn` beside `startAuthorization`;
they are gone with the form that called them.

The service answers the hosted screen's magic-link endpoint with `202` whether or not the address
exists, so it cannot be used to discover which addresses have an account. Sign-up is
invitation-only.

## One stack, several applications

Every application on this origin is its own OAuth client. `createAuthClient(config)` builds one
application's whole stack — its session, its view of the API and its sign-in flow — and
`<AuthProvider client={…}>` puts it in front of a set of routes, so `useAuth()` resolves to whichever
application the subtree belongs to. The site's own client is the default; the CMS nests its own over
`/cms` (see [CMS.md](./CMS.md)).

A client's `storageNamespace` is what keeps the sessions apart: tokens minted for different
applications carry different roles, and signing out of one must not touch the other.

## Token handling

`src/lib/auth/session.ts` owns the token lifecycle outside React, which matters for three reasons:

- **Refresh tokens rotate and are single-use.** Replaying one is treated as theft and revokes the
  whole chain, so every refresh funnels through a single in-flight promise — concurrent callers,
  re-renders and StrictMode's double effects all share one request.
- **Another tab may rotate first.** Tokens are read back from storage on each use and a `storage`
  listener adopts what another tab left behind, rather than overwriting it.
- **A network fault is not a sign-out.** A refresh that never reached the service reports
  `unavailable` and keeps the tokens; only an actual rejection clears the session.

Tokens live in `localStorage`, not `sessionStorage`: a magic link is opened from an email client,
which lands in a *new* tab that would not inherit a per-tab store, and the PKCE verifier has to
survive that hop. The trade-off is that the refresh token is readable by any script on this origin —
the usual cost of a browser-only public client with no back-end of its own to hold it.

## Configuration

Both values are build-time env vars (see `.env.example`), so a preview deployment can point at
another issuer or register under its own client id without a code change:

| Variable                  | Default                              |
| ------------------------- | ------------------------------------ |
| `VITE_AUTH_BASE_URL`      | `https://api.franciscosolis.cl/auth` |
| `VITE_AUTH_CLIENT_ID`     | `franciscosolis-web`                 |
| `VITE_AUTH_REDIRECT_PATH` | `/auth/callback`                     |

`VITE_AUTH_REDIRECT_PATH` exists for the case the CMS is in today: an application registered under a
path the interface has since moved away from. Point it at the registered path and let `router.tsx`
forward that landing to the callback route, rather than moving the route to match the registration.

Each application registers separately; the CMS's own entry is documented in [CMS.md](./CMS.md).

The application has to exist on the auth service with this site's callback among its redirect URIs —
`https://franciscosolis.cl/auth/callback` in production, `http://localhost:5173/auth/callback` for
local work. Register it from **Admin → Applications** (leave *Confidential* off; a browser client
cannot keep a secret).

## Your account

`/account` is one account read through vertical tabs rather than a single column of panels: the
sessions list no longer pushes the rest of the screen out of sight, and — as in the console — each
tab is a route, so a section can be reloaded into, bookmarked and linked to.

| Route | What it is |
| ----- | ---------- |
| `/account` | Profile: the name and locale the account owns, and the avatar it uploads |
| `/account/signature` | The corporate email signature — company accounts only |
| `/account/access` | The roles and permissions held in the application signed in to |
| `/account/identities` | The providers linked to the account |
| `/account/notifications` | Notifications, email and push preferences, and push devices — see [NOTIFICATIONS.md](./NOTIFICATIONS.md) |
| `/account/sessions` | Every device signed in, the browsers holding a sign-in, and the bulk prune |
| `/account/details` | The read-only record: status, verification, dates, user id |

It sits at the top level rather than under `/auth` because that is what it is to a visitor: the page
behind their own avatar, reachable from anywhere on this site. What is left under `/auth` is the
issuer's plumbing — the sign-in hand-off, the callback and the console. `ACCOUNT_ROUTE` in
`lib/auth/config.ts` is where the move is made; the screens themselves still live beside the console
they share their furniture with, under `src/pages/auth/account/`.

### Pruning sessions

The sessions tab carries a **Prune** button beside its refresh, shown only once the account has more
than the one session doing the looking. It opens a dialog of conditions — idle for N days, opened
more than N days ago, from another country, from outside this network, from another device — joined
with *any* or *all* and optionally narrowed to an application or a sign-in method.

Nothing is decided in the browser. Every change re-asks `POST /me/sessions/prune` with `dry_run`, so
the list under the conditions is the service's own answer to "which sessions would go", and the
confirm button sends the identical body without `dry_run`. Two guarantees come from the service and
are worth repeating here, because they are what make the button safe to press: the session doing the
pruning is never among the ones closed — signing out here stays the button on its own row — and a
session missing the field a condition reads (a location a session predating the column never had, an
address the edge could not see) is never matched by that condition, which is why the preview can come
back shorter than the conditions suggest.

### Sessions and browsers are two lists

The tab carries two panels, because the service keeps two things and closing a row in either does
something different. A **session** is one application's: closing it signs that application out and
kills its refresh chain. A **browser** (`GET /me/sso-sessions`) is a sign-in held with the issuer
itself: closing it makes that browser authenticate again before it can authorize anything, and leaves
every application it already opened signed in. One list would have to explain that per row.

Nothing in the browsers list is flagged as the browser doing the looking, and `current` always comes
back false: the service decides that from its cookie, and this list is read with a bearer token,
which no cookie rides along with. `expires_at` is worth showing because it is absolute — using a
browser's sign-in moves `last_seen_at` and never the expiry, so a fortnight after signing in that
browser is asked for a password-less sign-in again whatever it did in between.

`ACCOUNT_SECTIONS` in `account-nav.ts` is the single list the tabs and the router are both built
from, so a section cannot exist in one and be missing from the other. A section may carry an
`offeredTo` test — the signature's is `isCompanyEmail` — and the route guards itself the same way,
so a link to a tab an account is not offered lands on the account instead of on an empty screen.

## The profile picture

A picture is not a field on the profile form any more. It used to be a URL — anybody could point
their avatar at any image anywhere, re-fetched at display time from a host nobody here controls —
and that is what the upload replaces. `AvatarPanel` (`account/avatar-panel.tsx`) posts the file to
`POST /me/avatar` as multipart, the service stores it in an R2 bucket with no public access, and
**nothing changes on screen**: the account keeps the picture it had, the panel says the new one is
waiting, and an administrator publishes it from
[the review queue](#the-administration-console). `PATCH /me` refuses a `picture` field outright, so
this is the only way in.

Three consequences worth knowing. The upload answers `202`, not `200` — the request succeeded and
the picture did not become anything yet, which is exactly what the panel says. A refusal comes back
with the reviewer's reason on `GET /me/avatar`, so the person is told why rather than left to
re-upload the same file. And removing works on both halves at once: a pending upload is cancelled
and a published avatar is taken off the account, while a picture that came from a sign-in provider —
a Google photo — is deliberately left alone, since it was never uploaded here.

The preview before sending is an object URL of the local file, revoked as soon as it is replaced or
sent; an unreleased one keeps the whole file alive in the tab for as long as the page is open.

## The administration console

`/auth/admin` is a console with a section per resource, not one screen with tabs. Every section is a
route and every record has an address, so a filtered list or one account is a URL somebody can send:

| Route | What it is |
| ----- | ---------- |
| `/auth/admin` | Overview: what needs attention, what you hold, what just happened |
| `/auth/admin/users`, `/users/:id` | Accounts, and one account's status, roles, providers and sessions |
| `/auth/admin/avatars` | Uploaded profile pictures waiting for a decision, and the ones already decided |
| `/auth/admin/sessions` | Who is signed in right now, across every account and application |
| `/auth/admin/invitations` | The allowlist sign-up is gated on |
| `/auth/admin/applications`, `/applications/new`, `/applications/:id` | Client applications, their URLs, their OAuth configuration and their secrets |
| `/auth/admin/roles`, `/roles/new`, `/roles/:id` | Roles, global and per application |
| `/auth/admin/permissions` | The permission catalog |
| `/auth/admin/audit` | The authentication audit trail |
| `/auth/admin/settings` | The service's own settings — today, whether registration is open |

The `?tab=` links the previous single-screen console used are forwarded to the matching route, so a
bookmark still lands where it meant to.

The avatars section is the moderation step the account screen waits on, and it reads as one: a
pending upload has no URL anywhere, so the API inlines the bytes as a `preview` data URL and the
queue renders that. `avatars:read` opens the screen and `avatars:review` is what the two buttons
need, so an account can be given the queue to look at without being given the decision. A user's
page links into it filtered by `?user_id=`, rather than carrying a review panel of its own — one
place to make the decision is one place to keep in step with the service.

The settings section is one checkbox, and it writes straight through rather than sitting behind a
Save button: one box, one `PATCH`, and the service answers with the whole resulting set, which is
what the screen then shows. So what is ticked is always what the service holds rather than what this
browser last clicked, and a refused write reverts to the answer instead of to an optimistic guess.
`settings:read` opens the screen and `settings:write` is what the box needs, the same split the
avatar queue uses. What the copy has to be honest about is the blast radius: opening registration
only changes what happens to an address that has *no* account yet — invitations keep working either
way, nobody's account is touched, and closing it again refuses the next sign-up, including a
sign-in link emailed while it was open.

### Signed in is not admitted

Two questions are asked, and both are answered by the API:

- **Is there a live session?** `RequireAuth`, above the whole subtree.
- **Does this account belong in the console?** `GET /auth/admin/me`, asked **once** by
  `AdminProvider`. It answers `403` for an account holding no administration permission, and that
  is the one no-access screen the console shows — instead of eight sections each failing on their
  own. It also drives the navigation: a section whose list endpoint needs a permission the account
  does not hold is not offered, because a menu of dead ends is worse than a shorter menu.

Nothing is *enforced* client-side. Every endpoint re-checks the caller, and because permissions are
re-read from the database on each request rather than taken from the token, the API can refuse
something the navigation offered a moment ago. A *per-endpoint* `403` is therefore still possible —
an account that may read users but not the audit trail — and each section renders its own no-access
state where it happens.

Since roles are minted into the access token, a grant or a revocation reaches the holder's own
interface only once their token refreshes. The API itself is never out of date.

### What the console will not do

Three things are deliberately absent, and all three are the API being the authority rather than an
oversight:

- **No profile editing.** An administrator decides access — status, roles, sessions. The name
  belongs to the person, and so does the picture: what the console decides about an avatar is
  whether it may be published, never what it is.
- **No deleting an application or an account.** An application is deactivated with `is_active` and
  an account with `status`; the destructive versions live in the auth repo's operator scripts.
- **No totals.** Every list endpoint pages with `limit`/`offset` and reports no count, so a figure
  on the overview could only be the size of one page dressed up as a total.

## Layout of the code

Everything below is per-application: each module exports a factory, plus the instance the site's own
`/auth` screens use.

```
src/lib/auth/
  config.ts         an application's client id, routes and storage namespace; the return_to guard
  types.ts          the API's shapes; admin lists only guarantee a few keys, so extras are optional
  pkce.ts           verifier, challenge and state
  storage.ts        token and pending-transaction persistence, namespaced per application
  session.ts        token lifecycle, rotation and cross-tab sync (no React)
  client.ts         fetch wrapper: envelope unwrapping, 401-refresh-retry, typed errors
  api.ts            one function per endpoint
  flow.ts           the sign-in flows end to end
  auth-client.ts    composes the above into one application's client
  auth-provider.tsx restores the session and keeps context in step with the token store
  useResource.ts    load-one-resource hook with abort, retry and 403 reporting
  authorize.ts      the parked-request endpoints behind /apps/auth — no client, no session
  admin-context.ts / admin-provider.tsx   the one /admin/me answer the console is gated on,
                    plus the `can(permission)` the navigation is built from
src/components/auth/ the sign-in and callback panels, shared by every application on this site;
                     turnstile.tsx is the bot-check widget the hosted screen renders when the
                     service asks for one — the only third-party script this application loads
src/pages/auth/      the screens, split out of the main bundle and fetched on demand;
                     authorize.tsx is the hosted screen and belongs to no application here
  account/           the account: account-layout.tsx holds the shell and the tab column,
                     account-nav.ts the sections, and each panel is one tab, one chunk;
                     prune-dialog.tsx is the sessions tab's bulk close, previewed by dry run,
                     and sso-sessions-panel.tsx is the browsers list beside it
    signature/       the corporate email signature: the HTML builder and the form that drives it
  admin/             the console: components/ holds its shell, navigation, gate and no-access
                     screen; overview.tsx, users/, sessions/, invitations/, applications/,
                     roles/, permissions/, avatars/, audit/ and settings/ are one section each,
                     one chunk each
```

The console is built from `src/components/admin/` and `src/lib/admin/` — the data table, paging,
confirmation dialog, toasts, page header, tag input and the rest — which the CMS renders too. They
were written for the CMS and were lifted out of it rather than copied, so the two consoles cannot
drift apart.

### Translations

The console's copy lives in the `auth_admin` namespace, which is deliberately **not** preloaded in
`main.tsx`: a visitor reading the portfolio should never fetch it. A screen loads it by naming it,
`useTranslation(["auth_admin", "admin"])`, which also brings in `admin` — the namespace holding the
strings the shared components render, shared with the CMS for the same reason the components are.
