import {useTranslation} from "react-i18next";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {Panel} from "@/pages/auth/components/panel.tsx";

/**
 * The roles and permissions this account holds in the application it signed in to.
 *
 * The profile is read from the context rather than handed down, so this is a section the router can
 * mount on its own; the layout above it already refuses to render a section without one.
 */
export const AccessPanel = () => {
  const {t} = useTranslation();
  const {me} = useAuth();

  if (!me) return null;

  const {application_id: application, roles, permissions} = me;

  return (
    <Panel
      title={t("auth:account.access_title")}
      description={t("auth:account.access_description", {application})}
    >
      <dl className="flex flex-col gap-5 text-sm">
        <div>
          <dt className="text-[13px] text-neutral-500">{t("auth:account.roles_label")}</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {roles.length === 0 ? (
              <span className="text-[13px] text-neutral-600">{t("auth:account.roles_empty")}</span>
            ) : (
              roles.map((role) => <Badge key={role} variant="accent">{role}</Badge>)
            )}
          </dd>
        </div>

        <div>
          <dt className="text-[13px] text-neutral-500">{t("auth:account.permissions_label")}</dt>
          <dd className="mt-2 flex flex-wrap gap-2">
            {permissions.length === 0 ? (
              <span className="text-[13px] text-neutral-600">{t("auth:account.permissions_empty")}</span>
            ) : (
              permissions.map((permission) => (
                <Badge key={permission} variant="neutral" size="sm">{permission}</Badge>
              ))
            )}
          </dd>
        </div>
      </dl>
    </Panel>
  );
};
