import {useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowLeft, SignOut, UserCircle} from "@phosphor-icons/react";
import {Link} from "react-router-dom";
import {AuthCard} from "@/components/auth/auth-card.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {ACCOUNT_ROUTE} from "@/lib/auth/config.ts";

/**
 * Signed in, but not admitted: `/admin/me` answers 403 for an account that holds no administration
 * permission at all. The account screen is still open to them, so it is offered here rather than
 * leaving a signed-in visitor with nowhere to go but the public site.
 */
export const NoAccess = ({email}: {email?: string}) => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const {signOut} = useAuth();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <AuthCard
      title={t("auth_admin:no_access.title")}
      subtitle={email ? t("auth_admin:no_access.subtitle_email", {email}) : t("auth_admin:no_access.subtitle")}
      eyebrow={t("auth_admin:app_name")}
    >
      <div className="flex flex-col gap-5">
        <Alert tone="info" title={t("auth_admin:no_access.alert_title")}>
          {t("auth_admin:no_access.alert_body")}
        </Alert>

        <div className="flex flex-col gap-2">
          <Button variant="secondary" asChild>
            <Link to={ACCOUNT_ROUTE}>
              <UserCircle size={16}/> {t("auth_admin:no_access.account")}
            </Link>
          </Button>

          <Button
            variant="ghost"
            disabled={signingOut}
            onClick={() => {
              setSigningOut(true);
              void signOut().finally(() => setSigningOut(false));
            }}
          >
            {signingOut ? <Spinner size={16}/> : <SignOut size={16}/>}
            {t("auth_admin:no_access.sign_out")}
          </Button>

          <Button variant="ghost" asChild>
            <Link to="/">
              <ArrowLeft size={16}/> {t("auth_admin:no_access.back_home")}
            </Link>
          </Button>
        </div>
      </div>
    </AuthCard>
  );
};
