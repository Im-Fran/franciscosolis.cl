import {AUTH_BASE_URL} from "@/lib/auth/config.ts";
import {webSession} from "@/lib/auth/session.ts";
import type {SessionStore} from "@/lib/auth/session.ts";
import type {ApiEnvelope, ApiErrorBody} from "@/lib/auth/types.ts";

/** An error answer from the API, carrying the status so callers can branch on 403 vs 404. */
export class AuthApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "AuthApiError";
    this.status = status;
  }
}

/** The network never reached the service — worth telling apart from a rejection by the service. */
export class AuthNetworkError extends Error {
  constructor(message = "network-error") {
    super(message);
    this.name = "AuthNetworkError";
  }
}

export type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  /** JSON request body. */
  json?: unknown;
  /**
   * `multipart/form-data` body, for the one endpoint that takes a file.
   *
   * The `Content-Type` is deliberately left unset when this is used: the browser has to write it
   * itself so it can append the boundary token, and a hand-written header would leave the service
   * parsing a body it cannot find the parts of.
   */
  form?: FormData;
  /** Send an access token. Off for the handful of public endpoints. */
  auth?: boolean;
  signal?: AbortSignal;
};

export type RequestFn = <T>(path: string, options?: RequestOptions) => Promise<T>;

/** How long a read may take before it counts as unreachable. Generous: this is a stall, not a SLA. */
const REQUEST_TIMEOUT_MS = 20_000;

/**
 * The human-readable half of an error body, whichever of the three shapes it arrives in.
 *
 * The API answers `{ error }` with a plain string for its own rejections, but the OAuth endpoints
 * follow RFC 6749 and put the sentence in `error_description` beside a machine code in `error`,
 * and a schema failure answers with an *array* of issues. Reading only the string case turned the
 * first into a bare `invalid_grant` and the other two into `Bad Request` — the service had said
 * "A valid email address is required" and the screen showed `HTTP 400`.
 */
const messageFrom = (body: Partial<ApiErrorBody>): string | null => {
  if (typeof body?.error_description === "string" && body.error_description) return body.error_description;

  const {error} = body ?? {};
  if (typeof error === "string" && error) return error;

  if (Array.isArray(error)) {
    const issues = error
      .map((issue) => (typeof issue === "string" ? issue : issue?.message))
      .filter((issue): issue is string => typeof issue === "string" && issue.length > 0);
    if (issues.length > 0) return [...new Set(issues)].join(" ");
  }

  return typeof body?.message === "string" && body.message ? body.message : null;
};

const parseError = async (response: Response) => {
  try {
    return messageFrom((await response.json()) as Partial<ApiErrorBody>) ?? fallbackMessage(response);
  } catch {
    /* Empty or non-JSON error bodies fall back to the status text. */
    return fallbackMessage(response);
  }
};

const fallbackMessage = (response: Response) => response.statusText || `HTTP ${response.status}`;

/**
 * Reads a body the service said was JSON.
 *
 * A truncated or rewritten payload — a proxy that timed out mid-stream, a captive portal — is a
 * fault of the hop, not of the session, so it is reported as one instead of letting V8's
 * `SyntaxError` walk up into an alert box reading "Expected ',' or '}' at position 29". 502 is
 * both accurate and what the layers above already read as "keep the session, show the fault".
 */
const parseJson = <T>(text: string): T => {
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new AuthApiError(502, "malformed-response");
  }
};

export type HttpClient = ReturnType<typeof createHttpClient>;

/**
 * A fetch wrapper for one service, authenticated with one application's session.
 *
 * `baseUrl` and `session` are separate on purpose: the CMS API lives under a different base than
 * the auth service, yet both are called with the tokens the CMS signed in with.
 */
