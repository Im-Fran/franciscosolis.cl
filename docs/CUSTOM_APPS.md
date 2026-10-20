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
includes and what is left of them, the work log (bitácora) those hours are spent on, and the
support tickets opened from inside the apps, answered here. See
[Contracts, hours and the work log](#contracts-hours-and-the-work-log) and
[Support tickets](#support-tickets). Phase 4b — **scheduled maintenances** — adds work done on a
client's devices in a window the client approved (or, for a security patch, one the system chose),
with a public page the client approves it on. See [Scheduled maintenances](#scheduled-maintenances).

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
| `/custom-apps/installations/:id`             | One device: live snapshot, charts (one point per minute), controls, commands and screenshots, its update offer and reports, logs, its support tickets, daily table, events, the full heartbeat log |
| `/custom-apps/releases/:id`                  | One release: status and why, rollout figures and rates, reach, notes and minimum version, the artifact, and every device report |
| `/custom-apps/crashes/:id`                   | One crash group, its status and every report with its stack    |
| `/custom-apps/tickets`                       | **Support inbox**, opening on what needs somebody (open and waiting on the client), filterable by status, app, client and installation (in the address) and searchable by subject, requester or `#number` |
| `/custom-apps/tickets/:id`                   | One ticket — where the notification centre's links land: the conversation, answer (and the status it leaves), status and subject, the device's context, and the time logged against it |
| `/custom-apps/maintenances`                  | **Maintenances** across apps, as a list or a month calendar (`?view=calendar&month=YYYY-MM`), filtered by status (including `upcoming`, `pending` and `attention`), kind, app, client and days (in the address) |
| `/custom-apps/maintenances/:id`              | One maintenance — where the notification centre's links land: status and actions, the windows (editable, with suggestions over the heatmap), approval, run and result, included installations, its work log and history |
| `/custom-apps/apps/:id/maintenances`         | **Maintenances** of one app, and "New maintenance" (always shown: it is not a module) |
| `/mantencion/:token`                         | The **public approval page** a client opens from the email — outside the panel, no login |
| `/custom-apps/alerts`                        | **Alert inbox**, filterable by status, app, rule and installation (in the address) |
| `/custom-apps/alerts/rules`                  | The alert rules: create, tune, silence, disable, take over notifications |
| `/custom-apps/alerts/:id`                    | One alert — where the notification centre's links land; acknowledge or resolve |
| `/custom-apps/audit-log`                     | Every write made through the panel, with before/after diffs    |

The app tabs for remote operation follow the app's **modules**: a tab whose module is off is hidden,
and its route, if reached anyway, says which module to turn on instead of showing a screen the
service would refuse. On an installation, the commands and screenshots panels need `commands`, the
log panel needs `logs`, the updates panel needs `updates` and the support tickets need `support`; the
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
reads: client and scope (the client, the name and the covered apps, which wait for a client to be
chosen); term (last day inclusive or open-ended, renews itself for N months, days of notice); price
(amount and currency, billing period); hours per cycle (daily, weekly or monthly cycles anchored on
the first day, included hours, overage rate per hour, and rollover with an optional cap in hours and
in cycles); end of contract and grace (0–30 days, what is still allowed — updates, support — and the
message the apps show); and notes. Once a cycle exists the first day and the cycle length are **fixed**,
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
contract) — and, narrowed to one ticket, on that ticket's page. An entry is a day (not in the
future), hours and minutes (at most 24 h), a kind (maintenance, support, development, other), what
was done, an optional link and an optional **support ticket** it answered (one of the app's tickets,
or of the company's for work about the company as a whole; the service refuses a ticket of another
company, 422). An entry linked to a ticket shows `#number` with a link to it. The service files it
under the contract covering its app — or the company — on that day and under the cycle the day falls
in; the dialog says beforehand which contract that will be, and asks for one only when several cover
the day (the service's 422). An entry inside a **closed cycle** is shown locked, and a day inside one
is refused (409) in words. The panel's total is the service's sum over every entry the filters match.

**Alerts.** `contract_expiring` fires N days before a contract's last day (1–365, 30 by default) and
`cycle_hours_low` when a running cycle has less than N % of its available hours left (0–100, 20 by
default). Neither reads a window. Their alerts name the contract and link to its page; a rule tied to
an app watches only the contracts covering it. The overview counts active contracts, those ending
soon and those in grace, and cycles over budget and closed cycles with overage not billed yet.

The audit log labels every new event, links contract and cycle events to the contract, and shows when
an app's state changed because its contract lapsed or was renewed — with a link to the contract.

## Support tickets

The `support` module lets a client's app open a **ticket** from its own support screen —
`FSCustomApps.openTicket({subject, message, name, email})` in the web SDK, `POST /tickets` on the
ingest — with the device's context attached, and read and continue its own tickets
(`tickets()`, `ticket(id)`, `replyTicket(id, message)`). The tickets live in this panel; nothing is
emailed, and this is not the website's support, which stays plain email to soporte@.

**The inbox** (`/custom-apps/tickets`, in the main navigation) lists tickets most recently active
first and opens on `active` — `open` (waiting on us: new, or the requester wrote again) and `pending`
(answered, waiting on the requester); `resolved` and `closed` are one filter away. Each row shows the
number, subject, requester, app, client and device, the status and whose turn it is, how many of the
requester's messages nobody opened yet, the last activity and the time logged. Status, app, client and
installation live in the address, so the app summary and settings and an installation's page link
straight to their own tickets; the search runs on the service and takes `#42` for a number.

**One ticket** (`/custom-apps/tickets/:id`, the URL the notification centre links to) shows the
conversation — the requester's messages on one side, support's on the other, each answer saying
whether the app has fetched it yet — and opening it marks the requester's messages read. An
**answer** leaves the ticket `pending` unless the form says `resolved` or `closed`; the status
selector changes it without writing to anybody (reopening is that selector too), and the subject can
be corrected. The **context** is the snapshot taken when the ticket was opened — device, version,
channel, platform, system, architecture, last seen — with the latest log lines and the open crash
groups of that version when the app has those modules and the requester attached them; crash groups
come by title only, so the panel links to the app's diagnostics rather than to one group. Below it,
the **time logged** against the ticket is the ordinary work log narrowed to it, and *Log work* starts
an entry as support work linked to the ticket.

**Who hears about them.** Whoever turned `support` on receives every new ticket and every requester
message in the website's bell (`custom_apps.ticket_opened` and `custom_apps.ticket_message`, in the
`custom_apps` notification category), until somebody presses *Take this app's tickets* in the app's
settings. The summary says who receives them and how many are waiting for an answer. The overview
counts open tickets, tickets waiting on the client and tickets with an unread requester message, and the audit log
labels `ticket.opened`, `ticket.replied` and `ticket.status_changed`, linking each to its ticket.

## Scheduled maintenances

Phase 4b is panel API plus one public page. A **maintenance** says what will be done and what the
client will notice (the client reads the title and description as written), how long it takes
(15 min – 24 h, typed as hours and minutes and sent as minutes), optionally the **release** it installs
(a draft or published release of the app) and on which **installations** (every active one, or some —
with a release, only those on its line: the form marks the others instead of letting the save fail).
It is planned from the app's *Maintenances* tab, as a draft, in a dialog with the full help system.

**Kinds.** A `normal` maintenance is sent to the client for approval. A `security` patch is not: its
page offers *Schedule patch*, and the service picks the first unused block from two hours ahead within
the contract's `security_patch_days` (1–30, 3 by default — a field of the contract form, in *Hours per
cycle*), replaces the windows with it and emails the client a notice. Security patches are painted red
in every list and in the calendar.

