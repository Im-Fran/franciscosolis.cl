/**
 * The corporate email signature, as HTML an email client will actually keep.
 *
 * Mail clients are not browsers: Gmail strips `<style>` blocks, Outlook renders through Word and
 * ignores flexbox, grid and most of `display`, and every one of them rewrites the markup it is
 * pasted. What survives all of them is the layout email has used for twenty years — nested tables
 * with every rule inline — so that is what this builds, rather than the site's own components.
 *
 * The output is a string on purpose. It is never mounted as React: it goes to the clipboard as
 * `text/html` for the person to paste into Gmail or Outlook, and the preview beside the form
 * renders this very same string, so what is previewed is what is pasted.
 */

/** The company block, which is the same for everyone who can see this section. */
export const COMPANY = {
  name: "FranciscoSolis E.I.R.L.",
  address: "Av. Irarrázaval 2401 Oficina 607, Ñuñoa",
  website: "https://franciscosolis.cl",
  /**
   * Stands in for a picture the person has not set. It is not drawn beside the company's name —
   * one circled mark at the top of a signature is enough — so this is the only place it appears.
   *
   * Absolute, because an email is read far away from this origin: a relative path is a broken image.
   */
  logo: "https://franciscosolis.cl/brand/png/fs-avatar-circle.png",
  /**
   * The company's own profiles, which are the same wherever this signature is pasted.
   *
   * They seed the second list rather than replacing it: the form still owns what ends up in the
   * signature, so adding the company somewhere new is one field on the screen and not a release,
   * and "use my profile" puts this canonical set back.
   */
  socials: ["https://www.linkedin.com/company/franciscosolis"],
} as const;

/** Only accounts on the company domain have a corporate signature to generate. */
export const COMPANY_DOMAIN = "franciscosolis.cl";

/** Brand ink, iris and muted grey, taken from the palette in `docs/BRAND.md`. */
const INK = "#1e1e1e";
const IRIS = "#75549c";
const MUTED = "#6d6779";
const RULE = "#e8e4ee";

const FONT =
  "'Segoe UI', -apple-system, BlinkMacSystemFont, 'Helvetica Neue', Arial, sans-serif";

export type SocialLink = {
  /** Stable across edits and reorders, so a row keeps its focus while it is being typed into. */
  id: string;
  url: string;
};

export type SignatureData = {
  name: string;
  /** A role, a field or a short quote — one line under the name. Empty renders nothing. */
  tagline: string;
  email: string;
  /** Absolute URL of the person's picture. Empty falls back to the company mark. */
  picture: string;
  /** Yours: rendered under your address, where a recipient looks for the person. */
  personSocials: SocialLink[];
  /** The company's: rendered under the website, where a recipient looks for the business. */
  companySocials: SocialLink[];
};

/** True when this address belongs to the company — the gate for the whole section. */
export const isCompanyEmail = (email: string | null | undefined) =>
  typeof email === "string" && email.toLowerCase().trim().endsWith(`@${COMPANY_DOMAIN}`);

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

/**
 * The URL, or null when it is not one this signature is willing to link.
 *
 * Only `http(s)` and `mailto` get through: a signature is pasted into other people's mailboxes, and
 * a `javascript:` or `data:` href reaching one of them is the one way this form could do harm.
 */
export const safeUrl = (value: string): string | null => {
  const trimmed = value.trim();
  if (!trimmed) return null;

  /* A bare host is what people paste — read it as https rather than refusing it. A path is not a
   * host, though: prefixing `/foto.webp` would silently turn the file name into a domain. */
  const hasScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed);
  if (!hasScheme && trimmed.startsWith("/")) return null;

  const candidate = hasScheme ? trimmed : `https://${trimmed}`;

  try {
    const url = new URL(candidate);
    if (url.protocol === "mailto:") return url.toString();

    /*
     * A host is required, not just a scheme: `/foto.webp` is a path this site can resolve and a
     * mailbox on the other side of the world cannot, and reading it as `https:///foto.webp` would
     * put a permanently broken image in someone's signature rather than falling back to the mark.
     */
    return ["http:", "https:"].includes(url.protocol) && url.hostname ? url.toString() : null;
  } catch {
    return null;
  }
};

/** The host a link points at, without `www.` — the key the favicon and the label are read from. */
export const hostOf = (value: string): string | null => {
  const url = safeUrl(value);
  if (!url) return null;

  try {
    return new URL(url).hostname.replace(/^www\./i, "") || null;
  } catch {
    return null;
  }
};

/**
 * The icon for a link, from the host alone.
 *
 * Every network would otherwise need its own asset and a mapping to keep in step; a favicon service
 * means a link to anything at all arrives with the right icon, including whatever network exists
 * next year.
 */
export const faviconFor = (value: string): string | null => {
  const host = hostOf(value);
  return host ? `https://favicon.is/${host}` : null;
};

/** `linkedin.com` → `Linkedin`: a readable name for the icon's `alt`, with no table to maintain. */
export const labelFor = (value: string): string | null => {
  const host = hostOf(value);
  if (!host) return null;

  const [name] = host.split(".");
  return name ? name.charAt(0).toUpperCase() + name.slice(1) : host;
};

const link = (href: string, text: string, color: string, extra = "") =>
  `<a href="${escapeHtml(href)}" style="color:${color};text-decoration:none;${extra}">${escapeHtml(text)}</a>`;