export const createHttpClient = (baseUrl: string, session: SessionStore) => {
  const send = async (path: string, options: RequestOptions, token: string | null) => {
    const headers: Record<string, string> = {};
    if (options.json !== undefined) headers["Content-Type"] = "application/json";
    if (token) headers.Authorization = `Bearer ${token}`;

    const method = options.method ?? "GET";
    /*
     * A deadline, so a service that accepts the connection and then never answers reads as a
     * failure rather than as a spinner that never resolves — that is what left "Restoring your
     * session…" on screen for as long as the service cared to take.
     *
     * Reads only. Aborting a write mid-flight tells the caller nothing about whether it landed,
     * and a half-known write is worse than a slow one.
     */
    const deadline = method === "GET" ? AbortSignal.timeout(REQUEST_TIMEOUT_MS) : null;
    const signal =
      deadline && options.signal ? AbortSignal.any([options.signal, deadline]) : (deadline ?? options.signal);

    try {
      return await fetch(`${baseUrl}${path}`, {
        method,
        headers,
        body: options.form ?? (options.json === undefined ? undefined : JSON.stringify(options.json)),
        signal,
      });
    } catch (error) {
      /* The caller's own abort — an unmount, or changed inputs — is not a fault to report. */
      if (options.signal?.aborted) throw error;
      if (error instanceof DOMException && error.name === "TimeoutError") throw new AuthNetworkError();
      if (error instanceof DOMException && error.name === "AbortError") {
        throw deadline?.aborted ? new AuthNetworkError() : error;
      }
      throw new AuthNetworkError();
    }
  };

  /**
   * Calls the API and unwraps its `{ code, data }` envelope.
   *
   * A 401 on an authenticated call is retried once behind a token refresh: the service re-checks
   * the session on every request, so a token can stop being accepted before its own expiry.
   */
  const request = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
    const authenticated = options.auth !== false;
    const token = authenticated ? await session.getAccessToken() : null;

    /*
     * No token in hand — the store has none, or its refresh came back revoked. Sending the request
     * anyway is what put unauthenticated calls in front of the API: the service answered "A Bearer
     * access token is required" on every screen while the interface still believed it was signed
     * in, so the failure read as a broken client instead of as a session that had ended.
     */
    if (authenticated && !token) throw new AuthApiError(401, "session-expired");

    let response = await send(path, options, token);

    if (response.status === 401 && authenticated) {
      const outcome = await session.refreshSession();

      /* A refresh that never reached the service says nothing about the session; keep it and report. */
      if (outcome.status === "unavailable") throw new AuthNetworkError();
      if (outcome.status === "revoked") throw new AuthApiError(401, await parseError(response));

      response = await send(path, options, outcome.tokens.access_token);
      if (response.status === 401) {
        session.endSession();
        throw new AuthApiError(401, await parseError(response));
      }
    }

    if (!response.ok) throw new AuthApiError(response.status, await parseError(response));

    /* 204s and the bodiless 201s both arrive empty, so read as text before committing to JSON. */
    const text = response.status === 204 ? "" : await response.text();
    if (!text) return undefined as T;

    const body = parseJson<ApiEnvelope<T> | T>(text);
    return body && typeof body === "object" && "code" in body && "data" in body
      ? (body as ApiEnvelope<T>).data
      : (body as T);
  };

  /** Posts the `application/x-www-form-urlencoded` body the OAuth endpoints expect. */
  const postForm = async <T>(path: string, fields: Record<string, string>): Promise<T> => {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: "POST",
        headers: {"Content-Type": "application/x-www-form-urlencoded"},
        body: new URLSearchParams(fields),
      });
    } catch {
      throw new AuthNetworkError();
    }
    if (!response.ok) throw new AuthApiError(response.status, await parseError(response));
    return parseJson<T>(await response.text());
  };

  return {request, postForm};
};

/** The site's own client, talking to the auth service with the site's session. */
export const webHttp = createHttpClient(AUTH_BASE_URL, webSession);

export const request: RequestFn = webHttp.request;
export const postForm = webHttp.postForm;