**Windows.** While a maintenance is a draft or nobody answered (`no_response`), its page edits the
windows it is offered in: added by hand (a `datetime-local` **typed on Santiago's clock**, whatever zone
the browser is in — `src/lib/custom-apps/zoned-time.ts` converts both ways; the end follows the start
plus the duration until typed over), reordered with up/down arrows (the client sees them in that order,
and with no answer the first one still 24 h away is the one applied), and removed. Every write answers
the whole list. The **suggestions** panel asks `/windows/suggest` (which saves nothing) for the
least-used blocks of the next 14 days and draws them, numbered by rank, on the week-by-hour heatmap
(the `Heatmap` chart gained a `mark` prop); *Add* offers one as a `suggested` window.

**Approval.** *Send to the client* emails every `maintenance_approver` contact (else the primary, else
anybody with an address) a link of their own, valid until the first window starts; with no answer the
service resends after 48 h and applies it 48 h later. The page shows the recipients, the sends, when the
links expire, who answered and when, the chosen window and how it was chosen. A **rejection** brings the
maintenance back to draft with `rejected: true`: the list badges it *Rejected*, and its page opens with
the client's reason quoted in full and the hint to adjust the windows and send it again. Each refusal of
the service (app suspended or in grace without the `maintenance` allowance, no recipients, a window
already started, no email delivered) is explained in words.

