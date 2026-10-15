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
 * Entry point of the custom-apps panel — a hand-off, not a form.
 *
 * The same shape as the marketplace console's: the panel asks the auth service for access under
 * **its own** client application and lets the service's hosted screen collect whatever it collects.
 */
export const SignIn = () => {
  const {t} = useTranslation("custom_apps");
  const {status, client} = useAuth();
  const [params] = useSearchParams();
  const returnTo = sanitizeReturnTo(params.get("return_to"), client.config);
  const [error, setError] = useState<string | null>(null);

  /* The redirect is a navigation, not state React can roll back: StrictMode's paired effect would
     otherwise mint a second transaction for a page already on its way out. */
  const started = useRef(false);

  const start = useCallback(() => {
    started.current = true;
    setError(null);
    client.flow.startAuthorization(returnTo).catch((cause: unknown) => {
      started.current = false;
      setError(describeError(cause).message);
    });
  }, [client, returnTo]);

  useEffect(() => {
    if (status === "anonymous" && !started.current) start();
  }, [start, status]);

  if (status === "authenticated") return <Navigate to={returnTo} replace />;

  if (error) {
    return (
      <AuthCard title={t("sign_in.error_title")} subtitle={t("sign_in.error_subtitle")} eyebrow={t("app_name")}>
        <div className="flex flex-col gap-5">
          <Alert tone="error">{t(`admin:errors.${error}`, {defaultValue: error})}</Alert>
          <Button onClick={start}>
            <ArrowSquareOut size={16} /> {t("sign_in.retry")}
          </Button>
          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft size={16} /> {t("sign_in.back_home")}
            </Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title={t("sign_in.title")}
      subtitle={t("sign_in.subtitle")}
      eyebrow={t("app_name")}
      footer={
        <>
          {t("sign_in.owner_only")}{" "}
          <Link to="/" className="text-neutral-400 underline-offset-4 transition-colors hover:text-text">
            {t("sign_in.back_home")}
          </Link>
        </>
      }
    >
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Spinner size={18} label={t("sign_in.title")} />
        {t("sign_in.working")}
      </div>
    </AuthCard>
  );
};
