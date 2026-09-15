#!/usr/bin/env node
/**
 * Rasterizes the FranciscoSolis mark into every generated brand asset: the favicon / app-icon set
 * under public/, and the mark's own SVG + PNG handoff files under public/brand/.
 *
 * The mark is two shapes on a 64×64 grid, so rendering it exactly is cheaper than pulling in a
 * rasterizer: this samples the geometry directly and writes PNGs with zlib. Keeping every mark
 * asset on one geometry is the point — the tile radius is a single ratio here, so it can never
 * drift between the favicon, the handoff PNGs and the React component. Re-run via
 * `pnpm brand:icons` after any change to the geometry below, and mirror it in
 * src/components/brand/brand-mark.tsx.
 */
import {deflateSync} from "node:zlib";
import {mkdirSync, writeFileSync} from "node:fs";
import {dirname, join} from "node:path";
import {fileURLToPath} from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "public");
const BRAND_SVG_DIR = join(OUT_DIR, "brand", "svg");
const BRAND_PNG_DIR = join(OUT_DIR, "brand", "png");

/* Geometry, on the 64×64 grid used by public/brand/svg/fs-mark.svg. */
const GRID = 64;
/**
 * Tile corner radius as a ratio of the tile's edge — 20%, uniform on all four corners and at every
 * size. It is a ratio rather than a fixed unit so the same curve holds whether the mark renders at
 * 16 px or 1024 px, and it stays under the ~22% masks iOS and Android apply on top of an app icon,
 * which is what made the old, rounder tile read as clipped once a platform re-cut it.
 * Where a platform applies its own mask or crop, ship the square variant instead of this one.
 */
const TILE_RADIUS_RATIO = 0.2;
const TILE_RADIUS = GRID * TILE_RADIUS_RATIO;
/* The tile carries the brand gradient: periwinkle at bottom-left → plum at top-right, 45°. */
const PERIWINKLE = [0x5a, 0x68, 0xc4];
const PLUM = [0x8a, 0x42, 0x70];
const PEAK = [[32, 14], [50, 50], [37.5, 50], [32, 39], [26.5, 50], [14, 50]];
/** Samples per axis, per pixel. 4×4 is enough to keep the peak's diagonals clean at 16 px. */
const SUPERSAMPLE = 4;
/** Maskable icons must keep their artwork inside the central 80% safe zone. */
const MASKABLE_SAFE_ZONE = 0.8;

/**
 * Tile shapes. `rounded` is the mark; `square` is the full-bleed tile for platforms that apply
 * their own rounding or crop; `circle` is the avatar for platforms that force a circular one.
 */
const insideTile = {
  square: () => true,
  rounded: (x, y) => {
    if (x < 0 || y < 0 || x > GRID || y > GRID) return false;
    const cx = Math.min(Math.max(x, TILE_RADIUS), GRID - TILE_RADIUS);
    const cy = Math.min(Math.max(y, TILE_RADIUS), GRID - TILE_RADIUS);
    const dx = x - cx;
    const dy = y - cy;
    return dx * dx + dy * dy <= TILE_RADIUS * TILE_RADIUS;
  },
  circle: (x, y) => {
    const dx = x - GRID / 2;
    const dy = y - GRID / 2;
    return dx * dx + dy * dy <= (GRID / 2) * (GRID / 2);
  },
};

const insidePolygon = (x, y, points) => {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i];
    const [xj, yj] = points[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
};

/**
 * Samples the brand gradient at a point given in unit coordinates of the tile's own box.
 *
 * The SVG runs it from (0, 1) to (1, 0) — bottom-left to top-right, 45° — so the parameter is the
 * projection onto that axis. Never reverse or re-angle it; see docs/BRAND.md.
 */
const gradientAt = (u, v, channel) => {
  const t = Math.min(Math.max((u - v + 1) / 2, 0), 1);
  return PERIWINKLE[channel] + (PLUM[channel] - PERIWINKLE[channel]) * t;
};

/**
 * Renders one icon as raw RGBA.
 *
 * @param size edge length in px
 * @param shape tile shape: "rounded" (the mark), "square" (full-bleed) or "circle" (avatar)
 * @param safeZone when true, shrinks the artwork into the central 80%, as Android's adaptive icons
 *   expect of a maskable icon
 */
const render = (size, {shape = "rounded", safeZone = false} = {}) => {
  const pixels = Buffer.alloc(size * size * 4);
  const step = 1 / SUPERSAMPLE;
  const samples = SUPERSAMPLE * SUPERSAMPLE;
  /* Grid units per output pixel; a safe-zone variant shrinks the artwork, so its scale differs. */
  const artScale = safeZone ? GRID / (size * MASKABLE_SAFE_ZONE) : GRID / size;
  const artOffset = safeZone ? (-(1 - MASKABLE_SAFE_ZONE) / 2) * size * artScale : 0;
  const withinTile = insideTile[shape];

  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      let tile = 0;
      let peak = 0;

      for (let sy = 0; sy < SUPERSAMPLE; sy++) {
        for (let sx = 0; sx < SUPERSAMPLE; sx++) {
          const gx = (px + (sx + 0.5) * step) * artScale + artOffset;
          const gy = (py + (sy + 0.5) * step) * artScale + artOffset;
          if (withinTile(gx, gy)) tile++;
          if (insidePolygon(gx, gy, PEAK)) peak++;
        }
      }

      /* The peak is white-on-gradient, so composite it over the tile before writing the pixel. */
      const tileAlpha = tile / samples;
      const peakAlpha = Math.min(peak / samples, tileAlpha);
      const white = peakAlpha;
      const fill = tileAlpha - peakAlpha;
      const alpha = tileAlpha;
      const at = (py * size + px) * 4;
      /* The gradient spans the tile, which is the whole canvas in every variant. */
      const u = (px + 0.5) / size;
      const v = (py + 0.5) / size;

      if (alpha > 0) {
        for (let c = 0; c < 3; c++) {
          pixels[at + c] = Math.round((white * 255 + fill * gradientAt(u, v, c)) / alpha);
        }
      }
      pixels[at + 3] = Math.round(alpha * 255);
    }
  }

  return pixels;
};

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