**Run and result.** In progress it can be closed by hand — *Mark completed* (optional note) or *Mark
failed* (required note, which withdraws the release). The run panel lists the installations put in
maintenance, the update targets, those already on the version, off the release's line or skipped, the
ones that failed and what they last reported, the release the maintenance published or extended, the
withdrawal, and any notice email that could not be sent. A completed maintenance files its own work log
entry; the page shows the work log narrowed to it, and any entry can name a maintenance (the work log
dialog has a maintenance selector, and lists link `maintenance_title` to it). Cancelling (anything not
started) takes an optional reason; a draft or a cancelled one can be deleted.

**Lists.** `/custom-apps/maintenances` lists every maintenance with its kind, status, the chosen window
(or the first offered, marked as a proposal), sends and result, and toggles to a **month calendar** of
windows (`from`/`to` on the service) — the chosen window of each, and the offered ones of a request
still waiting on the client, dashed; below `sm` the calendar is an agenda. `attention` is built here,
from three requests: no answer, failed in the last 7 days, and drafts the client rejected — the same
three the overview counts. The **overview** has four cards: waiting on the client, scheduled this week
(`status=scheduled` with `from`/`to`), in progress, and needing attention.

**Notifications and audit.** `custom_apps.maintenance_approved` / `_rejected` / `_no_response` /
`_failed` / `_completed` reach the owner's bell in the `custom_apps` category, linking to
`/custom-apps/maintenances/<id>` — a contract with the service, like tickets and alerts. The audit log
labels every `maintenance.*` event, links resource type `maintenance` to its page, and links a release
or work log event caused by a maintenance (`metadata.maintenance_id`) to it too; a maintenance's page
shows its own history. A contract's *During grace* now offers **Scheduled maintenances**: without it,
maintenances of an app in grace are paused.

### The public approval page

`/mantencion/:token` (`src/pages/maintenance-approval/`) is routed at the top level of the site, inside
the public layout and outside every `AuthProvider`: the client's contact has no account here, and the
link is the credential. The address is the service's (`MAINTENANCE_LINK_BASE_URL` + token), so it must
not move. The page calls `GET /custom-apps/v1/public/maintenances/:token` and its `approve` / `reject`
through `src/lib/custom-apps/maintenance-approval.ts` — plain `fetch` against
`VITE_CUSTOM_APPS_BASE_URL` (`api-dev` on the development build), no bearer token, `credentials: omit`
and `referrerPolicy: no-referrer` — and imports nothing of the panel. `public/_headers` serves the path
`noindex`, unframeable and with `Referrer-Policy: no-referrer`.

