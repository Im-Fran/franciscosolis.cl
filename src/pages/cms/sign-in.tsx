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
 * Entry point of the CMS — and nothing more than a hand-off.
 *
 * The CMS used to ask for the credentials itself: the same provider picker and magic-link form the
 * site's own `/auth` renders, pointed at the CMS's client id. That made it a second sign-in screen
 * for one identity provider, which is the thing single sign-on exists to avoid — every provider the
 * deployment gained had to be taught here too, and a user signing in to the CMS was answering a
 * credential form served by the application asking for the access.
 *
 * So this screen no longer collects anything. It starts a plain authorization code request against
 * `/auth`'s `GET /oauth/authorize` and lets the service's own hosted screen take it from there,
 * exactly as an unrelated relying party would. What comes back is unchanged — the code lands on the
 * registered redirect URI and `/cms/callback` redeems it — because the PKCE transaction is still
 * minted on this side.
 *
 * The route stays: it is the CMS client's `signInRoute`, so it is where the gate sends anonymous
 * visitors and where the callback's retry points, and it carries the `return_to` through the flow.
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
    <Link to="/" className="text-neutral-400 underline-offset-4 transition-colors hover:text-text" data-fs-hover>
      {t("cms:sign_in.back_home")}
    </Link>
  );

  if (error) {
    return (
      <AuthCard
        title={t("cms:sign_in.error_title")}
        subtitle={t("cms:sign_in.error_subtitle")}
        eyebrow={t("cms:app_name")}
      >
        <div className="flex flex-col gap-5">
          <Alert tone="error">{t(`cms:errors.${error}`, {defaultValue: error})}</Alert>
          <Button onClick={start} data-fs-hover>
            <ArrowSquareOut size={16}/> {t("cms:sign_in.retry")}
          </Button>
          <Button variant="ghost" asChild data-fs-hover>
            <Link to="/">
              <ArrowLeft size={16}/> {t("cms:sign_in.back_home")}
            </Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("cms:sign_in.title")}
      subtitle={t("cms:sign_in.subtitle")}
      eyebrow={t("cms:app_name")}
      footer={
        <>
          {t("cms:sign_in.staff_only")} {backHome}
        </>
      }
    >
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Spinner size={18} label={t("cms:sign_in.title")}/>
        {t("cms:sign_in.working")}
      </div>
    </AuthCard>
  );
};
