# CMS interface

The screens under `/cms` are the front-end of the `franciscosolis-cms` module of the
[API](https://api.franciscosolis.cl/openapi.json). Everything the module exposes is here: the
content collections, the legal documents, the email templates and their delivery log, and the audit
trail — behind a sign-in of its own.

| Route                          | What it is                                                       |
| ------------------------------ | ---------------------------------------------------------------- |
| `/cms`                         | Overview: what needs attention, where to jump back in, who you are |
| `/cms/sign-in`                 | Hands the visitor to the SSO service; collects nothing itself      |
| `/cms/callback`                | Where both providers return; redeems the authorization code       |
| `/cms/content/:collection`     | One collection's entries — filter, reorder, create                |
| `/cms/content/:collection/new` | A new entry                                                       |
| `/cms/content/:collection/:id` | Editing one entry                                                 |
| `/cms/legal`                   | The legal documents the CMS module holds                          |
| `/cms/legal/new`, `/cms/legal/:id` | Writing one                                                   |
| `/cms/email/templates`         | Reusable messages, referenced by slug when sending                |
| `/cms/email/templates/new`, `/cms/email/templates/:id` | Editing one                               |
| `/cms/email/messages`          | The delivery log                                                  |
| `/cms/email/messages/new`      | Sending a message                                                 |
| `/cms/email/messages/:id`      | One message: what was sent, and what happened to it               |
| `/cms/audit`                   | The record of the writes the CMS made                             |

One more section lives under `/cms` without belonging to the CMS module: `/cms/pages`, which edits
the standalone application pages served by a different Worker. It is here because that service
accepts the CMS's own client id as its audience, so it reuses this session and this shell rather
than asking an editor to sign in a second time for a second console. See
[APPLICATIONS.md](./APPLICATIONS.md).

Everything except `sign-in` and `callback` needs a session; anonymous visitors are sent to
`/cms/sign-in` with a `return_to` so the flow resumes where they were headed. A `return_to` pointing
outside `/cms` is dropped.

`/cms/sign-in` is not a sign-in screen. It starts an authorization code request at the auth
service's `GET /oauth/authorize` and hands the browser over; the credentials are collected by the
hosted screen at `/apps/auth`, which is the one page in the whole flow that faces a human. See
*Single sign-on, not a second sign-in* below.

The interface used to live at `/apps/cms`. That path still resolves — `router.tsx` forwards the whole
sub-path, query string included — and the sign-in flow depends on it: the application is still
registered under `<origin>/apps/cms/callback`, so that is the redirect URI the CMS asks for and the
path the service returns the browser to. The forward carries the `code` and `state` on to
`/cms/callback`, which redeems them. See *A client application of its own* below.

## Single sign-on, not a second sign-in

The CMS used to ask for the credentials itself: the same provider picker and magic-link form
`/auth` rendered at the time, pointed at the CMS's client id. It worked, and it was the wrong
shape — a second sign-in screen for one identity provider is the thing single sign-on exists to
avoid. Every provider the deployment gained had to be taught to it as well, and the application
asking for the access was also the one serving the credential form.

It is now an ordinary relying party. `/cms/sign-in` mints the PKCE transaction and navigates to
`GET /oauth/authorize` with `response_type=code`, its client id, its registered redirect URI, the
challenge and the `state`; the service parks the request and takes the browser to its hosted screen,
which offers whichever providers the deployment actually has configured. What comes back is
unchanged — the code lands on the registered redirect URI and `/cms/callback` redeems it against the
verifier stored on this side — so nothing downstream of the callback knows the difference.

Two consequences worth keeping in mind:

- **A provider added on the service appears in the CMS for free.** The picker is the service's, not
  this application's.
- **The CMS's session is still its own.** The hosted screen holds no session; it authenticates
  somebody and the code goes to the client that parked the request. Signing in to the CMS still
  does not sign you in to the site, and vice versa.

`startAuthorization` in `src/lib/auth/flow.ts` is the shared machinery, and the site's own `/auth`
has since been moved onto it the same way — it is now the only entry point that module has. See
[AUTH.md](./AUTH.md).

## A client application of its own

The CMS signs in at the same issuer as the rest of the site, but under its own client id:

| | Site | CMS |
| --- | --- | --- |
| Client id | `franciscosolis-web` | `franciscosolis-cms` |
| Redirect URI (registered) | `<origin>/auth/callback` | `<origin>/apps/cms/callback` |
| Callback route (in the app) | `/auth/callback` | `/cms/callback` |
| Storage namespace | `fs.auth.*` | `fs.cms.*` |

The CMS's two rows differ because the application was never re-registered after the interface moved
off `/apps/cms`, and the authorization server matches redirect URIs by exact string: asking for
`<origin>/cms/callback` is refused with `400 redirect_uri is not registered for this client` at
every entry point — magic link, Google and `/oauth/authorize` alike — *before* any redirect this
site could forward. `CMS_REDIRECT_PATH` in `src/lib/cms/config.ts` therefore quotes the registered
path, and `redirectUri()` derives the value from that config rather than from the address bar, so
the token exchange quotes the same string the flow started with, as RFC 6749 §4.1.3 requires.

To retire the extra hop: add `<origin>/cms/callback` to the application's redirect URIs under
**Admin → Applications**, then set `VITE_CMS_REDIRECT_PATH=/cms/callback` (or change the default in
`src/lib/cms/config.ts`). Do not remove the old URI until every deployment has been rebuilt.

That is what makes the access token come back minted **for the CMS**, carrying the roles the account
holds in this application — which is exactly what `/cms/admin/*` checks. It also means the two
sessions are independent: signing in to the site does not sign you in to the CMS, and signing out of
one leaves the other alone.

Mechanically, `<AuthProvider client={cmsAuth}>` wraps the `/cms` subtree, so `useAuth()` inside the
CMS resolves to the CMS session while the rest of the site keeps its own. Everything below that —
the PKCE flow, token rotation, cross-tab sync — is the shared machinery documented in
[AUTH.md](./AUTH.md).

## Signed in is not admitted

Two different questions are asked, and both are answered by the API:

- **Is there a live session?** `GET /auth/me` with the CMS's token. Restoring it is what the
  provider does on load; failing it sends the visitor back to sign-in.
- **Is this account allowed in here?** `GET /cms/admin/me`. It answers `403` for an account with no
  role in the CMS.

The second question is asked **once**, by `CmsProvider`, above the whole signed-in subtree — so a
no-access account meets one explicit screen with a sign-out button instead of a dozen panels each
failing on their own. The fix is usually to come back as someone else, or to be granted the role and
sign in again so a fresh token carries it.

A *per-endpoint* 403 is a different thing and still possible: a role that may edit content but not
read the audit log. Those are handled where they happen, as a no-access state on that panel.

Nothing is gated on roles client-side. They are shown, because knowing what you hold is useful, but
every CMS endpoint re-checks the caller — and since roles are minted into the access token, a change
can take up to the token's lifetime to appear in the interface. The API is always the authority.

## What the API does not promise

Two constraints shaped most of the screens, and both are worth knowing before changing them.

**The list endpoints guarantee very little.** `GET /cms/admin/content/{collection}` promises only
`id`, `collection`, `slug`, `title` and `status`; the audit log promises `id`, `event` and
`created_at`. The service sends more in practice, so `src/lib/cms/types.ts` types the extras
optional and every view renders them defensively. A field the service stops sending degrades a row;
it does not break a screen.

**No list endpoint returns a total.** Paging is `limit`/`offset` with nothing to page against, so
`Pagination` offers "next" exactly when a page came back full, and the overview refuses to present a
derived figure as a total. A count taken from one page is a floor, and showing it as a total would
be a lie the interface repeats every morning.

## Editing

- **Long-form text** — content bodies and legal documents — is markdown, edited with a write/preview
  editor. The source is never round-tripped through HTML, so what the API stores is exactly what was
  typed. The preview is sanitized: markdown passes raw HTML through by design, and a preview shows
  what *another* editor wrote as often as your own.
  The site's own `/legal` page reads this section: its tabs are `GET /cms/legal` and its text is
  the Markdown written here, split at its `##` headings for the terminal's reveal. Publishing a
  third document — a cookie policy, say — puts a third tab on that page with no deploy.

- **Email bodies** are HTML, not markdown, and are previewed inside a sandboxed `<iframe>`. A
  template is written to be rendered by someone else's mail client; the CMS must not be the place
  where it executes.
- **The `data` field** of a content entry is edited as JSON rather than through a form. It looks
  free-form — the OpenAPI schema types it as a bare object — but the endpoint's own description says
  each collection validates it against a schema and rejects a field it does not know. That schema is
  not exposed to the client, so a typed form here could only be a guess that drifts; the JSON box
  lets the service be the one that says no, and its message reaches the editor. Note also that a
  `PATCH` **replaces `data` wholesale rather than merging it**, so the interface always sends the
  complete object.
- **Order** is data. `POST /content/{collection}/reorder` takes the whole new order in one call, so
  dragging changes local state and an explicit save commits it — one write per session of nudging
  rather than one per nudge.
- **Deletes** all go through a confirmation that names the record. There is no undo on this API.
- **Translations live on the field they translate.** Only prose is translatable — `title`,
  `subtitle`, `summary` and `body` on an entry, and the first, third and fourth of those on a legal
  page — while slugs, ordering, dates, links, tags and `data` are the same fact in every language.
  So a translatable field carries a translate icon *inside* its control, and that icon opens a
  dialog holding nothing but that one field in the other languages, with the original above it.

  It used to be a panel at the foot of the form, and the reason it moved is what that panel was
  becoming: an application page has five translatable fields and the service publishes two
  languages, so the panel was ten more boxes below the fold, none of them beside the text they
  translate. The icon says how much is done without being opened, and the page stops growing when a
  third language lands.

  The record's own fields hold the default locale — `GET /cms/` reports which that is and which
  others the service publishes — and the dialog writes the overrides on top of it. A field left
  blank is not stored and the API falls back to the source text for that field alone, so a partly
  translated entry is a valid state rather than a half-saved one. Like `data`, the map is
  **replaced wholesale** on a `PATCH`, so the interface always sends every locale it means to keep.

- **A translation can be drafted by Workers AI**, from the same dialog: `POST /cms/admin/translate`
  answers with a draft of one field in one language and *writes nothing*, so the draft is edited and
  saved through the ordinary `PATCH` that saves every other override. Three things follow, and they
  are why it works this way. A model outage cannot corrupt a record. Nothing machine-translated is
  ever published without somebody having read it, because publishing is a separate request a human
  makes. And a failed call answers `translation: null` with a `200`, so the cost of an outage is a
  button that produced nothing.

  The dialog also carries a **"translate this field" switch**, off for text that is the same string
  in every language — an application's name, a product's — where the useful answer is "leave it
  alone" and a draft would be actively wrong. It is not stored anywhere: "not translated" and "no
  override written" are the same state to the API, which is what lets it be a switch rather than a
  column.

  A field longer than the service will accept (`translation.max_source_chars` on `GET /cms/`) offers
  no draft and says so — a 100 000-character legal document is not translated in one model call, and
  silently truncating one would be worse than declining.

## Configuration

| Variable                 | Default                             |
| ------------------------ | ----------------------------------- |
| `VITE_CMS_BASE_URL`      | `https://api.franciscosolis.cl/cms` |
| `VITE_CMS_CLIENT_ID`     | `franciscosolis-cms`                |
| `VITE_CMS_REDIRECT_PATH` | `/apps/cms/callback`                |

The application has to exist on the auth service with this site's CMS callback among its redirect
URIs. What is registered today is `https://franciscosolis.cl/apps/cms/callback` in production and
`http://localhost:5173/apps/cms/callback` for local work — the pre-move paths, which is why
`VITE_CMS_REDIRECT_PATH` defaults to the legacy one. Register from **Admin → Applications** in the
auth interface (leave *Confidential* off; a browser client cannot keep a secret), then grant the
editor accounts a role scoped to it.

The auth API answers CORS for an exact allowlist — `https://franciscosolis.cl` and
`http://localhost:5173` — so a dev server on the default Vite port can talk to it as is. A dev
server on any other port needs its origin added on the service first.

## Layout of the code

```
src/lib/cms/
  config.ts        the CMS API base, the client id, and every route of the interface
  types.ts         the shapes the CMS API answers with
  client.ts        the CMS auth client and one function per endpoint
  cms-context.ts   the editor and the collections, shared by every screen
  cms-provider.tsx loads them once and answers the "admitted?" question above the subtree
  json.ts          reading and writing the free-form `data` object
  content.ts       the *public* half of the same API — no auth, no session — which is what the
                   landing page and /legal render themselves from
  landing.ts       what the landing page knows about the CMS's shape: the toolbox categories it
                   can label, and how a timeline entry's period is derived from its dates

src/lib/prose/
  markdown.ts      the sanitized markdown renderer and the prose styles for a preview
  format.ts        the reading-time estimate the markdown editor's footer shows
  types.ts         the envelope every service stores a translation in
  translations.ts  which control a field gets, and what writing one language does to the map
  translation-service.ts  the context a section answers "which languages, and can you draft one?" in

src/components/prose/
  markdown-editor.tsx   the write/preview editor behind every long-form field on this site
  translatable-field.tsx a field that carries its own translations: the icon inside the control
  translation-modal.tsx  what the icon opens — that one field in the other languages

src/pages/cms/
  cms-routes.tsx   the subtree, its own AuthProvider, and the one gate every screen shares
  lazy-screens.tsx every screen, split out of the main bundle and fetched on demand
  components/      the shell, its navigation, the gate and the CMS's wiring of the shared
                   translation controls — what is specific to the CMS. The prose editors themselves
                   are in `src/components/prose/`, shared with the standalone app pages and the
                   support console: a component that reaches into one section's context is that
                   section's component, and the help article editor throwing
                   `useCms must be used inside <CmsProvider>` is what that costs. The primitives
                   the sections are built from live in
                   `src/components/admin/` and `src/lib/admin/`, shared with the auth console:
                   data table, paging, confirm dialog, JSON editor, tag input, sortable list,
                   status badge, empty state, page header, toasts, useMutation and the form helpers
  overview.tsx     the landing
  content/         the collections
  legal/           the legal documents
  email/           templates, the delivery log and the compose screen
  audit/           the audit log
```

### Translations

The strings the shared components render live in the `admin` namespace — shared with the auth
console, for the same reason the components are — the prose editors' own copy (the markdown
toolbar, the language names) in `prose`, shared with every section that edits prose, and the
shell's copy in `cms`. The site
preloads both. Each section keeps its
own — `cms_overview`, `cms_content`, `cms_legal`, `cms_templates`, `cms_emails`, `cms_audit` — and
those are deliberately **not** in the preload list in `main.tsx`: a visitor reading the portfolio
should never fetch the CMS's copy. A screen loads its namespace by naming it,
`useTranslation(["cms_content", "cms"])`, which is also what makes the shared keys available
alongside its own.

