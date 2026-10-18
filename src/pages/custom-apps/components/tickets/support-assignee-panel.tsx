import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Lifebuoy} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useCustomApps} from "@/lib/custom-apps/custom-apps-context.ts";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {Detail, DetailList} from "@/pages/custom-apps/components/detail-list.tsx";

/**
 * Who hears about the app's support tickets, and taking them over.
 *
 * Whoever turned the `support` module on receives them until somebody takes them: every new ticket
 * and every message its requester adds arrives in the website's bell, never by email. Taking them is
 * one request for the signed-in account — there is no picker, because the service only ever assigns
 * the caller.
 */
export const SupportAssigneePanel = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const {account} = useCustomApps();
  const {app, replace} = useApp();
  const take = useMutation(useCallback(() => customAppsApi.tickets.takeApp(app.id), [app.id]));

  const assignee = app.support_assignee_email ?? null;
  const mine = Boolean(assignee && account?.email && assignee.toLowerCase() === account.email.toLowerCase());

  const submit = async () => {
    const outcome = await take.run();
    if (!outcome.ok) return;
    replace({...app, support_assignee_email: outcome.data.support_assignee_email});
    notify(t("custom_apps:tickets.assignee.taken"));
  };

  return (
    <Panel
      title={t("custom_apps:tickets.assignee.title")}
      description={t("custom_apps:tickets.assignee.description")}
      action={
        <Link to={customAppsRoute.tickets({app_id: app.id})} className="text-[13px] text-neutral-400 hover:text-text hover:underline">
          {t("custom_apps:tickets.assignee.see_tickets")}
        </Link>
      }
    >
      <div className="flex flex-col gap-4">
        <DetailList>
          <Detail label={t("custom_apps:tickets.assignee.current")}>
            {assignee ? (
              <span>
                {assignee}
                {mine && <span className="text-neutral-500"> ({t("custom_apps:tickets.assignee.you")})</span>}
              </span>
            ) : (
              <span className="text-neutral-500 italic">{t("custom_apps:tickets.assignee.none")}</span>
            )}
          </Detail>
        </DetailList>
        {take.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${take.error}`, {defaultValue: take.error})}
          </Alert>
        )}
        <div className="flex flex-wrap items-center justify-end gap-3">
          {mine && <span className="text-[13px] text-neutral-500">{t("custom_apps:tickets.assignee.yours")}</span>}
          <Button type="button" variant="secondary" onClick={() => void submit()} disabled={take.pending || mine}>
            {take.pending ? <Spinner size={16} /> : <Lifebuoy size={16} />}
            {t("custom_apps:tickets.assignee.take")}
          </Button>
        </div>
      </div>
    </Panel>
  );
};
