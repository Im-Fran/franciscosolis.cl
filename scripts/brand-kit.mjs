#!/usr/bin/env node
/**
 * Packs the brand kit — every handoff asset under public/brand/ plus the agent-facing BRAND.md —
 * into the single ZIP the /brand page offers for download.
 *
 * The archive is built from the files on disk at request/build time rather than committed as a
 * binary, so it can never go stale against the assets `pnpm brand:icons` regenerates. Writing the
 * container by hand is cheaper than a dependency: ZIP is a length-prefixed format over deflate,
 * and node:zlib already ships the only hard part.
 *
 * Run directly (`pnpm brand:kit`) to write a copy to disk for inspection; the site gets it from the
 * Vite plugin below, which serves it in dev and emits it into the bundle on build.
 */
import {deflateRawSync} from "node:zlib";
import {readFileSync, readdirSync, statSync, writeFileSync} from "node:fs";
import {dirname, join, posix} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const BRAND_DIR = join(ROOT, "public", "brand");

/** Asset folders that go into the kit, in the order they should read in a file listing. */
const ASSET_DIRS = ["svg", "png", "webp"];

/** The kit's file name, and the path the site serves it from. Both are shared with the UI. */
export const BRAND_KIT_FILE_NAME = "franciscosolis-brand-kit.zip";
export const BRAND_KIT_PATH = `brand/${BRAND_KIT_FILE_NAME}`;
export const BRAND_KIT_URL = `/${BRAND_KIT_PATH}`;

/** Extracting the kit should produce one folder, not scatter files into the user's Downloads. */
const KIT_ROOT = "franciscosolis-brand-kit";

/**
 * A fixed DOS timestamp (1980-01-01, the epoch of the format) instead of each file's mtime, so the
 * same assets always pack to the same bytes — a checkout or a CI cache cannot change the download.
 */
const DOS_TIME = 0;
const DOS_DATE = 0x0021;

const crcTable = Array.from({length: 256}, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const byte of buf) c = crcTable[(c ^ byte) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};

/**
 * Builds one entry's local header + payload and the central-directory record that points at it.
 * Deflate is only used when it actually pays: the PNGs are already deflate streams, so re-deflating
 * them costs bytes, and the spec's "stored" method exists exactly for that.
 */
const entry = (name, contents, offset) => {
  const deflated = deflateRawSync(contents, {level: 9});
  const stored = deflated.length >= contents.length;
  const payload = stored ? contents : deflated;
  const method = stored ? 0 : 8;
  const path = Buffer.from(name, "utf8");
  const crc = crc32(contents);

  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0); /* local file header signature */
  local.writeUInt16LE(20, 4); /* version needed: 2.0, deflate */
  local.writeUInt16LE(0x0800, 6); /* flags: UTF-8 file names */
  local.writeUInt16LE(method, 8);
  local.writeUInt16LE(DOS_TIME, 10);
  local.writeUInt16LE(DOS_DATE, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(payload.length, 18);
  local.writeUInt32LE(contents.length, 22);
  local.writeUInt16LE(path.length, 26);

  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0); /* central directory header signature */
  central.writeUInt16LE(20, 4); /* version made by */
  central.writeUInt16LE(20, 6); /* version needed */
  central.writeUInt16LE(0x0800, 8);
  central.writeUInt16LE(method, 10);
  central.writeUInt16LE(DOS_TIME, 12);
  central.writeUInt16LE(DOS_DATE, 14);
  central.writeUInt32LE(crc, 16);
  central.writeUInt32LE(payload.length, 20);
  central.writeUInt32LE(contents.length, 24);
  central.writeUInt16LE(path.length, 28);
  central.writeUInt32LE(offset, 42); /* offset of the local header */

  return {
    local: Buffer.concat([local, path, payload]),
    central: Buffer.concat([central, path]),
  };
};

const zip = (files) => {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const {name, contents} of files) {
    const {local, central} = entry(name, contents, offset);
    locals.push(local);
    centrals.push(central);
    offset += local.length;
  }

  const directory = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); /* end of central directory signature */
  end.writeUInt16LE(files.length, 8); /* entries on this disk */
  end.writeUInt16LE(files.length, 10); /* entries total */
  end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16); /* where the central directory starts */

  return Buffer.concat([...locals, directory, end]);
};

/** Every file the kit ships, as `{name, contents}` pairs already prefixed with the kit's folder. */
const collect = () => {
  const files = [
    {name: posix.join(KIT_ROOT, "BRAND.md"), contents: readFileSync(join(BRAND_DIR, "BRAND.md"))},
  ];

  for (const dir of ASSET_DIRS) {
    const from = join(BRAND_DIR, dir);
    for (const name of readdirSync(from).sort()) {
      const file = join(from, name);
      if (!statSync(file).isFile()) continue;
      files.push({name: posix.join(KIT_ROOT, dir, name), contents: readFileSync(file)});
    }
  }

  return files;
};

/** Packs the kit and returns the archive as a Buffer. */
export const buildBrandKit = () => zip(collect());

/**
 * Serves the kit at {@link BRAND_KIT_URL} in dev and preview, and emits it into the client bundle
 * on build. The archive is never written into public/, so it always reflects the assets on disk.
 */
export const brandKit = () => {
  const serve = (server) => {
    server.middlewares.use((req, res, next) => {
      const path = (req.url ?? "").split("?")[0];
      if (path !== BRAND_KIT_URL) return next();

      const archive = buildBrandKit();
      res.setHeader("Content-Type", "application/zip");
      res.setHeader("Content-Length", archive.length);
      res.setHeader("Content-Disposition", `attachment; filename="${BRAND_KIT_FILE_NAME}"`);
      res.end(archive);
    });
  };

  return {
    name: "franciscosolis:brand-kit",
    configureServer: serve,
    configurePreviewServer: serve,
    /* Client-only: the worker build shares these hooks and has no use for a download. */
    applyToEnvironment: (environment) => environment.name === "client",
    generateBundle() {
      this.emitFile({type: "asset", fileName: BRAND_KIT_PATH, source: buildBrandKit()});
    },
  };
};

/* `pnpm brand:kit` — writes the archive next to the assets it packs, for a look inside. */
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const archive = buildBrandKit();
  const out = join(ROOT, BRAND_KIT_FILE_NAME);
  writeFileSync(out, archive);
  console.log(`brand kit written: ${BRAND_KIT_FILE_NAME} (${archive.length} B, ${collect().length} files)`);
}
