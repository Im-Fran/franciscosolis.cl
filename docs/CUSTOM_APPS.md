# Custom apps

`/custom-apps` is a private panel for the bespoke apps built for clients: who they were built for,
where they are installed, and what those installations are doing right now. It is the site owner's
tool and nobody else's — the service lets in one permission, on one domain, with a verified address.
The data comes from the `custom-apps` module of the [API](https://api.franciscosolis.cl/openapi.json).

Phase one brought a light CRM, the inventory of apps and their keys, the installations and their
telemetry, the kill switch, and the audit log. Phase two — **remote operation** — adds what is done
*to* a running app: commands and screenshots, feature flags and a versioned remote configuration,
in-app messages, crash reports and logs, and alerts delivered through the site's notification
centre. See [Remote operation](#remote-operation) below. Phase three — **releases and the updater** —
adds what reaches a running app as a new build: signed releases uploaded from CI, staged rollout,
pause and rollback, and what each device reports while it updates. See
[Releases and the updater](#releases-and-the-updater). Phase four — **contracts and hours** — adds
what each client pays for: contracts with their renewal and grace period, the hours each cycle
includes and what is left of them, the work log (bitácora) those hours are spent on, and the in-app
support form. See [Contracts, hours and the work log](#contracts-hours-and-the-work-log).

| Route                                        | What it is                                                     |
| -------------------------------------------- | -------------------------------------------------------------- |
| `/custom-apps`                               | **Overview** — connected vs. enrolled, what needs review, recent enrollments |
| `/custom-apps/companies`, `…/new`, `…/:id`   | Clients (companies and natural persons), their contacts and their apps |
| `/custom-apps/contacts`, `…/new`, `…/:id`    | The people at the clients, and which clients they belong to    |
| `/custom-apps/contracts`                     | **Contracts**, ending soonest first, filtered by status and client (in the address), with the running cycle's usage |
| `/custom-apps/contracts/new`, `…/:id/edit`   | Creating a contract (`?company_id=` preselects the client) or editing one |
| `/custom-apps/contracts/:id`                 | One contract: status, renew / cancel / delete, the running cycle, every cycle (close, mark billed), its work log, lifecycle and history |
| `/custom-apps/apps`, `…/apps/new`            | Every app, filtered by state, kind, client and name; registering one |
| `/custom-apps/apps/:id`                      | **Summary** — counts, details, the ingest addresses and the `<script>` tag |
| `/custom-apps/apps/:id/installations`        | Every device the app is installed on                           |
| `/custom-apps/apps/:id/usage`                | Daily usage for 30 days, and the week-by-hour heatmap          |
| `/custom-apps/apps/:id/config`               | **Flags & config** — feature flags by scope, the remote configuration document and its history (`config` module) |
| `/custom-apps/apps/:id/messages`             | **Messages** — banners and dialogs shown inside the app, with read receipts (`messages` module) |
| `/custom-apps/apps/:id/diagnostics`          | **Crashes & logs** — crash groups and the fleet's logs (`crashes` and/or `logs` module) |
| `/custom-apps/apps/:id/releases`             | **Releases** — every build CI uploaded, filtered by channel, platform, architecture and status; the upload instructions while there are none (`updates` module) |
| `/custom-apps/apps/:id/work-log`             | **Work log** — the covering contract and the work done on the app (always shown: it is not a module) |
| `/custom-apps/apps/:id/status`               | The kill switch                                                |
| `/custom-apps/apps/:id/settings`             | The app's fields (log level, screenshots, modules, presence…), its keys, the updater's key, settings and CI tokens (`updates` module), and deleting it |
| `/custom-apps/installations/:id`             | One device: live snapshot, charts (one point per minute), controls, commands and screenshots, its update offer and reports, logs, support requests, daily table, events, the full heartbeat log |
| `/custom-apps/releases/:id`                  | One release: status and why, rollout figures and rates, reach, notes and minimum version, the artifact, and every device report |
| `/custom-apps/crashes/:id`                   | One crash group, its status and every report with its stack    |
| `/custom-apps/alerts`                        | **Alert inbox**, filterable by status, app, rule and installation (in the address) |
| `/custom-apps/alerts/rules`                  | The alert rules: create, tune, silence, disable, take over notifications |
| `/custom-apps/alerts/:id`                    | One alert — where the notification centre's links land; acknowledge or resolve |
| `/custom-apps/audit-log`                     | Every write made through the panel, with before/after diffs    |

The app tabs for remote operation follow the app's **modules**: a tab whose module is off is hidden,
and its route, if reached anyway, says which module to turn on instead of showing a screen the
service would refuse. On an installation, the commands and screenshots panels need `commands`, the
log panel needs `logs`, the updates panel needs `updates` and the support requests need `support`; the
page loads the app beside the installation to know. A company's page also lists its contracts and its
whole work log, and an app's summary shows the contract covering it.

## Its own client application

The panel signs in as `franciscosolis-custom-apps`, with its own storage namespace
(`fs.custom-apps`), its own sign-in hand-off at `/custom-apps/sign-in` and its own callback at
`/custom-apps/callback`. The reason is the same one the marketplace console learned the hard way:
`apps/custom-apps` accepts **only** its own audience, so a token minted for any other client is
refused with a 401 *before* the permission is read — which this side cannot tell apart from an
expired session, and which loops through the sign-in screen forever. It is also the right shape for a
panel that reads telemetry off other people's machines: a CMS token should not be able to.

`CustomAppsProvider` asks `GET /v1/me` once above the whole signed-in subtree. A 403 there — no
`custom-apps:admin`, an unverified address, or one outside `franciscosolis.cl` — is one screen saying
what is missing, not every panel failing with its own error. As everywhere else, a permission granted
while signed in changes nothing until a fresh token carries it. `GET /` rides along for the
vocabularies (kinds, states, roles, heartbeat bounds, the ingest base); if it fails the bundle's own
copy of the lists stands in, so a hiccup on a public probe never closes the panel.

## The ingest surface is not this site's

The service has two surfaces over one database. The panel API under `/custom-apps/v1` is what this
site calls. The **ingest** at `ingest.franciscosolis.cl/custom-apps/v1/:appId` is for the client
apps only — enrollment, heartbeats, metrics, events — and nothing here ever calls it. The panel only
*shows* its addresses (the base URL, `openapi.json`, `sdk.js`) so they can be pasted into an app, and
for web apps it builds the `<script>` tag from `GET /v1/apps/:id/sdk`, with the `integrity` hash
that pins the exact file the service published.

App keys (`cak_…`) are public by design — they ship inside the client app — so the panel shows them
in full and lets them be copied at any time. Revoking a key stops *new* enrollments only; each
installation already enrolled holds its own token, and revoking an *installation* is what cuts a
device off.

## Live screens

Several screens refresh themselves while the tab is visible: the overview and the alert inbox every
30 seconds, an app's installations and an installation's snapshot every 15, and an installation's
command list every 5 — but only while a command on the page is still pending or delivered — and a
published release's page every 30, while no dialog is open on it. "Connected" is derived from the last heartbeat
(`offline_after_intervals` × the app's interval), so an answer that was right when the page loaded
stops being right within a couple of intervals. A hidden tab is skipped rather than throttled, and a
refresh keeps the rows on screen instead of flashing a spinner. The charts and the daily table do not
poll: history does not change under a reader the way "now" does.

## Charts

There is no chart library. `src/pages/custom-apps/components/charts/` holds three small SVG/HTML
components — a line chart with a hover crosshair, a grouped bar chart and a heatmap grid — drawn in
the site's theme tokens, so every theme repaints them. Each chart has one y axis that starts at zero;
CPU, memory and network are three charts rather than three lines because they are three units.

The **heatmap** is what maintenance windows will be planned on, so it is drawn to be read: Monday
first, one column per hour, linear single-hue shading, the client's operating hours outlined, and
the exact figure for the pointed cell in words underneath.

## Remote operation

Phase two is all panel API (`/custom-apps/v1`); the ingest side — what the client apps collect and
report — is the service's business. Every write here is audited like the rest, and the audit log
labels the new events. One entry has no actor at all: when a grace period runs out the service
suspends the app itself, and the log shows that change as **automatic**, with the reason.

**Kill switch.** Grace now needs an end date, in the future and at most `grace_max_days` (31) ahead;
when it passes, the service suspends the app on its own. The status form checks the same bounds
before sending. Maintenance keeps an optional, informative end that changes nothing by itself.

**Commands.** Sent to one installation from its page: restart the app, restart the device (kiosks
only), reload the configuration, clear the cache, take a screenshot, upload logs, check for updates —
with an optional JSON payload and an expiry (one hour by default). A command waits on the service as
`pending` until the device collects it: on its next heartbeat, or at once when the app uses `socket`
presence and the device holds the live connection (the panel shows a **Socket** badge beside the
connected dot then). It ends `succeeded`, `failed`, `expired` or `cancelled`; pending and delivered
ones can be cancelled. The service refuses (409) a revoked installation, an app without `commands`,
a device restart on a non-kiosk app and a screenshot that is not allowed, and the form disables those
options up front. `socket` presence is for kiosks and points of sale — native apps hold a WebSocket;
websites always ping, whatever the setting says.

**Screenshots are off by default**, twice over: the app has `screenshots_enabled` (Settings) and each
device has its own (installation controls), and a screenshot needs both (`screenshots_allowed`). A
screenshot can show the client's own customers, which makes it personal data under ley 21.719, so it
is turned on only where the client's contract allows it. Images are served behind the same bearer
token as everything else: the panel fetches each one as a blob and shows it through an object URL
(revoked on unmount), because an `<img src>` would ask without the token. Deleting one asks first.

**Flags.** Per app, a key (`^[a-z0-9][a-z0-9_.-]{0,63}$`) with a boolean, string or number value, set
at the app scope, for a channel, or for one installation. For any one device the **most specific
wins**: installation, then channel, then app. The panel groups rows by key in that order, so reading
down a group is reading the precedence. Setting a key twice at the same scope is a 409.

**Remote configuration.** One JSON document per app, saved as numbered versions (version 0 means
nothing was published yet), with an optional JSON Schema. Every save sends `base_version`, so two
people editing at once is a 409 for the second rather than a silent overwrite. The schema supports a
subset of JSON Schema — `type`, `properties`, `required`, `additionalProperties`, `items`, `enum`,
`const`, `minimum`, `maximum`, `minLength`, `maxLength`, `pattern`, `minItems`, `maxItems`, `title`,
`description`, `default`, `examples`, `$schema` — and a document that fails it, or a schema using
anything else, comes back as a 422 with `issues`, which the editor lists as written. The parse
errors of either textarea are shown before anything is sent. Restoring a version publishes it again
as the newest one; history only grows.

**Messages.** A banner or a modal dialog with a severity, for the whole app, a channel or one device,
between optional start and end dates. Ending one sets its end to now — it is not deleted, so its read
receipts (which devices showed it, and when) survive. The scope is fixed once a message exists.

**Crashes and logs.** Crash reports are grouped by signature and version; a group is resolved
(reopens if it happens again), ignored, or reopened by hand, and its page shows every report with its
stack. Logs are filtered on the service by minimum level ("warning" means warning and worse), text,
dates and — across the fleet — installation. The app sets the log level; a device can override it.
Both are kept **30 days**.

**Alerts.** Rules watch for an installation offline for N minutes, CPU or memory above N % over a
window, or a spike of crashes, error logs or enrollments within a window (5–1440 minutes), on one app
or on every app. Alerts are open, acknowledged or resolved; resolving one whose condition still holds
gets it reopened at the next evaluation, and the resolve dialog says so. Whoever creates a rule is
notified — any admin can take a rule over with "Notify me" — through the site's **notification
centre**, under the `custom_apps` category (bell, Web Push and email, per that account's own
preferences). Each notification links to `/custom-apps/alerts/<id>`, which is why that route is a
contract with the service rather than a choice. Silencing pauses a rule until a date; disabling
pauses it indefinitely; deleting takes its alerts with it. The overview counts unresolved alerts,
and an app summary or installation page with open alerts links to the inbox filtered to it.

## Releases and the updater

Phase three is panel API too. **The panel never uploads a release**: CI does, straight to
`POST /custom-apps/v1/apps/:appId/releases/upload` with a CI token of the app (`cic_…`) and an
Ed25519 signature over the artifact's raw SHA-256 digest, and the build arrives as a **draft**. The
Releases tab shows that command written for the app, with the key-pair and signing commands, as its
empty state — and ticks off the key and the token once they exist. Everything after the upload is
decided here, and every decision is audited.

**Setting it up** (Settings, with `updates` on). The **release public key** is the raw 32 bytes of
the Ed25519 public key in base64; the form checks that shape before sending and the service checks
it again. Replacing or removing it asks first: the same key is built into the app so its updater can
verify what it downloads, so a new key is only safe once a build carrying it is out, and with no key
CI cannot upload at all. Beside it, the updater's numbers: how long a device waits for the new
version to report healthy (30 s – 24 h), how many failed attempts it makes (1–100), and the rollback
and crash rates at which a rollout **pauses itself** (1–100 %). **CI tokens** are secrets, unlike app
keys: the service keeps only their hash, so a token is shown **once**, in the dialog after creating
it, and only its prefix afterwards. Revoking one stops the next upload and nothing else.

**A line** is app, channel, platform and architecture: a device is offered the newest published
release of its line whose rollout reaches it. **Publishing** a draft takes a percentage of the line
and, optionally, named installations offered it whatever the percentage says (the canary kiosks).
The percentage picks devices by a stable bucket, so the same devices are always the first 10 %.
**Changing the rollout** widens or narrows that reach; narrowing it uninstalls nothing. **Pausing**
stops offering it to anybody new. **Withdrawing** pulls it, and every device running it is offered
the newest earlier version as a mandatory rollback. **Rolling the line back** to a release withdraws
every newer published or paused release of the line and publishes that one at 100 %. Pause, withdraw
and roll back each take an optional reason, kept on the release and in the audit log. Only a draft
can be deleted. The service refuses every other transition with a 409, so the page only offers the
ones the status allows.

**The release page** shows the distinct devices that downloaded, installed, came up healthy, rolled
back, failed, and crashed on the version since it was published, and both rates against the app's
thresholds. A rollout the service paused **automatically** says so in words — which rate, its value,
the threshold and how many devices were behind it — and that resuming it without fixing the cause
pauses it again at the next evaluation; the audit log shows that pause with no actor, as
**automatic**, with the reason. The artifact is downloaded behind the bearer token, fetched as a
blob and saved through an object URL, the same way screenshots are shown. A published release's page
refreshes every 30 seconds while no dialog is open.

**On an installation**, the updates panel shows what the service would offer the device right now —
exactly as the device would read it, flagged **mandatory** below the release's minimum version or
**rollback** when the version it runs was withdrawn — and every step it reported. The overview counts
releases rolling out (published below 100 %), paused and in draft, and a `release_rollbacks` alert
rule watches for rollbacks reported within a window.

## Contracts, hours and the work log

Phase four is panel API too. **Hours are whole minutes on the wire** and the panel shows them as
hours (`12 h 30 min`, or `12,5 h` beside a bar); the contract form takes hours, decimals included, and
sends minutes. **Dates are calendar days** (`YYYY-MM-DD`) in the service's zone, never instants, so
they are formatted without going through `new Date(day)` — which would read them as UTC midnight and
show the day before in Santiago. A contract's `ends_on` is its **last day covered**; a cycle's
`ends_on` is the **first day of the next one**, so a cycle reads as `starts_on – (ends_on − 1 day)`.
Amounts are in the contract's currency: CLP in whole pesos, UF with up to two decimals. There is no
CLP equivalent for UF — this site reads no UF indicator to convert with.

**A contract** belongs to a client and covers some of its apps — never an app already covered by
another contract in overlapping dates (409, with the app named). Its form is grouped as the plan
reads: plan and price; term and renewal (last day inclusive or open-ended, renews itself for N
months, days of notice); hours per cycle (daily, weekly or monthly cycles anchored on the first day,
included hours, overage rate per hour, and rollover with an optional cap in hours and in cycles); end
of contract and grace (0–30 days, what is still allowed — updates, support — and the message the apps
show); and the covered apps. Once a cycle exists the first day and the cycle length are **fixed**,
because the cycles are computed from them: both fields are disabled, and the service's 409 is
explained if it is reached anyway. Only the fields that changed go on a PATCH.

**Status** is `scheduled`, `active`, `grace` (ended without renewal, inside its grace days), `ended`
or `cancelled`, and the list flags one **ending soon** — within its notice period without renewing
itself — with its days left. Before the end the service emails the client and every covered app
shows a notice; when it lapses the apps go into grace (or straight to suspension with no grace days),
and the existing grace expiry suspends them. **Renewing** takes a new last day, later than the
current one and no earlier than today, or none; it reactivates what the lapse switched off.
**Cancelling** takes an optional reason (kept in the audit log, shown in the contract's history),
starts no new cycles and leaves the apps as they are. **Deleting** is refused once a contract has a
closed cycle or logged work: the dialog says to cancel instead.

**The running cycle** shows included, carried (and from which cycles), available, used, remaining —
negative once over — and the overage with what it would cost at the contract's rate: an estimate
while the cycle is open, final once it closes. Usage is broken down by app. **Every cycle** is listed
with its figures; one whose period ended can be **closed** by hand (the service closes it on its own
anyway), and a closed one is **marked billed** with an optional invoice reference. A closed cycle's
balance is final — the next cycle's carried hours derive from it.

**The work log** is one panel shown in three places: an app's *Work log* tab (through the app's own
routes, so the app is fixed), a company's page (where an entry may name one of its apps or none —
work for the client as a whole), and a contract's page (where every entry is filed under that
contract). An entry is a day (not in the future), hours and minutes (at most 24 h), a kind
(maintenance, support, development, other), what was done and an optional link. The service files it
under the contract covering its app — or the company — on that day and under the cycle the day falls
in; the dialog says beforehand which contract that will be, and asks for one only when several cover
the day (the service's 422). An entry inside a **closed cycle** is shown locked, and a day inside one
is refused (409) in words. The panel's total is the service's sum over every entry the filters match.

**Alerts.** `contract_expiring` fires N days before a contract's last day (1–365, 30 by default) and
`cycle_hours_low` when a running cycle has less than N % of its available hours left (0–100, 20 by
default). Neither reads a window. Their alerts name the contract and link to its page; a rule tied to
an app watches only the contracts covering it. The overview counts active contracts, those ending
soon and those in grace, and cycles over budget and closed cycles with overage not billed yet.

**Support.** The `support` module is the in-app support form: `FSCustomApps.support({subject,
message, name, email})` in the web SDK, `POST /support` on the ingest. The request is emailed to
soporte@franciscosolis.cl with the device's context; there are **no tickets in the panel**, by
decision. The panel labels the module in its pickers, mentions the call under a web app's script tag,
and lists the `support.requested` entries the service audits on the installation's page.

The audit log labels every new event, links contract and cycle events to the contract, and shows when
an app's state changed because its contract lapsed or was renewed — with a link to the contract.

## Configuration

`VITE_CUSTOM_APPS_BASE_URL` points the panel at the service (default
`https://api.franciscosolis.cl/custom-apps`; `.env.dev` names `api-dev`). `VITE_CUSTOM_APPS_CLIENT_ID`
(default `franciscosolis-custom-apps`) and `VITE_CUSTOM_APPS_REDIRECT_PATH` (default
`/custom-apps/callback`) are the panel's own. The redirect URI is compared byte for byte, so
`<origin>/custom-apps/callback` has to be registered on the application in each auth database.