It shows the client and app, the title, the description and the duration, and the windows as selectable
cards on Santiago's clock (a window that already started is disabled); *Approve this window* schedules
it, *Reject* asks for a reason (required, ≤ 1000) and an optional name goes with either. Once answered —
here or through another link — or when the link cannot answer, it says why: answered, superseded by a
newer email, expired when the first window started, or closed, with the outcome (approved, applied
without an answer, rejected with the reason, cancelled). A 404 reads as an invalid link, a 410 as the
state it carries, a 422 as "that window is no longer available" (and reloads), a 429 as "wait a minute".
It is bilingual like the rest of the site (the `maintenance_approval` namespace, Spanish for a Chilean
browser) and works one-handed on a phone.

## In-form help and required fields

Every control in the panel's forms and list filters carries an **info button** after its label; it
opens a dialog titled with the label, in three short sections — what it is, how to fill it in, and a
valid example (left out for a plain yes/no switch). The grey hint under a field stays as it was: the
dialog is the longer explanation. Every form also has a **"How does it work?"** button — in the page
header for a page editor, in the panel's action slot for a panel form, in the header of a dialog —
that says what the form is for, what can be done with it and what happens on save (what devices
pick up on their next heartbeat, what is emailed, what is audited, what can no longer change).

**Where it lives.** The generic pieces are in `src/components/ui/help.tsx`: `HelpButton`,
`FormHelpButton`, `RequiredMark`, `RequiredLegend`, and `FieldLabel` / `FieldLegend` / `WithHelp`
for controls that are not inside a `Field` (a JSON editor, a fieldset of checkboxes or radios, a
filter with no visible label). `Field` takes opt-in `help` and `required` props and `Modal` an
opt-in `help` (a form's `FormHelp`); a field or dialog that passes neither renders exactly as
before, so the auth, CMS and marketplace screens are unaffected. The help dialogs are portalled to
`document.body`, outside any form or label, and `Modal` ignores a nested dialog's `close`, so help
opened from a form dialog closes back onto the form with what was typed still there. Inside the
panel, `components/checkbox-field.tsx` draws a switch (card or plain) with its help, and
`components/form-section.tsx` the lightweight section headings.

**The copy** is in `custom_apps.json`, Spanish and English with identical keys, next to each area's
own strings: `<area>.help.<field>.{what, how, example?}` for a form field,
`<area>.filter_help.<filter>` (same shape) for a list filter, and
`<area>.form_help.{title?, what, can_do[], on_save}` for a form (an area with several forms uses
suffixed keys: `apps.form_help_create`, `release.form_help_pause`…). `useHelp()`
(`components/use-help.ts`) reads them — `help.field("contacts.help.name")`,
`help.form("contacts.form_help")` — and takes interpolation values for the limits the service sends
at run time (heartbeat bounds, notice and grace days), so the help never states a number the form
would refuse.

**Adding help** to a new field is `help={help.field("<area>.help.<field>")}` on its `Field` (or a
`FieldLabel` / `FieldLegend` / `WithHelp` around a custom control) plus the entry in both language
files; a new form adds `<FormHelpButton help={help.form("<area>.form_help")} />`, or `help=` on its
`Modal`. Write for the person filling the form in: the format and range the validation enforces,
what an empty value means, what cannot be changed later and what the client or the devices see.

**Required fields** carry an asterisk (read out as "required") and the form a one-line
"* Required" legend. The marker follows the form's own validation, conditions included — renewal
months only while the contract renews itself, the time zone only while operating hours are on, the
contract only when several cover the day, the grace end only in grace — and changes no validation.
A form with nothing required shows no legend.

## Configuration

`VITE_CUSTOM_APPS_BASE_URL` points the panel at the service (default
`https://api.franciscosolis.cl/custom-apps`; `.env.dev` names `api-dev`). `VITE_CUSTOM_APPS_CLIENT_ID`
(default `franciscosolis-custom-apps`) and `VITE_CUSTOM_APPS_REDIRECT_PATH` (default
`/custom-apps/callback`) are the panel's own. The redirect URI is compared byte for byte, so
`<origin>/custom-apps/callback` has to be registered on the application in each auth database.
