#!/usr/bin/env node
/**
 * Writes cdn/badges/index.json: every store badge the CDN serves, so a page — this site's or anyone
 * else's — can find one by what it says rather than by guessing its path.
 *
 * The badges follow cdn/badges/{action}/{store}/{locale}/{theme}.{svg,png}, and the index is read
 * straight off that tree, so a badge dropped in the right folder is listed the next time this runs.
 * Not every combination exists — Google Play publishes its badges in black only, and its
 * "Pre-register" badge as a PNG — which is exactly what the index is for: it lists what is there.
 *
 *   node scripts/badges-index.mjs          rewrite cdn/badges/index.json
 *   node scripts/badges-index.mjs --check  fail if the committed index is out of date
 *
 * scripts/cdn-sync.mjs runs the check before uploading, so a stale index is never published.
 */
import {readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, extname, join, relative, sep} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const CDN_DIR = join(ROOT, "cdn");
const BADGES_DIR = join(CDN_DIR, "badges");
export const BADGES_INDEX_FILE = join(BADGES_DIR, "index.json");

const BASE_URL = "https://cdn.franciscosolis.cl";
const FORMATS = new Set([".svg", ".png"]);

const walk = (dir) =>
  readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });

/** Rounded to two decimals: enough to keep the aspect ratio, short enough to read. */
const round = (value) => Math.round(value * 100) / 100;

/* The artwork's own size: `width`/`height` on the root element when it has them, else its viewBox. */
const svgSize = (file) => {
  const root = readFileSync(file, "utf8").match(/<svg\b[\s\S]*?>/)?.[0] ?? "";
  const attribute = (name) => root.match(new RegExp(`\\s${name}="([^"]*)"`))?.[1];
  const width = parseFloat(attribute("width"));
  const height = parseFloat(attribute("height"));
  if (width > 0 && height > 0) return {width: round(width), height: round(height)};
  const [, , viewWidth, viewHeight] = (attribute("viewBox") ?? "").trim().split(/[\s,]+/).map(Number);
  if (viewWidth > 0 && viewHeight > 0) return {width: round(viewWidth), height: round(viewHeight)};
  throw new Error(`${relative(ROOT, file)}: the root <svg> has neither width/height nor a viewBox`);
};

/* A PNG's IHDR chunk always comes first: width and height are the big-endian words at 16 and 20. */
const pngSize = (file) => {
  const bytes = readFileSync(file);
  return {width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20)};
};

export const buildBadgesIndex = () => {
  const badges = walk(BADGES_DIR)
    .filter((file) => FORMATS.has(extname(file).toLowerCase()))
    .map((file) => {
      const path = relative(CDN_DIR, file).split(sep).join("/");
      const parts = path.split("/");
      if (parts.length !== 5) {
        throw new Error(`cdn/${path}: badges go in badges/{action}/{store}/{locale}/{theme}.{svg,png}`);
      }
      const [, action, store, locale, name] = parts;
      const format = extname(name).slice(1).toLowerCase();
      const size = format === "svg" ? svgSize(file) : pngSize(file);
      return {
        path,
        url: `${BASE_URL}/${path}`,
        action,
        store,
        locale,
        theme: name.slice(0, -(format.length + 1)),
        format,
        ...size,
      };
    });

  return `${JSON.stringify({baseUrl: BASE_URL, badges}, null, 2)}\n`;
};

const main = () => {
  const index = buildBadgesIndex();
  if (process.argv.includes("--check")) {
    let committed = "";
    try {
      committed = readFileSync(BADGES_INDEX_FILE, "utf8");
    } catch {
      /* A missing index is just the most out-of-date one. */
    }
    if (committed !== index) {
      console.error("cdn/badges/index.json is out of date — run `pnpm badges:index` and commit the result");
      process.exitCode = 1;
    }
    return;
  }
  writeFileSync(BADGES_INDEX_FILE, index);
  console.log(`cdn/badges/index.json: ${JSON.parse(index).badges.length} badges`);
};

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) main();
