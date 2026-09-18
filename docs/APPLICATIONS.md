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

Nothing here needs a session: the service only ever answers with `published` rows, which is the
boundary a public page needs. A slug that is not published is the site's own 404 — from a visitor's
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
| `/cms/pages/:id/updates/new`, `/:updateId` | One release note                                  |
| `/cms/pages/:id/wiki`                   | The wiki, in sidebar order                           |
| `/cms/pages/:id/wiki/new`, `/:pageId`   | One wiki page                                        |

Two details of the editor are worth knowing:

- **The changelog has no reorder and should not.** A changelog's order is its release dates, and a
  manual position would be a second, quieter way of saying when something shipped. Moving an entry
  means correcting its date. The wiki *does* have one, because its order is a reading order somebody
  chose.
- **The section picker only offers sections that can hold the page.** The service caps the sidebar
  at two levels and answers 422 for anything deeper; filtering the list turns that into a choice
  that was never offered. The rule is the same either way, but a rejected save is a worse way to
  learn it.

## Configuration

`VITE_PAGES_BASE_URL` points the interface at the service; it defaults to the production one. There
is no client id and no redirect path here, because there is no application of its own — see above.
