# The marketplace

`/product/<slug>` is the page of one of the things built here, and every one of them is the same
page: a banner, a row of tabs under it, and the content behind them. The content comes from the
`marketplace` module of the [API](https://api.franciscosolis.cl/openapi.json); the console that
edits it is at `/marketplace`, and is a client application of its own.

| Route                                             | What it is                                              |
| ------------------------------------------------- | ------------------------------------------------------- |
| `/product/:slug`                                  | **Overview** — one Markdown document, with the sidebar  |
| `/product/:slug/releases`                         | **Releases** — the changelog, newest release first      |
| `/product/:slug/releases/:channel/:version`       | One version in full, with its compatibility and builds  |
| `/product/:slug/wiki`                             | **Wiki** — redirects to the first page                  |
| `/product/:slug/wiki/:page`                       | One wiki page, with the sidebar beside it               |
| `/product/:slug/reviews`                          | **Reviews** — what the people who obtained it thought   |
| `/product/:slug/contact`                          | **Contact** — how to reach support                      |

`/application/:slug/*` is where this section lived before it was a store, and it redirects here
rather than 404-ing — a published README or somebody's bookmark still lands. The one renamed
segment is `updates`, which is now `releases`; everything else kept its name through the move.

Most of it needs no session: the service only ever answers with `published` rows, which is the
boundary a public page needs. The exceptions are money and reviews — see below. A slug that is not
published is the site's own 404 — from a visitor's side there is no difference between a product
that was never created and one that is still a draft, and the service is deliberately unable to tell
them apart either.

## Why the tabs are a registry and not a layout

The whole point of this section is that a dozen products read as one family rather than a dozen
sites. So the tab set is fixed — Overview, Releases, Wiki, Reviews, Contact — and what a product
chooses is *which of them it turns on*, in what order, plus its artwork and its accent. There is no
per-page layout field, and adding one would end the arrangement: the moment a page can describe its
own shape, the set of pages stops being a house standard.

Overview is not optional. A page without it is a banner and a row of links, and every other tab is
something a visitor reaches *after* deciding the product is for them.

The tab list comes from the service (`GET /marketplace/`) rather than from a list kept here, so the
day a sixth kind of tab lands on the Worker the editor offers it without a release on this side.
What this interface does keep is how to *draw* each one — an icon and a route — and an unknown key
is simply not rendered.

The **sidebar** is deliberately not a tab. It is chrome beside the banner, like the links row, and
it has a route of its own on the service (`GET /products/:slug/overview`) so it never needs one.

## Each tab is a route

A tab is a URL, not a piece of component state. Linking somebody to a changelog entry, one wiki page
or a single version is the normal case for a product page, and a tab bar that cannot be copied,
bookmarked or middle-clicked is a worse version of the navigation it stands in for. The wiki carries
a second segment for the open page, and a release carries two, for the same reason.

`ProductLayout` loads the product once and puts it on a context; the tabs are small components that
only know about their own content. Five screens each fetching the same row would reload the banner
on every tab change.

A tab a product did not turn on is the wrong address rather than an error, so `RequireTab` redirects
to the Overview — which every product has — instead of rendering an empty panel under a tab bar the
tab is not even on. The version detail sits *under* the Releases tab's guard rather than beside it:
it is the same content one level down, and a product with that tab off has no versions to show.

## The sidebar

One call, `GET /products/:slug/overview`, rather than five: it is one panel, and the figures in it
are read together. It carries nothing per-caller, which is what lets the service cache it.

Three labelling rules come from the service and are not re-decided here:

- **Downloads is the headline number**, with purchases beside it rather than instead of it. A free
  product answers `null` for purchases and the row is simply absent — "0 purchases" is not a number
  anybody asked about on something that was never for sale.
- **A null rating is not zero stars.** The service answers `null`, never `0`, when nothing counts
  toward the average, and `RatingStars` renders a null as nothing at all. One empty star on a card
  reads as a verdict rather than as an absence, which is the worst available mistake here.
- **The latest version's purchase count is an approximation**, and the row carries the sentence
  saying so. A purchase entitles the whole product and never names a release, so "bought while this
  version was current" is the most that can honestly be said.

On a narrow screen the sidebar goes *below* the Overview document rather than above it: the figures
are what somebody checks after deciding they are interested, and putting them first on a phone would
push the sentence explaining what the product is off the screen.

## Release channels

A release is on one of four lines — `nightly`, `beta`, `rc`, `release` — and that is a different
question from whether anybody may see it: `draft`/`published` decides visibility, the channel decides
how much to trust what is visible.

The channel is part of the version key on the service, so `1.4.0` can exist as an `rc` and, a week
later, as a `release`. That is why the public address of a version is
`/product/:slug/releases/:channel/:version` and not just the number — a URL naming only the number
would be ambiguous between the two.

The feed shows the **stable line** unless `?channel=` asks for more, and that default matters: a
visitor who opens a changelog has asked for what shipped, not for what was built last night. The
choice lives in the query string rather than in component state, so "the beta changelog" is a link
somebody can send. An unrecognised value falls back to the stable line here rather than being passed
on, because the service *refuses* one — deliberately, so a typo cannot silently mean "everything" —
and a 400 in place of a changelog is a worse answer to a mistyped URL than the changelog.

`ChannelPicker` leaves out a line with nothing published on it, so a product that has never shipped
a nightly does not offer a tab that leads nowhere. `ChannelBadge` deliberately does **not** draw the
stable channel: a release with no badge is the stable one, and badging every entry on a product that
only ships stable builds would add a column of noise saying "normal".

## Compatibility

What a version runs on, declared **per release and never per product**, because a release is exactly
where support is added and dropped. A product-wide list would have to be either the intersection of
every version's — useless — or the newest one's, pretending older downloads were never compatible
with anything else.

It is drawn in two places: on the version's own page, grouped by kind, and in the sidebar for the
latest version, as one line per entry. `constraint` is free text, for the same reason a version label
is — `14+`, `>=17 <22` and `only on Apple Silicon` are all things an author needs to be able to say.

## Reviews

One per person per product, written only by somebody who actually obtained it, published
immediately, answerable once by the owner, and flaggable by readers.

Who may write one is the service's decision and is obeyed rather than re-derived. The reason a caller
may not is a closed set — `not_authenticated`, `not_obtained`, `no_release` — so each one is answered
with the thing that would actually help: "sign in" is a button, "you have to have downloaded it
first" is a line, and "there is nothing published to review yet" is neither.

There is no separate create and edit: `PUT` creates or replaces, because one person holds at most one
review and "I changed my mind" is the same request as "I am reviewing this". The form appears both on
the Reviews tab and on a version's own page, and means the same thing in both — somebody who just
read what changed in a version is the person best placed to say something about it, and sending them
to another tab is how a review does not get written. The service anchors it to the newest release the
reviewer could have obtained, not to the page it was submitted from.

**A rating can be restarted and nothing is ever deleted.** Publishing a release marked
`resets_rating` opens a new window, App Store style. Every earlier review is still stored, still
readable and still on the tab — so three places say so out loud, because an average over a window
nobody was told about looks like a bug to anyone who remembers the old score: the summary
(`reset_at`), each review from before the line (`counts_toward_rating`), and the release that did it.

The summary carries two counts that are easy to conflate and both are shown: `count` is what the
average is computed over, `total` is every visible review. They differ only after a reset, and then
it needs saying.

Review bodies are the one piece of unauthenticated free text this site renders, and they are
deliberately not Markdown anywhere in the stack — the service has no column for HTML near them, and
this side renders them with `whitespace-pre-line`, which keeps the paragraphs somebody typed without
giving them a renderer.

## Analytics

Views are counted with a `POST`, not as a side effect of the read: the read is cached, and a counter
that only increments on a cache miss counts caches rather than people. The service deduplicates per
viewer over a window of its own, so it is an estimate of attention and not a record of anybody.

It fires once per product from the layout — switching tabs is not a second visit — and once per
release from the version detail. Both are fire-and-forget: a counter that could break the page it
counts would be a very bad trade.

## Paying for a product

A product is `free`, `donation` (pago opcional) or `paid`, and the service decides which. What this
interface does with that answer is ask one question — `GET /products/:slug/access` — and obey it.

`PurchaseProvider` asks it once for the whole page. The price sits under the banner, the offer is one
dialog, and every Download button calls the same `requestDownload`, which is where "does this person
have to be offered a payment first" is applied. A button that decided for itself would be a button
that can be wrong on its own, and the one that goes wrong is the one that gives a paid build away.
While the answer is still loading the offer is shown: interrupting somebody who already paid costs
them a click, and skipping it for somebody who has not costs the price of the product.

Two rules come from the service and are not re-decided here. A non-payer sees the offer **every
time** — there is no "don't show this again", because that is how a paid product quietly becomes free
for whoever dismissed it once. And for an optional payment, declining is a button of its own with the
reason written beside it: an opt-out that has to be hunted for is not an opt-out.

**The pre-release gate is the one composition this side performs**, and it is composed from two facts
the service already decided rather than from a second copy of the rule: `channel_requires_purchase`
is a property of the release — is this *line* reserved for supporters — and `has_paid` is a property
of the caller. Neither is re-derived. If this side ever got it wrong, minting the ticket still answers
402, because the service applies the same gate again where it actually matters.

That case has its own wording in the dialog, and it must: on a `donation` product the stable build is
still free to take, so saying "this product has to be paid for" there would be false. Declining is
also withheld for it — a supporters-only nightly has nothing to skip to.

Paying needs an account. The purchase is attached to one, so somebody signed out is sent through the
site's own sign-in and comes back to the same page — which is also why buying a product creates an
SSO account: it is the ordinary magic-link sign-in happening before checkout, not something the
payments service does.

Coming back from MercadoPago, the page polls its own `access` rather than reading the status the
provider put in the query string. That status is the payer's browser talking; the entitlement is the
webhook's, and it arrives on its own schedule — so the page says "confirming" until our own service
agrees, and cleans the query string either way.

Which MercadoPago account the money goes to is the service's configuration, not this interface's:
`dev.franciscosolis.cl` is paired with a `marketplace-dev` that runs `MERCADOPAGO_ENVIRONMENT:
sandbox` and hands back the sandbox checkout, so the provider's test cards work there and nothing
charges a real card. Production is paired with the live one. Nothing here reads or reports that
setting — a page that displayed which account it was talking to would be a page that can say the
wrong thing.

## Downloads

The builds live on the **Releases** tab and on each version's own page, because a build belongs to
the release that published it. That is what makes the archive of old versions a consequence of the
changelog instead of a second list somebody has to keep in step with it.

Nothing is ever linked straight to storage. A row in the list is a file, not a URL; pressing it mints
a one-off link that carries who asked and whether they paid. For somebody who has paid it works at
once. For everybody else it is valid five seconds from now — the wait is `nbf` on the link itself, so
the countdown on screen is counting to something real rather than performing a delay that could be
skipped from the console. Once the link works it is also rendered as a plain anchor, because a
browser that refuses a programmatic click must not be a dead end.

The file *listing* stays public on every channel, including a reserved one. A visitor can always read
what is in tonight's build; what a pre-release may cost them is the download. Hiding the list would
remove the incentive the gate exists to create.

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

Only prose is translated. Which tabs a page has, its slug, a release's version number, its channel, a
category key and a wiki page's ordering are the same fact in every language.

In the editor, a translatable field carries a translate icon **inside** its control, and that icon
opens a dialog holding that one field in the other languages, with the original above it. The dialog
also offers to draft the translation with Workers AI (`POST /marketplace/admin/translate`), which
writes nothing: the draft is saved through the ordinary `PATCH` that saves every other override, so a
model outage cannot corrupt a page and nothing machine-translated is published unread.

## The console

It lives at `/marketplace`, as a section of its own, and it is a **client application of its own** —
`franciscosolis-marketplace`, with its own storage namespace (`fs.marketplace`) and its own sign-in.

That is not a preference, and it is worth writing down because getting it wrong cost a release. The
service accepts **only** its own audience (`MARKETPLACE_ALLOWED_AUDIENCES`), unlike `apps/pages`
before it, whose editor could live inside the CMS precisely because that service took the CMS's
audience. The console shipped once at `/cms/marketplace`, inheriting the CMS's `AuthProvider` the way
the old one did, and every call came back **401 before the permission was ever read** — which this
side cannot tell apart from an expired session, so it refreshed, failed again and sent editors around
the CMS's sign-in screen in a loop. `/cms/marketplace` and `/cms/pages` now redirect here.

`src/lib/marketplace/client.ts` builds `marketplaceAuth` for exactly that reason. The public half,
`src/lib/marketplace/content.ts`, shares none of it — importing the editorial client would drag a
whole auth stack onto a product page, and a visitor reading a changelog has no business holding a
session to do it. The *buying* half in `store.ts` and `reviews.ts` is a third thing again: per
person, never cached, and signed in under the site's own client id, which the service accepts on a
second audience list with no domain gate.

`MarketplaceProvider` asks `GET /admin/me` once above the whole signed-in subtree, so an account
without `marketplace:editor` meets one screen saying what is missing rather than nine panels that
each fail with their own 403 — and that screen says the part people forget: a permission granted
while you are signed in changes nothing until a fresh token carries it.

| Screen                                          | What it edits                                        |
| ----------------------------------------------- | ---------------------------------------------------- |
| `/marketplace`                            | Every product, with drag-and-drop ordering           |
| `/marketplace/new`, `/marketplace/:id`    | One product: identity, artwork, tabs, links, bodies  |
| `/marketplace/:id/releases`               | The changelog                                        |
| `…/releases/new`, `…/releases/:releaseId` | One release note, and the builds it publishes        |
| `/marketplace/:id/wiki`                   | The wiki, in sidebar order                           |
| `…/wiki/new`, `…/wiki/:pageId`            | One wiki page                                        |
| `/marketplace/:id/sales`                  | Its sales, with the totals, and where one is recorded by hand |
| `…/sales/:saleId`                         | One sale: its facts, its receipts, its refund        |
| `/marketplace/:id/vouchers`               | Every receipt it ever issued, void ones included     |

**Not built yet**, and deliberately left for a second pass: review moderation and the owner's reply,
the cross-product report queue, per-release compatibility editing, the channel and `resets_rating`
controls on the release editor, the category picker, and the analytics series. Until those land, a
product's compatibility and channels are set through the API directly.

Both editing screens are **tabbed**, and their tabs are sections of the screen rather than routes.
A product is General / Appearance / Pricing / Tabs and links / Content; a release is Release / Notes /
Links / Downloads. The stack of panels they replaced made editing a published page a scroll past
everything already right to reach the one field that was not — but a section per *route* would have
thrown away whatever was typed on the way between two of them, so the form stays mounted and only its
sections are swapped.

Neither has a Translations section, and that is the same reasoning one step further: a tab of its own
was still a second copy of the form, in another language, one tab away from the text it translates.
The translation of a field lives on the field (see *The language* above).

That split has one cost, and it is paid in `SECTIONS` in each editor: every section names the fields
it holds. A refused save opens the first section holding one and marks the rest, because a validation
message under a field inside a closed tab is a save that fails for no visible reason.

## The sales screens

The last three rows of that table are a **back office**, not a sixth tab, and the distinction is the
same one the tab registry is about: the public tabs are what a visitor sees, and a visitor has no
business reading the takings. `ProductNav` shows Sales and Receipts for every product, including the
free ones — "did anybody donate" is a question about a free product too, and a product's mode changes.

Six things about these screens are deliberate:

- **The totals come from the service, over the same filters as the rows.** `GET …/sales/summary` is
  computed in the database over exactly the sales the listing beside it selects, so the figure at the
  top and the rows underneath cannot disagree. Summing the fifty rows on screen and calling it revenue
  is the one bug in a screen like this that nobody forgives.
- **Three figures, not one.** Gross is what ever settled, returned is what went back out, net is the
  difference — and quoting the first as revenue counts a refund as income.
- **A sale can be recorded by hand, and MercadoPago is not in the list of sources.** Cash, a transfer,
  a gift, other. The service refuses the provider's own name there, and the dialog does not offer it: a
  row claiming MercadoPago took money it has no record of would be indistinguishable from a real
  payment and would grant the same download.
- **The date is asked for.** A sale entered a week late whose statutory ten days ran from the day it
  was typed would give the buyer three days too many. So the field defaults to now and is editable,
  and the service backdates the approval with it.
- **Whether a refund is possible is read off the service, and so is why not.** `refund.refundable` and
  `refund.reason` come back on the sale, so the button's state and the API's answer come from one
  place — and a greyed-out button that nobody can explain is the state this avoids. The two reasons
  are "not approved" and "taken against the other MercadoPago account".
- **A receipt is re-issued, never edited.** Correcting one voids it and issues the next number, which
  is what the service does and what the screen says. Re-sending is a separate action with its own
  count, because "I never got it" is a different problem from "this is wrong" — and a void receipt
  stays in the list, since "you sent me this and now you say it is invalid" is exactly the conversation
  the row exists to settle.

A sale that was recorded but whose receipt could not be emailed answers 502, and the screen says so
rather than claiming the sale failed: the sale and the voucher are both written by then, and Resend is
one click away on the sale itself.

Two details of the editor are worth knowing:

- **The changelog has no reorder and should not.** A changelog's order is its release dates, and a
  manual position would be a second, quieter way of saying when something shipped. Moving an entry
  means correcting its date. The wiki *does* have one, because its order is a reading order somebody
  chose.
- **Pricing is three fields on the product, and only the one in force is shown.** A screen showing
  both the price and the suggested amount would be a screen where the figure that is *not* being
  charged still sits there looking edited. The service keeps the other number, so switching modes back
  and forth loses nothing.
- **A build is registered and then uploaded, in two calls.** That is how the service takes it, and
  it is why a row can exist with no bytes yet: it is the normal state between the two, it cannot be
  published, and retrying the upload is what finishes it. The panel only appears once the release
  exists, because a build has nothing to hang off until then — and every button inside it is
  `type="button"`, because it is rendered inside the release's form, where a button without one is a
  submit button. "Upload a build" used to save the release on its way to the file dialog.
- **The section picker only offers sections that can hold the page.** The service caps the sidebar
  at two levels and answers 422 for anything deeper; filtering the list turns that into a choice
  that was never offered. The rule is the same either way, but a rejected save is a worse way to
  learn it.

## Configuration

`VITE_MARKETPLACE_BASE_URL` points the interface at the service; it defaults to the production one.
`VITE_MARKETPLACE_CLIENT_ID` and `VITE_MARKETPLACE_REDIRECT_PATH` are the console's, and both default
to the registered values — the redirect URI is compared byte for byte by the auth service, so the
value registered there and the route this site serves have to be the same string.

The paid and reviewing halves need no configuration: checkout, reviews and `/me/*` are called with
the *site's* own session (`franciscosolis-web`), which the service accepts on a second audience list
of its own.
