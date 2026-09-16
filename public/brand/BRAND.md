# FranciscoSolis — Brand Kit

**Read this file before you place, resize, recolor, or regenerate anything in this kit.**

This document is written for AI assistants and coding agents (and for the humans reviewing their
output). It is deliberately literal: every rule below is a rule you can check mechanically against
the file you are about to ship. The live, rendered version of this guide is
<https://franciscosolis.cl/brand>; the canonical machine copy is
<https://franciscosolis.cl/brand/BRAND.md>.

Owner: Francisco Solís — <https://franciscosolis.cl>. The assets in this kit may be used to
reference or link to FranciscoSolis. They may not be used to imply endorsement, to brand a product
that is not FranciscoSolis, or as part of another mark or logo.

---

## 0. The three rules that break the brand most often

1. **Never redraw or regenerate the mark.** Do not trace it, do not ask an image model to "make a
   similar icon", do not rebuild the tile with CSS `border-radius` + a gradient + a triangle. Ship
   one of the files in this kit, byte for byte.
2. **Never recolor the tile or the peak.** The tile is the brand gradient; the peak is `#FFFFFF`.
   If you need a single color, use the supplied mono files (`fs-mark-mono-ink`,
   `fs-mark-mono-white`) — do not flatten the gradient yourself.
3. **Never re-round an already-rounded tile.** Where a platform applies its own mask or crop
   (iOS home screen, app stores, most social avatars), upload `fs-mark-square`. Uploading the
   rounded `fs-mark` there rounds it twice and the corners come back visibly clipped.

---

## 1. What is in this kit

```
BRAND.md                  ← this file
svg/                      ← source of truth, vector, infinitely scalable
png/                      ← raster, transparent background, 4× handoff sizes + favicon set
webp/                     ← same artwork as png/, web-optimized
```

Every name below exists in all three folders (except the favicon set, which is PNG only):

| File | What it is | Use it for |
|---|---|---|
| `fs-lockup-horizontal` | Mark + wordmark, side by side, dark text | Website headers, docs, email signatures, README banners — on **light** backgrounds |
| `fs-lockup-horizontal-dark` | Same lockup, light text | The same placements, on **dark** backgrounds |
| `fs-lockup-vertical` | Mark above wordmark, dark text | Square or near-square space, splash screens — on **light** backgrounds |
| `fs-lockup-vertical-dark` | Same, light text | The same, on **dark** backgrounds |
| `fs-mark` | The rounded gradient tile alone | App icon, favicon, avatar — where **nothing** re-cuts the corners |
| `fs-mark-square` | Full-bleed tile, no rounding | Anywhere the platform rounds or crops the icon itself |
| `fs-mark-mono-ink` | Single-color mark, `#1E1E1E` | Print, engraving, watermarks, faxes — on light |
| `fs-mark-mono-white` | Single-color mark, `#FFFFFF` | The same, on dark |
| `fs-avatar-circle` | Circular crop of the tile | Platforms that force a circular avatar and offer no square option |
| `png/favicon-16.png` … `-512.png` | The rounded mark at 16, 32, 64, 192, 512 px | Favicon and PWA icon sets |

### Which format do I pick?

| Context | Format |
|---|---|
| Web page, app UI, anything that can render vectors | `svg/` — but read §6 first, the lockup SVGs have a font trap |
| Web page where payload matters and the browser is modern | `webp/` |
| Anything else: docs, slides, email, print, app-store upload, README on GitHub | `png/` |
| Favicon / PWA manifest | `png/favicon-*.png` |

---

## 2. Decision table: "which file do I use?"

Answer in this order and stop at the first match.

| Situation | File |
|---|---|
| The platform will round or crop my icon (iOS, Android adaptive, app stores, Slack, Discord, most social profiles) | `fs-mark-square` |
| The platform forces a **circle** and gives me no square option | `fs-avatar-circle` |
| I need an icon and nothing will re-cut it (favicon, in-app icon, a tile I control) | `fs-mark` (or `png/favicon-<size>.png` at an exact pixel size) |
| I can only print or render one color | `fs-mark-mono-ink` on light, `fs-mark-mono-white` on dark |
| I have a wide space and want the name visible | `fs-lockup-horizontal` (light bg) / `-dark` (dark bg) |
| I have a square-ish space and want the name visible | `fs-lockup-vertical` (light bg) / `-dark` (dark bg) |
| I am under 24 px of height, or under 120 px of width | Drop the wordmark — use `fs-mark`, never a squeezed lockup |

