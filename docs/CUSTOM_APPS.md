# Custom apps

`/custom-apps` is a private panel for the bespoke apps built for clients: who they were built for,
where they are installed, and what those installations are doing right now. It is the site owner's
tool and nobody else's — the service lets in one permission, on one domain, with a verified address.
The data comes from the `custom-apps` module of the [API](https://api.franciscosolis.cl/openapi.json).

This is phase one: a light CRM, the inventory of apps and their keys, the installations and their
telemetry, the kill switch, and the audit log. Remote control and the live presence socket come
later; the panel already reads the presence modes from the service, so the day `socket` is served it
shows up in the Settings tab without a release here.

| Route                                        | What it is                                                     |
| -------------------------------------------- | -------------------------------------------------------------- |
| `/custom-apps`                               | **Overview** — connected vs. enrolled, what needs review, recent enrollments |
| `/custom-apps/companies`, `…/new`, `…/:id`   | Clients (companies and natural persons), their contacts and their apps |
| `/custom-apps/contacts`, `…/new`, `…/:id`    | The people at the clients, and which clients they belong to    |
| `/custom-apps/apps`, `…/apps/new`            | Every app, filtered by state, kind, client and name; registering one |
| `/custom-apps/apps/:id`                      | **Summary** — counts, details, the ingest addresses and the `<script>` tag |
| `/custom-apps/apps/:id/installations`        | Every device the app is installed on                           |
| `/custom-apps/apps/:id/usage`                | Daily usage for 30 days, and the week-by-hour heatmap          |
| `/custom-apps/apps/:id/status`               | The kill switch                                                |
| `/custom-apps/apps/:id/settings`             | The app's fields, its keys, and deleting it                    |
| `/custom-apps/installations/:id`             | One device: live snapshot, charts (one point per minute), daily table, events, the full heartbeat log, controls |
| `/custom-apps/audit-log`                     | Every write made through the panel, with before/after diffs    |

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

Three screens refresh themselves while the tab is visible: the overview every 30 seconds, an app's
installations and an installation's snapshot every 15. "Connected" is derived from the last heartbeat
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

## Configuration

`VITE_CUSTOM_APPS_BASE_URL` points the panel at the service (default
`https://api.franciscosolis.cl/custom-apps`; `.env.dev` names `api-dev`). `VITE_CUSTOM_APPS_CLIENT_ID`
(default `franciscosolis-custom-apps`) and `VITE_CUSTOM_APPS_REDIRECT_PATH` (default
`/custom-apps/callback`) are the panel's own. The redirect URI is compared byte for byte, so
`<origin>/custom-apps/callback` has to be registered on the application in each auth database.
