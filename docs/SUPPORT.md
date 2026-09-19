# Support

Two interfaces over one service. `/help` and `/tickets/<reference>` are for whoever needs help;
`/support` is where the team answers. Both talk to [`apps/support`](https://github.com/Im-Fran/api.franciscosolis.cl/tree/dev/apps/support)
through `https://api.franciscosolis.cl/support`.

## The public half

| Route | What it is |
| --- | --- |
| `/help` | Search box, the sections, and the articles worth reading first |
| `/help/search?q=` | Results, with the matched words highlighted |
| `/help/c/:slug` | One section and its articles |
| `/help/a/:slug` | One article |
| `/help/new` | The ticket form |
| `/tickets/:reference` | One ticket and its conversation |
| `/account/tickets` | Tickets belonging to the signed-in account |

All of it sits **outside every gate**, and that is the point rather than an oversight: somebody who
cannot sign in is exactly the person most likely to need support, so requiring an account here would
lock out the hardest cases. When a session does happen to exist, `src/lib/support/content.ts` sends
its token anyway — it is built over the *site's* `webAuth` session — which is what links a ticket to
an account on the way in.

`/help` carries a header of its own (`src/pages/help/components/help-header.tsx`), mounted on the
layout route rather than on each screen: the lockup and the section's name on the left, the reader's
own tickets and their account on the right. It is the same "say which place this is" the account and
the console already do, and the right-hand half follows the gate rule above — the two links are
offered when there is a session and replaced by a single sign-in link when there is not. That link
points at `/account/tickets`, whose own gate carries the visitor through the hand-off and back.

### The secret in the link

A support email links to `…/tickets/FS-1042#k=<secret>`. The secret rides in the **fragment**, which
is the one part of a URL a browser never sends to a server: it stays out of access logs, out of the
`Referer` header of every outbound link the page renders, and out of anything sitting between the
browser and the origin.

That guarantee holds only while the fragment is in the fragment. So `captureTicketToken` runs in a
`useLayoutEffect` at the top of the ticket screen, **before the first paint**: it reads the secret,
puts it in `sessionStorage`, and rewrites the address bar without it using `replaceState` — not by
assigning `location.hash`, which would leave the old entry one Back press away. From then on the
secret travels as an `Authorization: Ticket <secret>` header, which is why `src/lib/auth/client.ts`
grew a `headers` option.

### Why a missing ticket and somebody else's ticket look the same

`GET /tickets/:reference` answers `404` in both cases, never `403`. Ticket numbers are short and
sequential, so a `403` would turn the reference space into an oracle that enumerates every support
request ever filed — and the fact that a given person filed one. The screen therefore cannot tell
the two apart either, and offers the thing that helps in both: a fresh link emailed to the address
the ticket was opened with. `POST /tickets/resend-link` always answers `202` for the same reason.

### Search snippets

`/help/search` is the only endpoint in this API that returns markup: SQLite's `snippet()` wraps the
matched terms in `<mark>`. It is generated from stored article text rather than from the query, but
it is still the one string on the page that reaches `dangerouslySetInnerHTML`, so `HelpSnippet`
sanitises it with DOMPurify down to exactly that one tag and no attributes.

## The console

`/support`, behind its own `AuthProvider`. Sections: the inbox, one ticket, labels, help articles and
sections, sent mail and the audit trail.

It is a **separate OAuth client** (`franciscosolis-support`, storage namespace `fs.support`), unlike
the standalone app pages — which live inside the CMS console precisely because their editor *is* the
CMS editor. The reason is assignment: a ticket goes to a person, and "a person" only means something
if there is a defined set of them. The auth service resolves roles per client application, so a
client id of its own is what produces that set. It also means a support agent is not automatically
able to publish the landing page.

Two consequences worth knowing:

- Three sessions can be live in one browser — the site's, the CMS's and support's — and none of them
  knows about the others. Signing out of one leaves the rest alone.
- Permissions ride in the access token, so being *granted* `support:agent` changes nothing until a
  fresh token is minted. The no-access screen says so.

### Replies and notes

The composer has two modes and they look different on purpose. A **reply** goes to everybody on the
ticket and starts the thirty-minute clock; a **note** never leaves the team and sends nothing.
Getting that wrong is not a glitch — it is telling a customer what you thought of their email.

### The assistant

"Draft with AI" searches the published help centre and writes a reply from what it finds. It puts the
draft **in the composer** and stops. There is no send button in that panel and there must not be one:
the model answers only from retrieved articles and its citations are checked against what was
actually retrieved, but neither of those makes it right about a particular person's situation. It
also lists what it read, because an answer whose sources are visible can be checked in ten seconds
and one without them has to be taken on faith.

It needs `support:admin`, as do the label catalogue and the help centre. `administrative` in
`support-nav.ts` filters the *menu*, not the access — every one of those routes checks the permission
itself and the API checks it again. Hiding them is only so an agent is not offered four entries that
all answer 403.

## Files

```
src/lib/support/
  config.ts            base URL, both route maps, the console's AuthClientConfig
  types.ts             the shapes the API answers with
  content.ts           the public API, over the site's session
  client.ts            the console's API, over its own session
  ticket-token.ts      capturing the secret out of the fragment
  support-provider.tsx one /admin/me for the whole console
src/components/support/
  ticket-timeline.tsx  shared by the public thread and the console
  help-snippet.tsx     the sanitised <mark>
  ticket-status-badge.tsx
src/pages/help/        the public screens, and the header they share
src/pages/support/     the console
```

The help centre's editors are the support console's own. `article-editor.tsx` writes prose in two
languages, which is the job the CMS does as well, so the markdown editor and the translation
controls are **shared components** in `src/components/prose/` (with `src/lib/prose/` behind them)
and each section wires them to its own service:
`src/pages/support/components/translations-provider.tsx` answers with the locales `SupportProvider`
read from `/support/status`, and with the call that drafts a translation, exactly as the CMS's
wrapper answers with the CMS's.

Sharing them is not the same as borrowing them, and the difference was a crash: the article editor
used to import the CMS's copies directly, which made `/support/help/new` throw
`useCms must be used inside <CmsProvider>` — no CMS provider is mounted anywhere under `/support`,
and none ever should be. A component that reads one section's context belongs to that section;
anything two sections need takes what it needs as a parameter and moves somewhere neither owns.

Translations live in `src/translations/{en,es}/support.json` (public) and `support_agent.json`
(console), plus `prose.json` for the shared editors' own chrome — the markdown toolbar and the
language names — which the console loads alongside its own namespace. The first is preloaded in `main.tsx` because the help centre is linked from the site; the
second lazy-loads with the console.

## Configuration

```
VITE_SUPPORT_BASE_URL=https://api.franciscosolis.cl/support
VITE_SUPPORT_CLIENT_ID=franciscosolis-support
# VITE_SUPPORT_REDIRECT_PATH=/support/callback
```

The redirect path matches the route this site serves, which is the whole point: the auth service
compares redirect URIs byte for byte. It is registered by
`apps/auth/migrations/0010_support_application.sql`, and a test over there fails if the two ever
drift apart — unlike the CMS, which is still registered under its pre-move `/apps/cms/callback` and
needs the extra hop `router.tsx` forwards.
