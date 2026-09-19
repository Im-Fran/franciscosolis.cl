import {useCallback, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, Navigate, useSearchParams} from "react-router-dom";
import {ArrowLeft, ArrowSquareOut} from "@phosphor-icons/react";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {sanitizeReturnTo} from "@/lib/auth/config.ts";
import {describeError} from "@/lib/auth/useResource.ts";

/**
 * Entry point of the site's own session — and nothing more than a hand-off.
 *
 * This screen used to be the exception on this origin: while every other application started a
 * plain authorization code request and let the service's hosted screen at `/apps/auth` do the
 * authenticating, `/auth` rendered the provider picker and the magic-link form itself, on the
 * grounds that it is the front-end of this very issuer and so would be redirecting to itself.
 *
 * It is not, and the exception cost more than it saved. `/apps/auth` and `/auth` are two different
 * screens with two different jobs: one authenticates whoever parked a request, the other is a
 * client asking for a session of its own. Keeping a second credential form here meant every
 * provider the deployment gained had to be taught twice, the two screens could drift apart in copy
 * and in behaviour, and a person signing in to this site answered a form served by the application
 * asking for the access instead of by the issuer granting it.
 *
 * So this collects nothing now. It starts `GET /oauth/authorize` and waits. What comes back is
 * unchanged — the code lands on `/auth/callback`, the path this client is registered under, and
 * the PKCE transaction is still minted on this side, so `completeAuthorization` verifies the
 * `state` and spends the verifier exactly as before.
 *
 * The route stays: it is this client's `signInRoute`, so it is where the gate sends anonymous
 * visitors, where the callback's retry points and what an emailed invitation links to, and it
 * carries `?return_to=` through the trip.
 */
export const SignIn = () => {
  const {t} = useTranslation();
  const {status, client} = useAuth();
  const [params] = useSearchParams();
  const returnTo = sanitizeReturnTo(params.get("return_to"), client.config);
  const [error, setError] = useState<string | null>(null);

  /* The redirect is a navigation, not state React can roll back: StrictMode's paired effect would
     otherwise mint a second transaction for a page that is already on its way out. */
  const started = useRef(false);

  const start = useCallback(() => {
    started.current = true;
    setError(null);

    client.flow.startAuthorization(returnTo).catch((cause: unknown) => {
      /* Nothing was handed over, so offering the attempt again is the honest way out. */
      started.current = false;
      setError(describeError(cause).message);
    });
  }, [client, returnTo]);

  useEffect(() => {
    if (status === "anonymous" && !started.current) start();
  }, [start, status]);

  if (status === "authenticated") return <Navigate to={returnTo} replace/>;

  const backHome = (
    <Link to="/" className="text-neutral-400 underline-offset-4 transition-colors hover:text-text">
      {t("auth:sign_in.back_home")}
    </Link>
  );

  if (error) {
    return (
      <AuthCard title={t("auth:sign_in.error_title")} subtitle={t("auth:sign_in.error_subtitle")}>
        <div className="flex flex-col gap-5">
          <Alert tone="error">{t(`auth:errors.${error}`, {defaultValue: error})}</Alert>
          <Button onClick={start}>
            <ArrowSquareOut size={16}/> {t("auth:sign_in.retry")}
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft size={16}/> {t("auth:sign_in.back_home")}
            </Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("auth:sign_in.title")}
      subtitle={t("auth:sign_in.subtitle")}
      footer={
        <>
          {t("auth:sign_in.invite_only")} {backHome}
        </>
      }
    >
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Spinner size={18} label={t("auth:sign_in.title")}/>
        {t("auth:sign_in.working")}
      </div>
    </AuthCard>
  );
};
