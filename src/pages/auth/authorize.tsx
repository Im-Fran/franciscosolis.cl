import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowLeft, ArrowSquareOut, EnvelopeSimple, PaperPlaneTilt} from "@phosphor-icons/react";
import {SiGoogle} from "@icons-pack/react-simple-icons";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {loadAuthorizationRequest, requestParkedMagicLink} from "@/lib/auth/authorize.ts";
import {looksLikeEmail} from "@/lib/auth/format.ts";
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
 */

const providerIcon = (provider: PendingAuthorizationProvider, size = 16) =>
  provider.name === "google" ? <SiGoogle size={size}/> : <ArrowSquareOut size={size}/>;

type Phase = {kind: "form"} | {kind: "sent"; email: string; expiresIn: number};

export const Authorize = () => {
  const {t} = useTranslation();
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
  const [busy, setBusy] = useState<"magic_link" | "redirect" | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const {expires_in} = await requestParkedMagicLink(handle, recipient);
      setPhase({kind: "sent", email: recipient, expiresIn: expires_in});
    } catch (cause) {
      setError(describeError(cause).message);
    } finally {
      setBusy(null);
    }
  };

  /* A redirect provider is a plain navigation away: the service resumes the parked request itself. */
  const startRedirectProvider = (provider: PendingAuthorizationProvider) => {
    setError(null);
    setBusy("redirect");
    window.location.assign(provider.start_url);
  };

  const backHome = (
    <Link to="/" className="text-neutral-400 underline-offset-4 transition-colors hover:text-text" data-fs-hover>
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
  const emailProviders = pending.providers.filter((provider) => provider.initiation === "email");
  const redirectProviders = pending.providers.filter((provider) => provider.initiation === "redirect");

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
          <Button variant="secondary" onClick={() => setPhase({kind: "form"})} data-fs-hover>
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
          {t("auth:sign_in.invite_only")} {backHome}
        </>
      }
    >
      <div className="flex flex-col gap-5">
        {error && <Alert tone="error">{t(`auth:errors.${error}`, {defaultValue: error})}</Alert>}

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

            <Button type="submit" disabled={busy !== null} data-fs-hover>
              {busy === "magic_link" ? <Spinner size={16}/> : <PaperPlaneTilt size={16}/>}
              {t("auth:sign_in.magic_link_cta")}
            </Button>
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
              data-fs-hover
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
