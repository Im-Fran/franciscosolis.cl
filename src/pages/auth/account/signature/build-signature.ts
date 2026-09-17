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
  /** Absolute, because an email is read far away from this origin — a relative path is a broken image. */
  logo: "https://franciscosolis.cl/brand/png/fs-avatar-circle.png",
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
  email: string;
  /** Absolute URL of the person's picture. Empty falls back to the company mark. */
  picture: string;
  socials: SocialLink[];
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
const socialCell = (social: SocialLink) => {
  const href = safeUrl(social.url);
  const icon = faviconFor(social.url);
  if (!href || !icon) return "";

  const label = labelFor(social.url) ?? "";
  return (
    `<td style="padding:0 8px 0 0;">` +
    `<a href="${escapeHtml(href)}" style="text-decoration:none;">` +
    `<img src="${escapeHtml(icon)}" width="20" height="20" alt="${escapeHtml(label)}" title="${escapeHtml(label)}" ` +
    `style="display:block;width:20px;height:20px;border:0;border-radius:4px;"/>` +
    `</a></td>`
  );
};

/**
 * The signature itself.
 *
 * Both avatars are circled with `border-radius`, which every webmail honours and Outlook's Word
 * renderer does not — there it falls back to a square, which is why the pictures are also sized and
 * cropped to a square to begin with, so the fallback still looks deliberate.
 */
export const buildSignature = (data: SignatureData): string => {
  const name = data.name.trim() || data.email.trim();
  const email = data.email.trim();
  const picture = safeUrl(data.picture) ?? COMPANY.logo;

  const socials = data.socials.map(socialCell).join("");
  const socialRow = socials
    ? `<tr><td style="padding-top:12px;">` +
      `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
      `<tr>${socials}</tr></table></td></tr>`
    : "";

  return (
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" ` +
    `style="border-collapse:collapse;font-family:${FONT};color:${INK};font-size:14px;line-height:1.45;">` +
    `<tr>` +

    /*
     * Left column: the person's picture, circled. Both avatars carry an empty `alt` on purpose —
     * the name they stand for is in the cell beside them, so announcing it twice adds nothing, and
     * a picture a recipient's client has not loaded yet stays a 72px box instead of a block of alt
     * text that pushes the whole signature out of shape.
     */
    `<td width="72" style="width:72px;padding:0 18px 0 0;vertical-align:top;">` +
    `<img src="${escapeHtml(picture)}" width="72" height="72" alt="" ` +
    `style="display:block;width:72px;height:72px;border:0;border-radius:50%;object-fit:cover;"/>` +
    `</td>` +

    /* Right column: who you are, then who we are. The iris rule is the only brand chrome. */
    `<td style="padding:0 0 0 18px;vertical-align:top;border-left:2px solid ${IRIS};">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +

    `<tr><td style="font-size:16px;font-weight:700;color:${INK};padding:0 0 2px;">${escapeHtml(name)}</td></tr>` +
    (email
      ? `<tr><td style="font-size:13px;padding:0 0 10px;">${link(`mailto:${email}`, email, IRIS)}</td></tr>`
      : "") +

    `<tr><td style="border-top:1px solid ${RULE};padding-top:10px;">` +
    `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">` +
    `<tr>` +
    `<td width="36" style="width:36px;padding:0 10px 0 0;vertical-align:top;">` +
    `<img src="${COMPANY.logo}" width="36" height="36" alt="" ` +
    `style="display:block;width:36px;height:36px;border:0;border-radius:50%;"/>` +
    `</td>` +
    `<td style="vertical-align:top;font-size:13px;color:${MUTED};">` +
    `<div style="font-weight:600;color:${INK};">${escapeHtml(COMPANY.name)}</div>` +
    `<div>${escapeHtml(COMPANY.address)}</div>` +
    `<div>${link(COMPANY.website, COMPANY.website.replace(/^https?:\/\//, ""), IRIS)}</div>` +
    `</td>` +
    `</tr></table></td></tr>` +

    socialRow +

    `</table></td></tr></table>`
  );
};
