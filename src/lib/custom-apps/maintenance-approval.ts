import {CUSTOM_APPS_BASE_URL} from "@/lib/custom-apps/config.ts";

/**
 * The public half of maintenance approval, as the page at `/mantencion/:token` sees it.
 *
 * No login and no session: the link in the client's email is the credential, so nothing here reads
 * or sends a bearer token, and nothing touches the panel's auth stack — this module is imported by a
 * public page and must stay out of the panel's bundle. It calls the same service the panel does
 * (`VITE_CUSTOM_APPS_BASE_URL`, `api-dev` on the development build) with plain `fetch`, because a
 * refusal here carries more than a sentence: a 410 says *which way* the link is gone (`state`), and
 * the page words each case differently.
 */

/** Where a link stands. Only `open` can answer. */
export type ApprovalLinkState = "open" | "answered" | "closed" | "superseded" | "expired";

export type ApprovalDecision = "approved" | "auto_applied" | "rejected" | "cancelled" | "no_response";

export type ApprovalWindow = {
  id: string;
  starts_at: string;
  ends_at: string;
  position: number;
  /** Still in the future: it can be chosen. */
  available: boolean;
};

export type ApprovalView = {
  title: string;
  description: string;
  estimated_minutes: number;
  kind: "normal" | "security";
  app_name: string | null;
  company_name: string | null;
  status: string;
  state: ApprovalLinkState;
  answerable: boolean;
  expires_at: string | null;
  windows: ApprovalWindow[];
  outcome: {
    decision: ApprovalDecision;
    window: ApprovalWindow | null;
    rejection_reason: string | null;
    responded_at: string | null;
    /** Whether the answer came through this very link. */
    answered_here: boolean;
  } | null;
};

/** What went wrong, sorted into the cases the page has words for. */
export type ApprovalErrorKind = "not_found" | "gone" | "invalid" | "rate_limited" | "network" | "unexpected";

export class ApprovalError extends Error {
  readonly kind: ApprovalErrorKind;
  readonly status: number | null;
  /** On a 410: which way the link is gone. */
  readonly state: ApprovalLinkState | null;

  constructor(kind: ApprovalErrorKind, message: string, status: number | null = null, state: ApprovalLinkState | null = null) {
    super(message);
    this.name = "ApprovalError";
    this.kind = kind;
    this.status = status;
    this.state = state;
  }
}

/** The service's limits on what the page sends, mirrored so the form refuses before the request. */
export const APPROVAL_LIMITS = {maxReasonLength: 1000, maxNameLength: 120} as const;

const TIMEOUT_MS = 20_000;

const base = (token: string) => `${CUSTOM_APPS_BASE_URL}/v1/public/maintenances/${encodeURIComponent(token)}`;

const kindOf = (status: number): ApprovalErrorKind => {
  if (status === 404) return "not_found";
  if (status === 410) return "gone";
  if (status === 400 || status === 422) return "invalid";
  if (status === 429) return "rate_limited";
  return "unexpected";
};

const call = async (url: string, init: {method?: "GET" | "POST"; json?: unknown; signal?: AbortSignal} = {}) => {
  const method = init.method ?? "GET";
  const deadline = method === "GET" ? AbortSignal.timeout(TIMEOUT_MS) : null;
  const signal = deadline && init.signal ? AbortSignal.any([init.signal, deadline]) : (deadline ?? init.signal);
  let response: Response;
  try {
    response = await fetch(url, {
      method,
      headers: init.json === undefined ? undefined : {"Content-Type": "application/json"},
      body: init.json === undefined ? undefined : JSON.stringify(init.json),
      /* The link is the credential: never send cookies, never leak the path in a Referer. */
      credentials: "omit",
      referrerPolicy: "no-referrer",
      signal,
    });
  } catch (cause) {
    if (init.signal?.aborted) throw cause;
    throw new ApprovalError("network", "network");
  }

  type Body = {data?: ApprovalView; error?: unknown; message?: unknown; state?: unknown};
  const body = await response.json().then(
    (value: unknown) => (value && typeof value === "object" ? (value as Body) : null),
    () => null,
  );

  if (!response.ok) {
    const message = typeof body?.error === "string" ? body.error : typeof body?.message === "string" ? body.message : response.statusText;
    const state = typeof body?.state === "string" ? (body.state as ApprovalLinkState) : null;
    throw new ApprovalError(kindOf(response.status), message || `HTTP ${response.status}`, response.status, state);
  }
  if (!body?.data) throw new ApprovalError("unexpected", "malformed-response", response.status);
  return body.data;
};

/** Tokens are `mnt_` and 43 base64url characters; anything else cannot be a link, and is not asked. */
export const looksLikeToken = (token: string) => /^mnt_[A-Za-z0-9_-]{43}$/.test(token);

export const maintenanceApproval = {
  /** What the link shows. A link that can no longer answer still reads, with `state` saying why. */
  get: (token: string, signal?: AbortSignal) => call(base(token), {signal}),

  /** Schedules it in that window. Every link of the request stops answering. */
  approve: (token: string, body: {window_id: string; name?: string}) =>
    call(`${base(token)}/approve`, {method: "POST", json: body}),

  /** Sends it back with a reason, so it can be rescheduled. */
  reject: (token: string, body: {reason: string; name?: string}) => call(`${base(token)}/reject`, {method: "POST", json: body}),
};
