import {useEffect, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useSearchParams} from "react-router-dom";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeError} from "@/lib/auth/useResource.ts";

/**
 * Landing point for both providers. Redeems the single-use authorization code against whichever
 * client the surrounding provider stands for, then hands over to wherever the sign-in started from.
 */
export const CallbackPanel = ({ns, eyebrow}: {ns: string; eyebrow?: ReactNode}) => {
  const {t} = useTranslation();
  const navigate = useNavigate();
  const {client, reload} = useAuth();
  const [params] = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const code = params.get("code");
  const state = params.get("state");
  const providerError = params.get("error");
  const providerErrorDescription = params.get("error_description");

  useEffect(() => {
    if (providerError) {
      setError(providerErrorDescription || providerError);
      return;
    }
    if (!code || !state) {
      setError("missing-code");
      return;
    }

    let active = true;
    client.flow
      .completeAuthorization(code, state)
      .then(async (returnTo) => {
        await reload();
        if (active) navigate(returnTo, {replace: true});
      })
      .catch((cause: unknown) => {
        if (active) setError(describeError(cause).message);
      });

    return () => {
      active = false;
    };
  }, [client, code, state, providerError, providerErrorDescription, navigate, reload]);

  if (error) {
    return (
      <AuthCard title={t(`${ns}:callback.error_title`)} subtitle={t(`${ns}:callback.error_subtitle`)} eyebrow={eyebrow}>
        <div className="flex flex-col gap-5">
          <Alert tone="error">{t(`${ns}:errors.${error}`, {defaultValue: error})}</Alert>
          <Button asChild>
            <Link to={client.config.signInRoute} replace>{t(`${ns}:callback.retry`)}</Link>
          </Button>
        </div>
      </AuthCard>
    );
  }

  return (
    <AuthCard title={t(`${ns}:callback.title`)} subtitle={t(`${ns}:callback.subtitle`)} eyebrow={eyebrow}>
      <div className="flex items-center gap-3 text-sm text-neutral-400">
        <Spinner size={18} label={t(`${ns}:callback.title`)}/>
        {t(`${ns}:callback.working`)}
      </div>
    </AuthCard>
  );
};
