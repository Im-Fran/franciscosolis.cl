import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {Plus, Sliders} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {AlertRule, AlertRulePayload} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {AlertsTabs} from "@/pages/custom-apps/components/alerts/alerts-tabs.tsx";
import {AppSelect} from "@/pages/custom-apps/components/alerts/app-select.tsx";
import {RuleFormModal} from "@/pages/custom-apps/components/alerts/rule-form-modal.tsx";
import type {RuleDraft} from "@/pages/custom-apps/components/alerts/rule-form-modal.tsx";
import {RuleItem} from "@/pages/custom-apps/components/alerts/rule-item.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {WithHelp} from "@/components/ui/help.tsx";

/**
 * What the service watches for. A rule is one condition — offline for too long, CPU or memory
 * high, a burst of crashes, error logs or enrollments — on one app or on every app, and its creator
 * is the one the notification centre tells (bell, push and email, per their own preferences).
 *
 * Pausing has two shapes: silencing, which has an end, and disabling, which does not. Deleting
 * takes the rule's alerts with it, which is why the dialog suggests the other two first.
 */
export const AlertRules = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {notify} = useToast();
  const [appId, setAppId] = useState("");
  const [draft, setDraft] = useState<RuleDraft | null>(null);
  const [deleting, setDeleting] = useState<AlertRule | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const rules = useResource(
    useCallback((signal: AbortSignal) => customAppsApi.alertRules.list({app_id: appId || undefined}, signal), [appId]),
  );
  const update = useMutation(
    useCallback((id: string, body: AlertRulePayload) => customAppsApi.alertRules.update(id, body), []),
  );
  const remove = useMutation(useCallback((id: string) => customAppsApi.alertRules.remove(id), []));

  const rows = rules.data?.data ?? [];

  const runUpdate = async (rule: AlertRule, body: AlertRulePayload, message: string) => {
    setBusy(rule.id);
    const outcome = await update.run(rule.id, body);
    setBusy(null);
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    notify(message);
    rules.reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const outcome = await remove.run(deleting.id);
    if (!outcome.ok) return;
    setDeleting(null);
    notify(t("admin:common.deleted"));
    rules.reload();
  };

  return (
    <>
      <PageHeader title={t("custom_apps:alerts.title")} description={t("custom_apps:rules.description")} />
      <AlertsTabs />

      <Panel
        title={t("custom_apps:rules.title")}
        description={rules.data ? t("custom_apps:rules.count", {count: rows.length}) : undefined}
        action={
          <>
            <WithHelp label={t("custom_apps:rules.fields.app")} help={help.field("rules.filter_help.app")}>
              <AppSelect
                value={appId}
                onChange={setAppId}
                emptyLabel={t("custom_apps:alerts.filters.any_app")}
                className="h-9 w-auto min-w-[12rem] text-[13px]"
              />
            </WithHelp>
            <Button size="sm" onClick={() => setDraft({mode: "create", appId: appId || undefined})}>
              <Plus size={14} /> {t("custom_apps:rules.create")}
            </Button>
          </>
        }
      >
        <PanelState
          loading={rules.loading && !rules.data}
          error={rules.data ? null : rules.error}
          forbidden={rules.status === 403}
          onRetry={rules.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            <EmptyState
              icon={<Sliders size={28} />}
              title={appId ? t("custom_apps:rules.empty_app") : t("custom_apps:rules.empty")}
              description={t("custom_apps:rules.empty_description")}
              action={
                <Button size="sm" onClick={() => setDraft({mode: "create", appId: appId || undefined})}>
                  <Plus size={14} /> {t("custom_apps:rules.create")}
                </Button>
              }
            />
          ) : (
            <ul className={rules.loading ? "flex flex-col gap-3 opacity-60 transition-opacity" : "flex flex-col gap-3"}>
              {rows.map((rule) => (
                <RuleItem
                  key={rule.id}
                  rule={rule}
                  busy={busy === rule.id}
                  onUpdate={(body, message) => void runUpdate(rule, body, message)}
                  onEdit={() => setDraft({mode: "edit", rule})}
                  onDelete={() => {
                    remove.reset();
                    setDeleting(rule);
                  }}
                />
              ))}
            </ul>
          )}
        </PanelState>
      </Panel>

      <RuleFormModal
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          notify(draft?.mode === "edit" ? t("admin:common.saved") : t("custom_apps:rules.created"));
          setDraft(null);
          rules.reload();
        }}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("custom_apps:rules.delete_title")}
        body={t("custom_apps:rules.delete_body", {name: deleting?.name ?? "", count: deleting?.open_alerts ?? 0})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
