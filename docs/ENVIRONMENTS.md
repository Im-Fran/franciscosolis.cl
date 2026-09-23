# Environments

This site is deployed twice, from the same code, against two different APIs.

| | Production | Development |
|---|---|---|
| Worker | `franciscosolis` | `franciscosolis-dev` |
| Hostname | `franciscosolis.cl` | `dev.franciscosolis.cl` |
| API it talks to | `api.franciscosolis.cl` | `api-dev.franciscosolis.cl` |
| Built with | `pnpm run build` | `pnpm run build:dev` |
| Deployed by | Cloudflare's Git integration (dashboard) | `.github/workflows/deploy-dev.yml` |

The `-dev` suffix is not typed anywhere. `wrangler.jsonc` declares a named environment called
`dev`, and Wrangler appends the environment name to the Worker name.

## Which API a build talks to is decided by the build

This is the one thing to understand before changing any of it. The base URLs are Vite variables,
compiled into the bundle:

- `pnpm run build:dev` runs `vite build --mode dev`, which loads **`.env.dev`** — where every
  `VITE_*_BASE_URL` names `api-dev.franciscosolis.cl` — auth, CMS, marketplace, support and
  notifications alike.
- `pnpm run deploy:dev` runs `wrangler deploy --env dev`, which selects the `env.dev` block in
  `wrangler.jsonc` — the Worker name and the `dev.franciscosolis.cl` route.

They are two halves of one decision. Running the second without the first puts the *production*
bundle on `dev.franciscosolis.cl`: it looks like it works, right up until a test writes to the real
database. The workflow always runs both, in that order.

`.env.dev` is committed, and the `.gitignore` carries an explicit exception for it. It holds
nothing but public base URLs — values that end up in JavaScript anybody can read — and the build
that produces `dev.franciscosolis.cl` has to be reproducible from the repository alone.

## `routes` is inherited, which is why the override matters

A named Wrangler environment inherits no bindings, but it *does* inherit `routes`. Without the
override in `env.dev`, the development Worker would claim `franciscosolis.cl` the first time it
deployed and serve the test build to everybody. The override is the load-bearing part of that
block, not decoration.

## The development stack has its own accounts

Signing in on `dev.franciscosolis.cl` goes to `api-dev`, which has its own auth database — its own
users, its own roles, and its own OAuth client applications. A client id is a row in that database,
so `franciscosolis-web` on dev is a *different* application from the production one, with its own
secret and its own redirect URIs. They are registered from the API repository
(`pnpm run applications -- … --dev --remote`); the README there has the commands.

Your production account does not exist on dev, and no amount of testing on dev can touch it. That
is the point.

## Where the `prd` branch fits

Today `dev` is the default branch and a push to it releases both: Cloudflare's Git integration
builds production from it, and `deploy-dev.yml` deploys the development site. Once a `prd` branch
exists, production moves behind it — a dashboard change on the Workers Builds configuration — and
nothing here moves with it. `deploy-dev.yml` already watches `dev` and only `dev`.
