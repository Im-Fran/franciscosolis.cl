import {CUSTOM_APPS_BASE_URL} from "@/lib/custom-apps/config.ts";
import type {Release} from "@/lib/custom-apps/types.ts";

/** The slice of `t` these helpers need, so any namespace's translator can be handed in. */
type Translate = (key: string, options?: Record<string, unknown>) => string;

/**
 * A release's line — channel, platform and architecture — as one phrase. The line is what a release
 * competes within: the newest published release of a line is what a device on it is offered.
 */
export const releaseLine = (release: Pick<Release, "channel" | "platform" | "arch">, t: Translate) =>
  [
    t(`custom_apps:channels.${release.channel}`, {defaultValue: release.channel}),
    t(`custom_apps:platforms.${release.platform}`, {defaultValue: release.platform}),
    t(`custom_apps:arches.${release.arch}`, {defaultValue: release.arch}),
  ].join(" · ");

/**
 * Who uploaded a release. CI uploads read `ci:<tokenId>`; the token id is not worth showing whole,
 * so the prefix is turned into words and the id shortened.
 */
export const describeUploader = (value: string | null, t: Translate) => {
  if (!value) return null;
  if (value.startsWith("ci:")) return t("custom_apps:releases.uploaded_by_ci", {id: value.slice(3, 11)});
  return value;
};

/**
 * The service's lenient semantic version: an optional `v`, one to three numbers, an optional
 * pre-release and build. The same pattern the service checks, so the form refuses what it would.
 */
const SEMVER =
  /^v?(0|[1-9]\d*)(?:\.(0|[1-9]\d*))?(?:\.(0|[1-9]\d*))?(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;

export const isSemver = (value: string) => SEMVER.test(value.trim());

/**
 * Whether a release public key is what the service stores: base64 (standard or URL-safe) of exactly
 * 32 raw bytes. Checked here so a pasted PEM or a hex string is refused before it is sent; the
 * service checks again and answers 400.
 */
export const isReleasePublicKey = (value: string) => {
  const normalised = value.trim().replace(/-/g, "+").replace(/_/g, "/");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(normalised)) return false;
  try {
    return atob(normalised.padEnd(Math.ceil(normalised.length / 4) * 4, "=")).length === 32;
  } catch {
    return false;
  }
};

/** Where CI uploads to — the panel API's own base, not the ingest one. */
export const uploadUrl = (appId: string) => `${CUSTOM_APPS_BASE_URL}/v1/apps/${encodeURIComponent(appId)}/releases/upload`;

/** Generating the key pair, once, wherever the private key will live. */
export const KEYGEN_SNIPPET = [
  "openssl genpkey -algorithm ed25519 -out key.pem",
  "# The value for the panel (and for the app, to verify what it downloads):",
  "openssl pkey -in key.pem -pubout -outform DER | tail -c 32 | base64",
].join("\n");

/**
 * What a CI job runs to sign and upload one build: the signature is Ed25519 over the raw SHA-256
 * digest, base64, and the artifact is the request body. Written for this app, with placeholders
 * for what changes per build.
 */
export const uploadSnippet = (appId: string) =>
  [
    "# Ed25519 over the raw SHA-256 digest of the artifact, base64.",
    "openssl dgst -sha256 -binary dist/app-setup.msi > digest.bin",
    "openssl pkeyutl -sign -rawin -inkey key.pem -in digest.bin | base64 -w0 > signature.txt",
    "curl --fail-with-body -X POST \\",
    `  "${uploadUrl(appId)}?version=$VERSION&platform=windows&arch=x86_64&filename=app-setup.msi&channel=stable" \\`,
    '  -H "Authorization: Bearer $CUSTOM_APPS_CI_TOKEN" \\',
    '  -H "X-Signature: $(cat signature.txt)" \\',
    "  -H \"X-Sha256: $(sha256sum dist/app-setup.msi | cut -d' ' -f1)\" \\",
    "  --data-binary @dist/app-setup.msi",
  ].join("\n");

/**
 * Hands a blob to the browser as a download. The artifact sits behind the bearer token, so it is
 * fetched first and saved through an object URL — the same reason screenshots are — and the URL is
 * revoked once the click has been dispatched.
 */
export const saveBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.rel = "noopener";
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
};
