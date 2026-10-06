/**
 * Where the site's static assets live: the `franciscosolis` R2 bucket, served at
 * cdn.franciscosolis.cl.
 *
 * Everything under `cdn/` in this repository is uploaded there by `.github/workflows/cdn.yml`, at
 * the same path it has under `cdn/` — so `cdn/brand/png/fs-mark.png` is
 * `https://cdn.franciscosolis.cl/brand/png/fs-mark.png`. The root icons (favicons, the manifest's
 * icons, the apple-touch-icon) stay in `public/`, because browsers and operating systems ask the
 * site's own origin for them by convention.
 *
 * The base URL is a build-time variable like every service's, so a build can be pointed at another
 * copy of the bucket without touching code. Both stacks share the one bucket today, which is why
 * `.env.dev` does not set it.
 */

const trimTrailingSlash = (value: string) => value.replace(/\/+$/, "");

export const CDN_BASE_URL = trimTrailingSlash(import.meta.env.VITE_CDN_BASE_URL ?? "https://cdn.franciscosolis.cl");

/** The absolute URL of an object in the bucket, given its key (`brand/png/fs-mark.png`). */
export const cdn = (key: string) => `${CDN_BASE_URL}/${key.replace(/^\/+/, "")}`;
