import {WEB_AUTH_CONFIG, redirectUri} from "@/lib/auth/config.ts";
import type {AuthClientConfig} from "@/lib/auth/config.ts";
import {authApi} from "@/lib/auth/api.ts";
import type {AuthApi} from "@/lib/auth/api.ts";
import {AuthApiError, webHttp} from "@/lib/auth/client.ts";
import type {HttpClient} from "@/lib/auth/client.ts";
import {challengeFor, randomToken} from "@/lib/auth/pkce.ts";
import {webSession} from "@/lib/auth/session.ts";
import type {SessionStore} from "@/lib/auth/session.ts";
import type {TokenResponse} from "@/lib/auth/types.ts";

/**
 * The authorization code flow with PKCE, end to end.
 *
 * There is one way in and it is the same for every application on this origin: hand the browser to
 * the issuer's `GET /oauth/authorize`, which parks the request and takes it to the hosted sign-in
 * screen at `/apps/auth`. That screen owns the providers — the magic link and Google alike — so no
 * client here starts one itself, and gaining a provider is a change to the deployment rather than
 * to every front-end that signs in against it.
 */

export type AuthFlow = ReturnType<typeof createAuthFlow>;

export const createAuthFlow = (
  config: AuthClientConfig,
  session: SessionStore,
  http: HttpClient,
  api: AuthApi,
) => {
  const {storage} = session;

  const beginTransaction = async (provider: string, returnTo: string) => {
    const codeVerifier = randomToken();
    const transaction = {
      state: randomToken(16),
      code_verifier: codeVerifier,
      provider,
      return_to: returnTo,
      created_at: Date.now(),
    };
    storage.writeTransaction(transaction);
    return {transaction, codeChallenge: await challengeFor(codeVerifier)};
  };

  /**
   * Hands the browser to the authorization server itself, the way any other relying party would.
   *
   * This is the single sign-on entry point: `GET /oauth/authorize` validates the request, parks it
   * and redirects to the hosted sign-in screen, which offers whichever providers the deployment
   * actually has configured and resumes the parked request. The application therefore ships no
   * credential form of its own — it starts a standard authorization code request and waits at its
   * callback route, exactly as it would against any other OpenID provider.
   *
   * The PKCE transaction is still minted here, so `completeAuthorization` verifies the `state` and
   * spends the verifier, and the code still lands on this client's own registered redirect URI.
   */
  const startAuthorization = async (returnTo = config.defaultReturnTo, loginHint?: string) => {
    const {transaction, codeChallenge} = await beginTransaction("sso", returnTo);
    const params = new URLSearchParams({
      response_type: "code",
      client_id: config.clientId,
      redirect_uri: redirectUri(config),
      state: transaction.state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
      scope: config.scope,
    });
    if (loginHint) params.set("login_hint", loginHint);
    window.location.assign(`${config.baseUrl}/oauth/authorize?${params}`);
  };

  /**
   * In-flight exchanges keyed by code. Authorization codes are single-use, and React's StrictMode
   * runs the callback effect twice in development — without this the second run would spend an
   * already-redeemed code and surface a spurious failure.
   */
  const exchanges = new Map<string, Promise<string>>();

  const exchange = async (code: string, state: string) => {
    /*
     * Looked up by `state` rather than "the last one started": the user may well have several
     * links in flight — a second address, a second tab — and every one of them has to stay
     * redeemable. A `state` no pending transaction claims is the genuine mismatch.
     */
    const transaction = storage.readTransaction(state);
    if (!transaction) {
      throw new AuthApiError(400, storage.readTransactions().length === 0 ? "missing-transaction" : "state-mismatch");
    }

    const tokens = await http.postForm<TokenResponse>("/oauth/token", {
      grant_type: "authorization_code",
      client_id: config.clientId,
      code,
      redirect_uri: redirectUri(config),
      code_verifier: transaction.code_verifier,
    });

    /* Nothing to sign in with: better a failed callback than a session that is one only in name. */
    if (!session.startSession(tokens)) throw new AuthApiError(502, "malformed-response");

    storage.clearTransaction(transaction.state);
    return transaction.return_to || config.defaultReturnTo;
  };

  /** Redeems the authorization code the provider redirected back with. Returns where to go next. */
  const completeAuthorization = (code: string, state: string) => {
    const pending = exchanges.get(code);
    if (pending) return pending;

    const attempt = exchange(code, state).finally(() => {
      /* Kept briefly so StrictMode's paired effect reuses the result instead of replaying the code. */
      setTimeout(() => exchanges.delete(code), 10_000);
    });
    exchanges.set(code, attempt);
    return attempt;
  };

  /** Ends the session server-side when possible, and locally either way. */
  const signOut = async () => {
    try {
      await api.logout();
    } catch {
      /* An already-dead session still has to disappear from this browser. */
    }
    session.endSession();
    storage.clearTransaction();
  };

  return {startAuthorization, completeAuthorization, signOut};
};

/** The site's own flow. */
export const webFlow = createAuthFlow(WEB_AUTH_CONFIG, webSession, webHttp, authApi);

export const {startAuthorization, completeAuthorization, signOut} = webFlow;
