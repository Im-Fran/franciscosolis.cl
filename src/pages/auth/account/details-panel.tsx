import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {Panel} from "@/pages/auth/components/panel.tsx";

/** The read-only facts about the account: what the record says, not what can be edited. */
export const DetailsPanel = () => {
  const {t, i18n} = useTranslation();
  const {me} = useAuth();

  if (!me) return null;

  const user = me.user;

  return (
    <Panel title={t("auth:account.details_title")}>
      <dl className="flex flex-col gap-3 text-sm">
        <Detail label={t("auth:account.status_label")}>
          <Badge variant={user.status === "active" ? "accent" : "outline"} size="sm">
            {t(`auth:status.${user.status}`, {defaultValue: user.status})}
          </Badge>
        </Detail>
        <Detail label={t("auth:account.email_verified_label")}>
          {t(user.email_verified ? "auth:common.yes" : "auth:common.no")}
        </Detail>
        <Detail label={t("auth:account.member_since_label")}>
          {formatDateTime(user.created_at, i18n.language)}
        </Detail>
        <Detail label={t("auth:account.last_login_label")}>
          {formatDateTime(user.last_login_at, i18n.language) ?? "—"}
        </Detail>
        <Detail label={t("auth:account.user_id_label")}>
          <code className="text-xs break-all text-neutral-400">{user.id}</code>
        </Detail>
      </dl>
    </Panel>
  );
};

const Detail = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex flex-wrap items-baseline justify-between gap-3">
    <dt className="text-[13px] text-neutral-500">{label}</dt>
    <dd className="text-right text-[13px] text-neutral-300">{children}</dd>
  </div>
);
