import {useCallback, useRef, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowLeft, ArrowSquareOut, EnvelopeSimple, PaperPlaneTilt, ShieldCheck, UserSwitch} from "@phosphor-icons/react";
import {SiGoogle} from "@icons-pack/react-simple-icons";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Turnstile} from "@/components/auth/turnstile.tsx";
import type {TurnstileHandle} from "@/components/auth/turnstile.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {loadAuthorizationRequest, requestParkedMagicLink} from "@/lib/auth/authorize.ts";
import {formatDateTime, looksLikeEmail} from "@/lib/auth/format.ts";
import type {PendingAuthorizationProvider} from "@/lib/auth/types.ts";
import {describeError, useResource} from "@/lib/auth/useResource.ts";

/**
 * The auth service's hosted sign-in screen, at `/apps/auth`.
 *
 * `api.franciscosolis.cl` is a pure backend: it validates an authorization request, parks it, and
 * redirects here with `?request=<handle>`. This screen is the only page in the whole OAuth flow, so
 * it belongs to whichever application started the request — not to this site. That is the one thing
 * that sets it apart from `/auth`, which signs *this site* in and mints its own PKCE transaction:
 * here the request already exists server-side and every provider is a URL the service handed over.
 *
 * It therefore hardcodes nothing about the providers. What the panel offers is what
 * `GET /oauth/authorize/:handle` lists, which is what the deployment actually has configured.
 *
 * A browser that already signed in to the issuer is not asked to do it again: the parked request
 * comes back with `authenticated`, and the screen offers to *authorize* the application instead.
 * The button behind that is a plain navigation to the `continue_url` the service handed over —
 * never a `fetch` — because the cookie proving the session only rides a navigation, and the service
 * re-checks it there. "Use another account" simply reveals the providers again: signing in through
 * one replaces the session on this browser, which is what changing account means.
 *
 * Two things the parked request now also says shape this screen. `turnstile` decides whether the
 * magic-link form carries a bot check: the widget is rendered only where the service asked for one,
 * and the form cannot be submitted until it is solved, because the service would refuse the request
 * anyway. And `registration_open` decides what the footer promises, since with registration closed
 * an address nobody invited gets nothing — saying so up front is kinder than the deliberately
 * identical "if this address can sign in" answer that follows either way.
 */

const providerIcon = (provider: PendingAuthorizationProvider, size = 16) =>
  provider.name === "google" ? <SiGoogle size={size}/> : <ArrowSquareOut size={size}/>;

type Phase = {kind: "form"} | {kind: "sent"; email: string; expiresIn: number};

