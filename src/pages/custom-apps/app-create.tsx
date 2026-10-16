import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowRight, CheckCircle, FloppyDisk, Key} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import type {App, AppKey, NewApp} from "@/lib/custom-apps/types.ts";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {emptyAppForm, newAppPayload, validateAppForm} from "@/pages/custom-apps/components/app-form.ts";
import type {AppForm, AppFormErrors, AppFormField} from "@/pages/custom-apps/components/app-form.ts";
import {AppFormFields} from "@/pages/custom-apps/components/app-form-fields.tsx";
import {CopyField} from "@/pages/custom-apps/components/copy-button.tsx";

/**
 * Registering a new app for a client.
 *
 * The service mints the app's first key in the same request, so the screen does not move on to the
 * app straight away: it stops on the key first. The key is not secret — it ships inside the client
 * app, and the Settings tab lists it again any time — but it is the one thing needed next, and
 * landing on a summary with it two tabs away would be a detour.
 */
export const AppCreate = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const [params] = useSearchParams();
  const vocabulary = useServiceVocabulary();

  const [form, setForm] = useState<AppForm>(() => emptyAppForm(vocabulary.heartbeat.default, params.get("company_id") ?? ""));
  const [errors, setErrors] = useState<AppFormErrors>({});
  const [created, setCreated] = useState<(App & {key: AppKey}) | null>(null);

  const create = useMutation(useCallback((body: NewApp) => customAppsApi.apps.create(body), []));

  const set = <K extends AppFormField>(key: K, value: AppForm[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validateAppForm(form, t, vocabulary.heartbeat);
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const outcome = await create.run(newAppPayload(form));
    if (!outcome.ok) return;
    notify(t("admin:common.created"));
    setCreated(outcome.data);
  };

  if (created) {
    return (
      <>
        <PageHeader
          title={created.name}
          description={t("custom_apps:apps.created_description")}
          back={{to: customAppsRoute.apps, label: t("custom_apps:apps.back")}}
        />

        <Panel title={t("custom_apps:apps.created_title")} description={t("custom_apps:apps.created_hint")}>
          <div className="flex flex-col gap-5">
            <Alert tone="success" title={t("custom_apps:apps.created_alert")}>
              {t("custom_apps:apps.created_alert_body")}
            </Alert>

            <div className="flex flex-col gap-2">
              <span className="flex items-center gap-2 text-sm font-medium text-neutral-300">
                <Key size={16} /> {t("custom_apps:keys.key")}
              </span>
              <div className="rounded-[var(--radius-md)] border border-accent-700 bg-accent-900/20 p-1">
                <CopyField value={created.key.key} label={t("custom_apps:keys.key")} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm font-medium text-neutral-300">{t("custom_apps:ingest.base")}</span>
              <CopyField value={created.ingest.base_url} label={t("custom_apps:ingest.base")} />
            </div>

            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="ghost" asChild>
                <Link to={customAppsRoute.appSettings(created.id)}>{t("custom_apps:apps.created_settings")}</Link>
              </Button>
              <Button asChild>
                <Link to={customAppsRoute.app(created.id)}>
                  <CheckCircle size={16} /> {t("custom_apps:apps.created_open")} <ArrowRight size={14} />
                </Link>
              </Button>
            </div>
          </div>
        </Panel>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title={t("custom_apps:apps.new_title")}
        description={t("custom_apps:apps.new_description")}
        back={{to: customAppsRoute.apps, label: t("custom_apps:apps.back")}}
        actions={
          <Button type="submit" form="app-create-form" disabled={create.pending}>
            {create.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
            {create.pending ? t("admin:common.creating") : t("admin:common.create")}
          </Button>
        }
      />

      <form id="app-create-form" onSubmit={submit} noValidate>
        <Panel title={t("custom_apps:apps.details")} description={t("custom_apps:apps.details_hint")}>
          <div className="flex flex-col gap-5">
            {create.error && (
              <Alert tone="error" title={t("admin:common.failed")}>
                {t(`admin:errors.${create.error}`, {defaultValue: create.error})}
              </Alert>
            )}
            <AppFormFields form={form} set={set} errors={errors} disabled={create.pending} mode="create" />
          </div>
        </Panel>
      </form>
    </>
  );
};