One app-wide setting matters here: `main.tsx` initialises i18next with
`interpolation: {escapeValue: false}`. React already escapes every string it renders as a text node,
so leaving i18next's own escaping on double-encodes the value — an entry titled `O'Brien's` reaches
the screen as `O&#39;Brien&#39;s`, and a `JSON.parse` message, which is mostly quotes, becomes
unreadable. This is the configuration i18next documents for React, and it is only safe because
nothing here feeds a translated string to `dangerouslySetInnerHTML` or `<Trans>`. If that ever
changes, the escaping has to come back with it.

## The landing page reads this API too

Everything the portfolio shows — the projects, the toolbox, the timeline, both legal documents —
comes from the CMS's **public** routes, which need no session and only ever return `published`
entries. `src/lib/cms/content.ts` is that client, deliberately separate from `client.ts`: importing
the editorial one builds the CMS's whole auth stack, and a visitor reading the portfolio has no
business holding a second session to see a list of projects.

| Section | Reads |
| --- | --- |
| Projects | `GET /content/projects`, split on `featured` into the carousel and the grid |
| Toolbox | `GET /content/skills`, folded by `data.category` and then by `subtitle` |
| Timeline | `GET /content/{experience,education,certifications}`, merged and sorted by date |
| `/legal` | `GET /legal` for the tabs, `GET /legal/{slug}` for the Markdown |