const chunk = (type, data) => {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([length, body, crc]);
};

const encodePng = (size, pixels) => {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; /* bit depth */
  ihdr[9] = 6; /* truecolor + alpha */

  /* One filter byte per scanline; filter 0 (none) compresses fine for flat artwork. */
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, {level: 9})),
    chunk("IEND", Buffer.alloc(0)),
  ]);
};

/** Packs PNG payloads into an ICO container, which browsers accept as of Vista. */
const encodeIco = (entries) => {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(1, 2); /* type: icon */
  header.writeUInt16LE(entries.length, 4);

  let offset = 6 + entries.length * 16;
  const directory = entries.map(({size, png}) => {
    const entry = Buffer.alloc(16);
    /* 256 is encoded as 0 in the single-byte width/height fields. */
    entry[0] = size % 256;
    entry[1] = size % 256;
    entry.writeUInt16LE(1, 4); /* color planes */
    entry.writeUInt16LE(32, 6); /* bits per pixel */
    entry.writeUInt32LE(png.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += png.length;
    return entry;
  });

  return Buffer.concat([header, ...directory, ...entries.map(({png}) => png)]);
};

const png = (size, options) => encodePng(size, render(size, options));

/* The mark's vector sources, emitted here so they carry the same geometry as the rasters. */
const GRADIENT_DEFS =
  '<defs><linearGradient id="fsg" x1="0" y1="1" x2="1" y2="0">' +
  '<stop offset="0" stop-color="#5a68c4"></stop><stop offset="1" stop-color="#8a4270"></stop>' +
  "</linearGradient></defs>";
const PEAK_PATH = '<path d="M32 14 L50 50 H37.5 L32 39 L26.5 50 H14 Z" fill="#fff"></path>';

const markSvg = (tile) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${GRID} ${GRID}" width="${GRID}" height="${GRID}">` +
  `${GRADIENT_DEFS}${tile}${PEAK_PATH}</svg>`;

const TILE_SVG = {
  rounded: `<rect width="${GRID}" height="${GRID}" rx="${TILE_RADIUS}" fill="url(#fsg)"></rect>`,
  square: `<rect width="${GRID}" height="${GRID}" fill="url(#fsg)"></rect>`,
  circle: `<circle cx="${GRID / 2}" cy="${GRID / 2}" r="${GRID / 2}" fill="url(#fsg)"></circle>`,
};

for (const dir of [OUT_DIR, BRAND_SVG_DIR, BRAND_PNG_DIR]) mkdirSync(dir, {recursive: true});

const written = [];
const write = (dir, name, buffer) => {
  writeFileSync(join(dir, name), buffer);
  written.push(`${join(dir, name).slice(ROOT.length + 1)} (${buffer.length} B)`);
};

/* Vector sources: the mark, the full-bleed square for platforms that mask, and the avatar. */
write(BRAND_SVG_DIR, "fs-mark.svg", Buffer.from(markSvg(TILE_SVG.rounded)));
write(BRAND_SVG_DIR, "fs-mark-square.svg", Buffer.from(markSvg(TILE_SVG.square)));
write(BRAND_SVG_DIR, "fs-avatar-circle.svg", Buffer.from(markSvg(TILE_SVG.circle)));

/* Handoff rasters, 4× for the mark and 8× for the avatar, matching the shipped brand package. */
write(BRAND_PNG_DIR, "fs-mark.png", png(1024));
write(BRAND_PNG_DIR, "fs-mark-square.png", png(1024, {shape: "square"}));
write(BRAND_PNG_DIR, "fs-avatar-circle.png", png(512, {shape: "circle"}));
for (const size of [16, 32, 64, 192, 512]) write(BRAND_PNG_DIR, `favicon-${size}.png`, png(size));

/* The vector favicon is the mark itself; emitting it here keeps it in step with the raster set. */
write(OUT_DIR, "favicon.svg", Buffer.from(markSvg(TILE_SVG.rounded)));
/*
 * iOS flattens an apple-touch-icon's transparency and then applies its own squircle, so a
 * pre-rounded tile comes back with dark, clipped corners. Ship the square variant and let the
 * platform cut the corners it wants.
 */
write(OUT_DIR, "apple-touch-icon.png", png(180, {shape: "square"}));
write(OUT_DIR, "icon-192.png", png(192));
write(OUT_DIR, "icon-512.png", png(512));
write(OUT_DIR, "icon-maskable-512.png", png(512, {shape: "square", safeZone: true}));
write(OUT_DIR, "favicon.ico", encodeIco([16, 32, 48].map((size) => ({size, png: png(size)}))));

console.log(`brand assets written:\n  ${written.join("\n  ")}`);
