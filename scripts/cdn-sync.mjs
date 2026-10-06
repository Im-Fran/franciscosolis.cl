#!/usr/bin/env node
/**
 * Uploads everything under cdn/ to the `franciscosolis` R2 bucket, which cdn.franciscosolis.cl
 * serves, plus the brand kit packed from cdn/brand/ by scripts/brand-kit.mjs.
 *
 * Every file keeps its path: `cdn/brand/png/fs-mark.png` becomes the object
 * `brand/png/fs-mark.png`, so the URLs in src/lib/cdn.ts are just the paths under cdn/. Each object
 * is written with its own Content-Type and Cache-Control, because R2 serves exactly what it was
 * given — an SVG uploaded without a type is downloaded rather than drawn.
 *
 * It only ever *puts*. The bucket is shared with the API repository, which owns the `emails/`
 * prefix, so a sync that mirrored cdn/ by deleting whatever it does not know would erase the logo
 * every email links to. Removing an asset is therefore a deliberate `wrangler r2 object delete`.
 *
 *   node scripts/cdn-sync.mjs            upload (needs CLOUDFLARE_API_TOKEN or `wrangler login`)
 *   node scripts/cdn-sync.mjs --dry-run  print what would be uploaded, touch nothing
 *
 * CI runs it from .github/workflows/cdn.yml on every push to `dev` that changes cdn/.
 */
import {spawn} from "node:child_process";
import {mkdtempSync, readdirSync, rmSync, statSync, writeFileSync} from "node:fs";
import {tmpdir} from "node:os";
import {dirname, extname, join, posix, relative, sep} from "node:path";
import {fileURLToPath} from "node:url";
import {BRAND_KIT_FILE_NAME, BRAND_KIT_KEY, buildBrandKit} from "./brand-kit.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CDN_DIR = join(ROOT, "cdn");
const BUCKET = "franciscosolis";

/** How many uploads run at once. Each is its own Wrangler process, so this is mostly about startup time. */
const CONCURRENCY = 4;

const CONTENT_TYPES = {
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".webp": "image/webp",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".avif": "image/avif",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".pdf": "application/pdf",
  ".md": "text/markdown; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".json": "application/json",
  ".zip": "application/zip",
};

/**
 * A week, and deliberately not `immutable`: the keys are stable names, not content hashes, so a
 * corrected logo has to be able to replace the old one in every cache within a bounded time.
 */
const ASSET_CACHE_CONTROL = "public, max-age=604800";

/** The guide and the kit are documents that change with every edit to the brand, so an hour. */
const DOCUMENT_CACHE_CONTROL = "public, max-age=3600";

const dryRun = process.argv.includes("--dry-run");

const walk = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

const describe = (key, file) => {
  const extension = extname(key).toLowerCase();
  const contentType = CONTENT_TYPES[extension];
  if (!contentType) {
    throw new Error(`cdn/${key}: no content type for "${extension}" — add it to CONTENT_TYPES in scripts/cdn-sync.mjs`);
  }
  const document = extension === ".md" || extension === ".zip";
  return {
    key,
    file,
    contentType,
    cacheControl: document ? DOCUMENT_CACHE_CONTROL : ASSET_CACHE_CONTROL,
    /* A cross-origin `<a download>` is ignored by browsers, so the archive says so itself. */
    contentDisposition: extension === ".zip" ? `attachment; filename="${posix.basename(key)}"` : undefined,
  };
};

const put = ({key, file, contentType, cacheControl, contentDisposition}) =>
  new Promise((resolve, reject) => {
    const args = [
      "exec", "wrangler", "r2", "object", "put", `${BUCKET}/${key}`,
      "--remote",
      "--file", file,
      "--content-type", contentType,
      "--cache-control", cacheControl,
    ];
    if (contentDisposition) args.push("--content-disposition", contentDisposition);

    const child = spawn("pnpm", args, {cwd: ROOT, stdio: ["ignore", "pipe", "pipe"]});
    let output = "";
    child.stdout.on("data", (chunk) => (output += chunk));
    child.stderr.on("data", (chunk) => (output += chunk));
    child.on("error", reject);
    child.on("close", (code) =>
      code === 0 ? resolve() : reject(new Error(`upload of ${key} failed (exit ${code}):\n${output}`)),
    );
  });

const main = async () => {
  const objects = walk(CDN_DIR).map((file) => describe(relative(CDN_DIR, file).split(sep).join("/"), file));

  /* The kit is packed now, from the same files being uploaded, so the two can never disagree. */
  const scratch = mkdtempSync(join(tmpdir(), "cdn-sync-"));
  try {
    const kit = join(scratch, BRAND_KIT_FILE_NAME);
    writeFileSync(kit, buildBrandKit());
    objects.push(describe(BRAND_KIT_KEY, kit));

    for (const object of objects) {
      console.log(`${dryRun ? "would upload" : "uploading"} ${object.key} (${object.contentType}, ${object.cacheControl})`);
    }
    if (dryRun) return;

    const queue = [...objects];
    const worker = async () => {
      for (let next = queue.shift(); next; next = queue.shift()) await put(next);
    };
    await Promise.all(Array.from({length: CONCURRENCY}, worker));
    console.log(`${objects.length} objects uploaded to r2://${BUCKET}`);
  } finally {
    rmSync(scratch, {recursive: true, force: true});
  }
};

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