Three things follow from that, and they are the parts worth not re-deriving:

- **The language is a query parameter.** Every read carries `?locale=`, taken from the
  accessibility preferences rather than from i18next directly — that is the value the site persists
  and mirrors onto `<html lang>`, so the copy the API serves and the copy i18next serves can never
  disagree about which language is on screen. The service resolves the overrides and answers with
  plain fields plus a `locale` saying which language actually came back; `/legal` reads it to label
  an untranslated document instead of implying it is not one.
- **What each section knows about the content model lives in `landing.ts`,** and it is always a
  filter, never a source. A skill whose `data.category` this page has no icon for is skipped rather
  than rendered as an unnamed card, so the CMS can grow a category without the site breaking on it.
  The timeline's period labels are derived from `started_at`/`ended_at` there too, which is why
  "2023 — Present" becomes "2023 — 2026" in both languages the day an editor sets an end date.
- **A section that fails says so, alone.** The page used to be static, so it could not fail;
  reading from an API buys editable content at the cost of that. Each section renders placeholder
  cards while it loads — so the page does not reflow under the reader as each one lands — and one
  line with a retry when it does not. A failure is scoped to its own section: the three read
  different collections, and one being unreachable is no reason to blank the other two.

`/legal` is lazy-loaded from `router.tsx` for a related reason: rendering the CMS's Markdown pulls
in a parser and a sanitizer, around 25 kB gzipped that every visitor of the landing page would
otherwise download to read a page most of them never open.