Choosing the light vs. dark variant is decided by the **background you are placing it on**, not by
the user's theme setting. If the surface is `#1E1E1E`-ish, use `-dark`. If your UI has both themes,
ship both files and swap them with `prefers-color-scheme` / your theme class.

---

## 3. Minimum sizes and clear space

These are hard floors. Below them the peak's shoulders close up and the tile radius eats the stroke.

| Rule | Value |
|---|---|
| Minimum mark size | **16 px** (4.23 mm @ 96 dpi) |
| Minimum horizontal lockup height | **24 px** (6.35 mm) |
| Minimum vertical lockup width | **120 px** (31.75 mm) |
| Clear space on all four sides | **½ the mark's height** (32 px when the mark is 64 px) |
| Tile → wordmark gap inside a lockup | 0.28 × mark height (18 px at 64 px) — already baked into the lockup files |

Clear space scales with the mark: at a 24 px mark it is 12 px, at 128 px it is 64 px. Nothing —
text, rules, other logos, photo edges — enters that box. If the container's own padding already
meets the floor, do not add more; the requirement is a minimum, not a second margin.

Scale **proportionally, always**. Never set both `width` and `height` to unrelated values, never
`object-fit: fill`, never rotate, skew, or mirror the artwork.

---

## 4. Color tokens

| Token | Hex | RGB | Use |
|---|---|---|---|
| `brand/gradient` | 45°, `#5A68C4` → `#8A4270` | — | Tile fill and hero surfaces only |
| `brand/periwinkle-500` | `#5A68C4` | 90 104 196 | Gradient start (bottom-left) |
| `brand/plum-500` | `#8A4270` | 138 66 112 | Gradient end (top-right) |
| `brand/iris-500` | `#75549C` | 117 84 156 | Accent: "Francisco", buttons, links — on light |
| `brand/iris-300` | `#B298D6` | 178 152 214 | The same accent, on dark |
| `brand/iris-050` | `#F4F1F9` | 244 241 249 | Tinted light surfaces |
| `neutral/ink` | `#1E1E1E` | 30 30 30 | "Solis", body text, dark surfaces |
| `neutral/paper` | `#FAFAFA` | 250 250 250 | Light backgrounds |

CSS for the gradient, verbatim:

```css
background: linear-gradient(45deg, #5A68C4, #8A4270);
```

The gradient always runs periwinkle (bottom-left) → plum (top-right) at 45°. Do not reverse it, do
not change the angle, do not add stops, and never apply it to the wordmark text.

### Contrast (WCAG 2.1, normal text)

| Pairing | Ratio | Level |
|---|---|---|
| ink on paper | 16.0:1 | AAA |
| iris-500 on paper | 5.7:1 | AA |
| white on iris-500 | 6.0:1 | AA |
| white on plum-500 | 6.8:1 | AA |
| white on periwinkle-500 | 5.0:1 | AA |
| white on gradient (worst stop) | 5.0:1 | AA |
| iris-300 on ink | 6.6:1 | AA |
| **iris-500 on ink** | **2.8:1** | **FAILS — use iris-300 on dark instead** |

Any pairing not in this table is not approved. Do not invent one.

---

## 5. The name and the wordmark

The name is **FranciscoSolis**: one word, two capitals, no space, no hyphen, no line break between
"Francisco" and "Solis". In running prose the person's name is **Francisco Solís** (with the
accent); the brand/wordmark is the unspaced form.

- Typeface: **Sora SemiBold (600)**, letter-spacing **−2%**. Sora is the wordmark face only — the
  product UI runs on Inter.
- Two tones: "Francisco" takes the accent (`#75549C` on light, `#B298D6` on dark), "Solis" takes
  ink/paper. Accent exactly one word, never both, never neither.
- Never set the wordmark in another font to "match" your document. Use the supplied lockup files.
- Never apply the gradient to the wordmark text.

---

## 6. Using the assets in code

### The lockup SVG font trap — read this before you `<img src="…lockup….svg">`

The lockup SVGs set the wordmark as SVG `<text>` in `font-family="Sora, …"`, which resolves only
against fonts installed on the rendering machine. Anywhere Sora is not installed — most browsers,
most servers, most CI screenshot runners — the wordmark silently falls back to a system sans and
loses its shape and metrics, and you will not notice unless you look.

So:

- **In a web page or app**, use `png/` or `webp/` lockups (the type is baked in), or compose the
  lockup yourself: the mark SVG plus real text in a webfont-loaded Sora.
- **In design tools, docs and handoff**, the lockup SVGs are correct — install Sora first.
- The **mark** SVGs (`fs-mark`, `fs-mark-square`, `fs-avatar-circle`, and both mono marks) contain
  no text and are safe to use anywhere.

### HTML

```html
<!-- Icon: pick the size you actually render at, don't scale 512 down to 32 -->
<img src="/brand/png/favicon-64.png" width="32" height="32" alt="FranciscoSolis" />

<!-- Lockup, swapping on the surface it sits on -->
<picture>
  <source srcset="/brand/webp/fs-lockup-horizontal-dark.webp" media="(prefers-color-scheme: dark)" />
  <img src="/brand/webp/fs-lockup-horizontal.webp" alt="FranciscoSolis" height="32" />
</picture>
```

### Favicon / PWA

```html
<link rel="icon" href="/brand/png/favicon-32.png" sizes="32x32" />
<link rel="icon" href="/brand/png/favicon-192.png" sizes="192x192" />
<link rel="apple-touch-icon" href="/brand/png/fs-mark-square.png" />
```

`apple-touch-icon` must be the **square** file: iOS flattens the icon's transparency and then
applies its own squircle, so a pre-rounded tile comes back with dark, clipped corners. Android
maskable icons are square too, with the artwork inside the central 80% safe zone.

### Alt text and accessibility

The accessible name is the single string `FranciscoSolis` — never "Francisco Solis logo",
never split across two elements. When the lockup sits next to the site name in text, the image is
decorative: `alt=""` (or `aria-hidden="true"`) so screen readers do not read the name twice.

### Inside this repository / site

The site itself does **not** link these files from markup. It renders `BrandMark` and `BrandLockup`
from `src/components/brand/`, which draw the tile inline and set the wordmark as real text in the
loaded webfont. If you are an agent working in the `franciscosolis.cl` codebase, use those
components; reach for the files in this kit only for external handoff.

```tsx
import {BrandLockup, BrandMark} from "@/components/brand";

<BrandLockup tone="dark" />              {/* header lockup on a dark surface */}
<BrandLockup variant="vertical" />       {/* square placements */}
<BrandMark size={24} />                  {/* mark alone */}
<BrandMark mono="ink" size={24} />       {/* single-color mark: "ink" or "white" */}
<BrandMark shape="square" size={48} />   {/* platforms that round or crop it themselves */}
<BrandMark shape="circle" size={48} />   {/* forced circular crops */}
```

---

## 7. Do / Don't

**Do**

- Ship the supplied files, unmodified.
- Keep the peak white on the tile, at every size.
- Accent exactly one word: Francisco.
- Hold clear space: half the mark's height on all four sides.
- Pick the light or dark variant from the background, not from the theme toggle.
- Use the mono marks where only one color is available.
- Use the square variant wherever the platform masks or crops.

**Don't**

- Stretch, squash, rotate, skew, mirror, or crop the mark.
- Recolor the tile, flatten the gradient, or swap in a flat fill.
- Reverse or re-angle the gradient, or apply it to the wordmark.
- Add effects: shadows, glows, strokes, bevels, outlines, borders.
- Place the mark on a busy photo or a low-contrast background.
- Put the mark inside another shape (a circle, a badge, a ring) — use `fs-avatar-circle`.
- Add a space, a hyphen, or different casing to the name.
- Redraw, re-trace, or AI-generate a "close enough" version of any of this.

---

## 8. Checklist before you ship

- [ ] The file came from this kit and was not edited.
- [ ] Format fits the context (§1), and the variant fits the background (§2).
- [ ] Scaled proportionally, at or above the minimum size (§3).
- [ ] Clear space is respected on all four sides (§3).
- [ ] If a platform masks the icon, the **square** file was uploaded (§0.3).
- [ ] Any brand color used appears in the token table, and the pairing is in the contrast table (§4).
- [ ] The name reads `FranciscoSolis`, unspaced, un-hyphenated, correctly cased (§5).
- [ ] If an SVG lockup is rendered anywhere Sora may not be installed, it was swapped for PNG/WEBP (§6).
- [ ] The accessible name is exactly `FranciscoSolis`, or the image is marked decorative (§6).

When a rule here does not cover your case, do not improvise: use the mark alone on a plain
background at a safe size, and ask a human.