export const Authorize = () => {
  const {t, i18n} = useTranslation();
  const [params] = useSearchParams();
  const handle = params.get("request");

  const request = useResource(
    useCallback(
      (signal: AbortSignal) =>
        handle ? loadAuthorizationRequest(handle, signal) : Promise.reject(new Error("missing-request")),
      [handle],
    ),
  );

  const [email, setEmail] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({kind: "form"});
  const [busy, setBusy] = useState<"magic_link" | "redirect" | "continue" | null>(null);
  const [error, setError] = useState<string | null>(null);
  /* Set by "use another account": the session is still live, the user just does not want it here. */
  const [switching, setSwitching] = useState(false);
  /* The solved Turnstile token, and the widget it came from so a refused submit can ask again. */
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstile = useRef<TurnstileHandle>(null);

  /* The service's `login_hint` seeds the field, but only until the user types over it. */
  const address = email ?? request.data?.login_hint ?? "";

  const submitMagicLink = async (event: FormEvent) => {
    event.preventDefault();
    if (!handle) return;
    setError(null);

    /* Same as the site's own sign-in: `noValidate` means nothing else checks the shape. */
    const recipient = address.trim();
    if (!looksLikeEmail(recipient)) return setError("invalid-email");

    setBusy("magic_link");
    try {
      const {expires_in} = await requestParkedMagicLink(handle, recipient, turnstileToken);
      setPhase({kind: "sent", email: recipient, expiresIn: expires_in});
    } catch (cause) {
      setError(describeError(cause).message);
      /* A token is single-use at Cloudflare's end, so the next attempt needs a fresh challenge. */
      turnstile.current?.reset();
    } finally {
      setBusy(null);
    }
  };

  /* Same shape as a redirect provider: the service resumes the parked request on the other side. */
  const authorizeFromSession = (continueUrl: string) => {
    setError(null);
    setBusy("continue");
    window.location.assign(continueUrl);
  };

  /* A redirect provider is a plain navigation away: the service resumes the parked request itself. */
  const startRedirectProvider = (provider: PendingAuthorizationProvider) => {
    setError(null);
    setBusy("redirect");
    window.location.assign(provider.start_url);
  };

  const backHome = (
    <Link to="/" className="text-neutral-400 underline-offset-4 transition-colors hover:text-text">
      {t("auth:authorize.back_home")}
    </Link>
  );

  /* Opened by hand rather than by the service: there is no request to sign in to. */
  if (!handle) {
    return (
      <AuthCard title={t("auth:authorize.invalid_title")} subtitle={t("auth:authorize.invalid_subtitle")}>
        <Alert tone="error">{t("auth:authorize.missing_request")}</Alert>
        <p className="mt-5 text-[13px] text-neutral-500">{backHome}</p>
      </AuthCard>
    );
  }

  if (request.loading) {
    return (
      <AuthCard title={t("auth:authorize.loading_title")} subtitle={t("auth:authorize.loading_subtitle")}>
        <div className="flex items-center gap-3 text-sm text-neutral-400">
          <Spinner size={18} label={t("auth:authorize.loading_title")}/>
          {t("auth:authorize.loading_working")}
        </div>
      </AuthCard>
    );
  }

  /* An unknown or expired handle. Only the application that started the flow can start a new one. */
  if (request.error || !request.data) {
    return (
      <AuthCard title={t("auth:authorize.expired_title")} subtitle={t("auth:authorize.expired_subtitle")}>
        <Alert tone="error">
          {t(`auth:errors.${request.error}`, {defaultValue: request.error ?? t("auth:authorize.expired_subtitle")})}
        </Alert>
        <p className="mt-5 text-[13px] text-neutral-500">{backHome}</p>
      </AuthCard>
    );
  }

  const pending = request.data;
  const eyebrow = t("auth:authorize.eyebrow");
  const account = pending.authenticated;
  const emailProviders = pending.providers.filter((provider) => provider.initiation === "email");
  const redirectProviders = pending.providers.filter((provider) => provider.initiation === "redirect");
  /* Read defensively: a service that predates the bot check sends no `turnstile` at all, and the
     screen has to keep signing people in rather than crash on a field it only just started reading. */
  const challenge = pending.turnstile?.required ? pending.turnstile.site_key : null;
  /* Submitting without a solved challenge would only earn a 400 from the service. */
  const blockedByChallenge = challenge !== null && turnstileToken === null;

  /*
   * Already signed in: authorize, do not authenticate. The account shown is the one the service
   * itself resolved from its cookie, so this is a statement rather than a claim the screen makes.
   */
  if (account && !switching) {
    return (
      <AuthCard
        title={t("auth:authorize.continue_title")}
        subtitle={t("auth:authorize.continue_subtitle", {application: pending.client_name})}
        eyebrow={eyebrow}
        footer={backHome}
      >
        <div className="flex flex-col gap-5">
          {error && <Alert tone="error">{t(`auth:errors.${error}`, {defaultValue: error})}</Alert>}

          <div className="flex items-center gap-3 rounded-[var(--radius-md)] bg-neutral-900/60 px-4 py-3">
            <Avatar name={account.name} email={account.email} picture={account.picture} size={40}/>
            <div className="min-w-0">
              <p className="truncate text-sm text-text">{account.name ?? account.email}</p>
              {account.name && <p className="truncate text-[13px] text-neutral-400">{account.email}</p>}
              <p className="mt-0.5 text-xs text-neutral-600">
                {t("auth:authorize.signed_in_at", {value: formatDateTime(account.auth_time, i18n.language)})}
              </p>
            </div>
          </div>

          <Button onClick={() => authorizeFromSession(account.continue_url)} disabled={busy !== null}>
            {busy === "continue" ? <Spinner size={16}/> : <ShieldCheck size={16}/>}
            {t("auth:authorize.authorize_cta", {application: pending.client_name})}
          </Button>

          <Button
            variant="secondary"
            onClick={() => {
              setError(null);
              setSwitching(true);
            }}
            disabled={busy !== null}
          >
            <UserSwitch size={16}/> {t("auth:authorize.use_another_account")}
          </Button>

          <p className="text-[13px] leading-relaxed text-neutral-500">{t("auth:authorize.continue_note")}</p>
        </div>
      </AuthCard>
    );
  }

  if (phase.kind === "sent") {
    return (
      <AuthCard
        title={t("auth:sign_in.sent_title")}
        subtitle={t("auth:sign_in.sent_subtitle", {email: phase.email})}
        eyebrow={eyebrow}
      >
        <div className="flex flex-col gap-5">
          <Alert tone="success" title={t("auth:sign_in.sent_alert_title")}>
            {t("auth:sign_in.sent_expiry", {count: Math.max(1, Math.round(phase.expiresIn / 60))})}
          </Alert>
          <p className="text-[13px] leading-relaxed text-neutral-400">{t("auth:authorize.sent_note")}</p>
          <Button variant="secondary" onClick={() => setPhase({kind: "form"})}>
            <ArrowLeft size={16}/> {t("auth:sign_in.use_another")}
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("auth:authorize.title")}
      subtitle={t("auth:authorize.subtitle", {application: pending.client_name})}
      eyebrow={eyebrow}
      footer={
        <>
          {pending.registration_open ? t("auth:authorize.open_registration") : t("auth:sign_in.invite_only")}{" "}
          {backHome}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <Alert tone="error">{t(`auth:errors.${error}`, {defaultValue: error})}</Alert>}

        {/* Only reachable through "use another account": the session is still there to go back to. */}
        {account && switching && (
          <Button variant="ghost" size="sm" onClick={() => setSwitching(false)}>
            <ArrowLeft size={14}/> {t("auth:authorize.back_to_account", {account: account.name ?? account.email})}
          </Button>
        )}

        {emailProviders.length > 0 && (
          <form className="flex flex-col gap-4" onSubmit={submitMagicLink} noValidate>
            <Field label={t("auth:sign_in.email_label")} htmlFor="authorize-email" hint={t("auth:sign_in.email_hint")}>
              <Input
                id="authorize-email"
                name="email"
                type="email"
                required
                autoComplete="email"
                autoFocus
                inputMode="email"
                placeholder={t("auth:sign_in.email_placeholder")}
                value={address}
                onChange={(event) => setEmail(event.target.value)}
              />
            </Field>

            {challenge && (
              <Turnstile
                ref={turnstile}
                siteKey={challenge}
                language={i18n.language}
                onToken={setTurnstileToken}
                onError={() => setError("turnstile-unavailable")}
              />
            )}

            <Button type="submit" disabled={busy !== null || blockedByChallenge}>
              {busy === "magic_link" ? <Spinner size={16}/> : <PaperPlaneTilt size={16}/>}
              {t("auth:sign_in.magic_link_cta")}
            </Button>

            {blockedByChallenge && (
              <p className="text-[13px] text-neutral-500">{t("auth:authorize.turnstile_pending")}</p>
            )}
          </form>
        )}

        {emailProviders.length > 0 && redirectProviders.length > 0 && (
          <div className="flex items-center gap-3" aria-hidden>
            <span className="h-px flex-1 bg-neutral-800"/>
            <span className="text-[11px] tracking-[0.12em] text-neutral-600 uppercase">
              {t("auth:sign_in.divider")}
            </span>
            <span className="h-px flex-1 bg-neutral-800"/>
          </div>
        )}

        <div className="flex flex-col gap-2">
          {redirectProviders.map((provider) => (
            <Button
              key={provider.name}
              variant="secondary"
              onClick={() => startRedirectProvider(provider)}
              disabled={busy !== null}
            >
              {busy === "redirect" ? <Spinner size={16}/> : providerIcon(provider)}
              {t("auth:authorize.continue_with", {provider: provider.display_name})}
            </Button>
          ))}
        </div>

        {pending.providers.length === 0 && <Alert tone="error">{t("auth:authorize.no_providers")}</Alert>}

        <p className="flex items-center gap-2 text-[13px] text-neutral-500">
          <EnvelopeSimple size={15}/> {t("auth:sign_in.no_password")}
        </p>
      </div>
    </AuthCard>
  );
};
