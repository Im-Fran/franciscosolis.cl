# Standalone application pages

`/application/<slug>` is a product page for one of the applications built here, and every one of
them is the same page: a banner, a row of tabs under it, and the content behind them. The content
comes from the `pages` module of the [API](https://api.franciscosolis.cl/openapi.json); the editor
for it is a section of the CMS interface at `/cms/pages`.

| Route                                    | What it is                                              |
| ---------------------------------------- | ------------------------------------------------------- |
| `/application/:slug`                     | **Overview** — one centred Markdown document            |
| `/application/:slug/updates`             | **Updates** — the changelog, newest release first       |
| `/application/:slug/wiki`                | **Wiki** — redirects to the first page                  |
| `/application/:slug/wiki/:page`          | One wiki page, with the sidebar beside it               |
| `/application/:slug/contact`             | **Contact** — how to reach support                      |

Most of it needs no session: the service only ever answers with `published` rows, which is the
boundary a public page needs. The exception is money — see *Paying for an application* below. A slug that is not published is the site's own 404 — from a visitor's
side there is no difference between an application that was never created and one that is still a
draft, and the service is deliberately unable to tell them apart either.

## Why the tabs are a registry and not a layout

The whole point of this section is that a dozen applications read as one product family rather than
a dozen sites. So the tab set is fixed — Overview, Updates, Wiki, Contact — and what an application
chooses is *which of them it turns on*, in what order, plus its artwork and its accent. There is no
per-page layout field, and adding one would end the arrangement: the moment a page can describe its
own shape, the set of pages stops being a house standard.

Overview is not optional. A page without it is a banner and a row of links, and every other tab is
something a visitor reaches *after* deciding the application is for them.

The tab list comes from the service (`GET /pages/`) rather than from a list kept here, so the day a
fifth kind of tab lands on the Worker the editor offers it without a release on this side. What this
interface does keep is how to *draw* each one — an icon and a route — and an unknown key is simply
not rendered.

## Each tab is a route

A tab is a URL, not a piece of component state. Linking somebody to a changelog entry or to one wiki
page is the normal case for a product page, and a tab bar that cannot be copied, bookmarked or
middle-clicked is a worse version of the navigation it stands in for. The wiki carries a second
segment for the open page for the same reason.

`ApplicationLayout` loads the application once and puts it on a context; the four tabs are small
components that only know about their own content. Four screens each fetching the same row would
reload the banner on every tab change.

A tab an application did not turn on is the wrong address rather than an error, so `RequireTab`
redirects to the Overview — which every application has — instead of rendering an empty panel under
a tab bar the tab is not even on.

## The wiki

Two requests rather than one: the sidebar is the whole tree without bodies, and the open page is
fetched on its own. That keeps switching pages from re-fetching the navigation, and keeps a wiki of
forty pages from shipping forty Markdown documents to show one.

The tree is two levels deep, enforced by the service, which is what makes a flat list with one
indent legible rather than a puzzle. The sidebar sits on the right, and the article comes *first* in
the markup — so the visual order and the reading order agree, on a narrow screen and in a screen
reader alike.

`/wiki` with no page redirects to the first entry rather than showing an index. A wiki's first page
*is* its index — that is what editors write there — and a second landing screen listing the same
links as the sidebar beside it is a page nobody reads twice.

## Paying for an application

An application is `free`, `donation` (pago opcional) or `paid`, and the service decides which. What
this interface does with that answer is ask one question — `GET /applications/:slug/access` — and
obey it.

`PurchaseProvider` asks it once for the whole page. The price sits under the banner, the offer is one
dialog, and every Download button calls the same `requestDownload`, which is where "does this person
have to be offered a payment first" is applied. A button that decided for itself would be a button
that can be wrong on its own, and the one that goes wrong is the one that gives a paid build away.
While the answer is still loading the offer is shown: interrupting somebody who already paid costs
them a click, and skipping it for somebody who has not costs the price of the application.

Two rules come from the service and are not re-decided here. A non-payer sees the offer **every
time** — there is no "don't show this again", because that is how a paid application quietly becomes
free for whoever dismissed it once. And for an optional payment, declining is a button of its own
with the reason written beside it: an opt-out that has to be hunted for is not an opt-out.

Paying needs an account. The purchase is attached to one, so somebody signed out is sent through the
site's own sign-in and comes back to the same page — which is also why buying an application creates
an SSO account: it is the ordinary magic-link sign-in happening before checkout, not something the
payments service does.

Coming back from MercadoPago, the page polls its own `access` rather than reading the status the
provider put in the query string. That status is the payer's browser talking; the entitlement is the
webhook's, and it arrives on its own schedule — so the page says "confirming" until our own service
agrees, and cleans the query string either way.

## Downloads

The builds live on the **Updates** tab, because a build belongs to the release that published it.
That is what makes the archive of old versions a consequence of the changelog instead of a second
list somebody has to keep in step with it.

Nothing is ever linked straight to storage. A row in the list is a file, not a URL; pressing it mints
a one-off link that carries who asked and whether they paid. For somebody who has paid it works at
once. For everybody else it is valid five seconds from now — the wait is `nbf` on the link itself, so
the countdown on screen is counting to something real rather than performing a delay that could be
skipped from the console. Once the link works it is also rendered as a plain anchor, because a
browser that refuses a programmatic click must not be a dead end.

The file list of each release loads when that entry scrolls into view. A changelog of twenty releases
would otherwise open twenty requests to draw buttons nobody has scrolled to.

`/account/purchases` is the other end of it: what this account has paid for, and what it has
downloaded. Both are read-only, as the service is — a payment's status belongs to the provider and
arrives over its webhook. Downloads taken without signing in carry no account and are not listed,
which is what makes a free build free.

## The language

Every read carries `?locale=`, taken from the accessibility preferences rather than from i18next
directly — the same rule as the landing page, and for the same reason: that is the value the site
persists and mirrors onto `<html lang>`. The service resolves the overrides and answers with plain
fields plus a `locale` saying which language actually came back, which is what the "this page has
not been translated yet" line under the banner reads.

Only prose is translated. Which tabs a page has, its slug, a release's version number and a wiki
page's ordering are the same fact in every language.

## The editor

It lives at `/cms/pages`, inside the CMS interface, and that is a deliberate arrangement rather than
a convenience: the `pages` service accepts the CMS's own client id as its audience, so these screens
sit inside the CMS's `AuthProvider` and reuse its session. There is no second application to
register, no second redirect URI, and no second sign-in for an editor who is already in the console.

`src/lib/pages/client.ts` is built over `cmsAuth.session` for exactly that reason. The public half,
`src/lib/pages/content.ts`, shares none of it — importing the editorial client would drag the whole
CMS auth stack onto a product page, and a visitor reading a changelog has no business holding a
session to do it.

| Screen                                  | What it edits                                        |
| --------------------------------------- | ---------------------------------------------------- |
| `/cms/pages`                            | Every application page, with drag-and-drop ordering   |
| `/cms/pages/new`, `/cms/pages/:id`      | One page: identity, artwork, tabs, links, two bodies  |
| `/cms/pages/:id/updates`                | The changelog                                        |
| `/cms/pages/:id/updates/new`, `/:updateId` | One release note, and the builds it publishes     |
| `/cms/pages/:id/wiki`                   | The wiki, in sidebar order                           |
| `/cms/pages/:id/wiki/new`, `/:pageId`   | One wiki page                                        |

Two details of the editor are worth knowing:

- **The changelog has no reorder and should not.** A changelog's order is its release dates, and a
  manual position would be a second, quieter way of saying when something shipped. Moving an entry
  means correcting its date. The wiki *does* have one, because its order is a reading order somebody
  chose.
- **Pricing is three fields on the application, and only the one in force is shown.** A screen
  showing both the price and the suggested amount would be a screen where the figure that is *not*
  being charged still sits there looking edited. The service keeps the other number, so switching
  modes back and forth loses nothing.
- **A build is registered and then uploaded, in two calls.** That is how the service takes it, and
  it is why a row can exist with no bytes yet: it is the normal state between the two, it cannot be
  published, and retrying the upload is what finishes it. The panel only appears once the release
  exists, because a build has nothing to hang off until then.
- **The section picker only offers sections that can hold the page.** The service caps the sidebar
  at two levels and answers 422 for anything deeper; filtering the list turns that into a choice
  that was never offered. The rule is the same either way, but a rejected save is a worse way to
  learn it.

## Configuration

`VITE_PAGES_BASE_URL` points the interface at the service; it defaults to the production one. There
is no client id and no redirect path here, because there is no application of its own — see above.
The paid half needs no configuration either: checkout and `/me/*` are called with the *site's* own
session (`franciscosolis-web`), which the service accepts on a second audience list of its own.
