import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowLeft, SignOut} from "@phosphor-icons/react";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";

/**
 * Signed in, but not an agent.
 *
 * The support service answers 403 for an account without `support:agent`. The wording says what is
 * actually missing and what to do about it, including the part people forget: permissions ride in
 * the access token, so being granted one changes nothing until a fresh token is minted.
 */
export const NoAccess = ({email}: {email?: string}) => {
  const {t} = useTranslation("support_agent");
  const {signOut} = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <AuthCard
      title={t("no_access.title")}
      subtitle={email ? t("no_access.subtitle_email", {email}) : t("no_access.subtitle")}
      eyebrow={t("app_name")}
    >
      <div className="flex flex-col gap-5">
        <Alert tone="info" title={t("no_access.alert_title")}>
          {t("no_access.alert_body")}
        </Alert>

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          >
            {signingOut ? <Spinner size={16} /> : <SignOut size={16} />}
            {t("no_access.sign_out")}
          </Button>

          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft size={16} /> {t("no_access.back_home")}
            </Link>
          </Button>
        </div>
      </div>
    </AuthCard>
  );
};
