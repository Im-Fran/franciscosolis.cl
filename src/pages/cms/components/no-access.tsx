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
 * Signed in, but not admitted: the CMS answers `403` for an account that has no role in this
 * application. Signing out is offered right here, since the fix is usually to come back as someone
 * else — or to be granted the role and sign in again so a fresh token carries it.
 */
export const NoAccess = ({email}: {email?: string}) => {
  const {t} = useTranslation();
  const {signOut} = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <AuthCard
      title={t("cms:no_access.title")}
      subtitle={email ? t("cms:no_access.subtitle_email", {email}) : t("cms:no_access.subtitle")}
      eyebrow={t("cms:app_name")}
    >
      <div className="flex flex-col gap-5">
        <Alert tone="info" title={t("cms:no_access.alert_title")}>{t("cms:no_access.alert_body")}</Alert>

        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          >
            {signingOut ? <Spinner size={16}/> : <SignOut size={16}/>}
            {t("cms:no_access.sign_out")}
          </Button>

          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft size={16}/> {t("cms:no_access.back_home")}
            </Link>
          </Button>
        </div>
      </div>
    </AuthCard>
  );
};
