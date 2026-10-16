import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {FloppyDisk, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {AppPayload} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {appFormChanges, appToForm, validateAppForm} from "@/pages/custom-apps/components/app-form.ts";
import type {AppForm, AppFormErrors, AppFormField} from "@/pages/custom-apps/components/app-form.ts";
import {AppFormFields} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {AppKeysPanel} from "@/pages/custom-apps/components/app-keys-panel.tsx";

/**
 * Everything about an app that is configuration rather than state: its fields, its keys, and
 * deleting it. Only what changed goes up, so a save never rewrites the schedule or the module list
 * somebody else just edited unless this form actually touched them.
 */
export const AppSettings = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const {notify} = useToast();
  const {app, replace} = useApp();
  const vocabulary = useServiceVocabulary();

  const baseline = useMemo(() => appToForm(app), [app]);
  const [form, setForm] = useState<AppForm>(baseline);
  const [errors, setErrors] = useState<AppFormErrors>({});
  const [askDelete, setAskDelete] = useState(false);

  useEffect(() => setForm(baseline), [baseline]);

  const save = useMutation(useCallback((body: AppPayload) => customAppsApi.apps.update(app.id, body), [app.id]));
  const remove = useMutation(useCallback(() => customAppsApi.apps.remove(app.id), [app.id]));

  const changes = useMemo(() => appFormChanges(form, baseline), [form, baseline]);
  const dirty = Object.keys(changes).length > 0;

  const set = <K extends AppFormField>(key: K, value: AppForm[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  /* The browser's own "leave site?" prompt is the only guard that survives a tab close. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateAppForm(form, t, vocabulary.heartbeat);
    setErrors(found);
    if (Object.keys(found).length > 0 || !dirty) return;

    const outcome = await save.run(changes);
    if (!outcome.ok) return;
    notify(t("admin:common.saved"));
    replace(outcome.data);
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(customAppsRoute.apps, {replace: true});
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={submit} noValidate>
        <Panel
          title={t("custom_apps:settings.title")}
          description={t("custom_apps:settings.description")}
          action={
            <>
              {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
              <Button type="submit" size="sm" disabled={save.pending || !dirty}>
                {save.pending ? <Spinner size={14} /> : <FloppyDisk size={14} />}
                {t("admin:common.save")}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-5">
            {save.error && (
              <Alert tone="error" title={t("admin:common.failed")}>
                {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
              </Alert>
            )}
            <AppFormFields form={form} set={set} errors={errors} disabled={save.pending} mode="edit" />
            <div className="flex justify-end">
              <Button type="submit" disabled={save.pending || !dirty}>
                {save.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
                {save.pending ? t("admin:common.saving") : t("admin:common.save")}
              </Button>
            </div>
          </div>
        </Panel>
      </form>

      <AppKeysPanel appId={app.id} />

      <Panel title={t("custom_apps:settings.danger_title")} description={t("custom_apps:settings.danger_description")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-xl text-[13px] leading-relaxed text-neutral-400">
            {app.installation_count > 0
              ? t("custom_apps:settings.delete_blocked", {count: app.installation_count})
              : t("custom_apps:settings.delete_hint")}
          </p>
          <Button
            type="button"
            variant="secondary"
            onClick={() => {
              remove.reset();
              setAskDelete(true);
            }}
            className="border-red-500/50 text-red-300 fs-ripple-danger"
          >
            <Trash size={16} /> {t("custom_apps:settings.delete")}
          </Button>
        </div>
      </Panel>

      <ConfirmDialog
        open={askDelete}
        title={t("custom_apps:settings.delete_title")}
        body={t("custom_apps:settings.delete_body", {name: app.name})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("custom_apps:settings.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </div>
  );
};