/** One favicon in its own cell, so the row survives clients that collapse inline spacing. */
const socialCell = (social: SocialLink, size: number) => {
  const href = safeUrl(social.url);
  const icon = faviconFor(social.url);
  if (!href || !icon) return "";

  const label = labelFor(social.url) ?? "";
  return (
    `<td style="padding:0 8px 0 0;">` +
    `<a href="${escapeHtml(href)}" style="text-decoration:none;">` +
    `<img src="${escapeHtml(icon)}" width="${size}" height="${size}" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" ` +
    `style="display:block;width:${size}px;height:${size}px;border:0;border-radius:4px;"/>` +
    `</a></td>`
  );
};

/**
 * A row of favicons, or nothing at all when none of the links are usable.
 *
 * It is its own one-row table rather than a run of inline anchors: a `<td>` per icon is the only
 * spacing a mail client cannot collapse, and the row then sits wherever it is dropped — under the
 * person's address in the outer table, under the website inside the company cell.
 */
const socialRow = (socials: SocialLink[], size: number) => {
  const cells = socials.map((social) => socialCell(social, size)).join("");
  if (!cells) return "";

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr>${cells}</tr></table>`
  );
};

/**
 * The signature itself.
 *
 * The one picture is circled with `border-radius`, which every webmail honours and Outlook's Word
 * renderer does not — there it falls back to a square, which is why the picture is also sized and
 * cropped to a square to begin with, so the fallback still looks deliberate.
 *
 * That circle only stays a circle while the box stays square, and a plain `width`/`height` pair is
 * not enough: a stylesheet rule as ordinary as `img { max-width: 100% }` — Tailwind's own preflight
 * ships it, and webmail clients have their own — shrinks the width inside a narrow column while the
 * height stays put, and the mark reads as an oval. Pinning both axes with `min-`/`max-` leaves
 * nothing for such a rule to squeeze, and `object-fit` then crops a non-square photo instead of
 * stretching it wherever it is honoured.
 */
export const buildSignature = (data: SignatureData): string => {
  const name = data.name.trim() || data.email.trim();
  const tagline = data.tagline.trim();
  const email = data.email.trim();
  const picture = safeUrl(data.picture) ?? COMPANY.logo;

  /*
   * Two rows of links, each under what it belongs to: yours under your address, the company's under
   * the website. A recipient looking for the person and a recipient looking for the business read
   * different halves of a signature, and one mixed row makes them guess which icon is which.
   */
  const personRow = socialRow(data.personSocials, 20);
  const companyRow = socialRow(data.companySocials, 18);

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;font-family:${FONT};color:${INK};font-size:14px;line-height:1.45;">` +
    `<tr>` +

    /*
     * Left column: the person's picture, circled. Its `alt` is empty on purpose — the name it
     * stands for is in the cell beside it, so announcing it twice adds nothing, and a picture a
     * recipient's client has not loaded yet stays a 72px box instead of a block of alt text that
     * pushes the whole signature out of shape.
     */
    `<td width="72" style="width:72px;min-width:72px;padding:0 18px 0 0;vertical-align:top;">` +
    `<img src="${escapeHtml(picture)}" width="72" height="72" alt="" ` +
    `style="display:block;width:72px;min-width:72px;max-width:72px;height:72px;min-height:72px;max-height:72px;` +
    `border:0;border-radius:50%;object-fit:cover;object-position:center;"/>` +
    `</td>` +

    /* Right column: who you are, then who we are. The iris rule is the only brand chrome. */
    `<td style="padding:0 0 0 18px;vertical-align:top;border-left:2px solid ${IRIS};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +

    `<tr><td style="font-size:16px;font-weight:700;color:${INK};padding:0 0 2px;">${escapeHtml(name)}</td></tr>` +

    /*
     * The tagline, when there is one: a role, or a line the person wants read under their name. It
     * is set in muted grey rather than ink so it reads as a caption to the name above it and not as
     * a second name, and it sits above the address because that is the order a recipient reads —
     * who you are, what you do, how to reach you.
     */
    (tagline
      ? `<tr><td style="font-size:13px;color:${MUTED};padding:0 0 ${email ? "4" : personRow ? "8" : "10"}px;">` +
        `${escapeHtml(tagline)}</td></tr>`
      : "") +
    (email
      ? `<tr><td style="font-size:13px;padding:0 0 ${personRow ? "8" : "10"}px;">` +
        `${link(`mailto:${email}`, email, IRIS)}</td></tr>`
      : "") +
    (personRow ? `<tr><td style="padding:0 0 10px;">${personRow}</td></tr>` : "") +

    /*
     * The company block carries no mark of its own. The signature already opens with a circled
     * picture, and a second circle a few lines under it read as a second avatar rather than as the
     * company — with both marks loading over the network, an unloaded pair read as damage. The name
     * set in ink above the address does the same work in one line, and the block now starts at the
     * same left edge as everything above it.
     */
    `<tr><td style="border-top:1px solid ${RULE};padding-top:10px;font-size:13px;color:${MUTED};">` +
    `<div style="font-weight:600;color:${INK};">${escapeHtml(COMPANY.name)}</div>` +
    `<div>${escapeHtml(COMPANY.address)}</div>` +
    `<div>${link(COMPANY.website, COMPANY.website.replace(/^https?:\/\//, ""), IRIS)}</div>` +
    (companyRow ? `<div style="padding-top:6px;">${companyRow}</div>` : "") +
    `</td></tr>` +

    `</table></td></tr></table>`
  );
};
