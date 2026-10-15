import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {AppWindow, FloppyDisk, Plus, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {parseRut} from "@/lib/custom-apps/rut.ts";
import type {CompanyDetail, CompanyPayload} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {AppRow} from "@/pages/custom-apps/components/app-row.tsx";
import {CompanyContactsPanel} from "@/pages/custom-apps/components/company-contacts-panel.tsx";

const NAME_MAX = 200;

type Form = {
  legalName: string;
  tradeName: string;
  rut: string;
  businessActivity: string;
  address: string;
  isCompany: boolean;
  notes: string;
};

type FieldName = keyof Form;

const EMPTY: Form = {
  legalName: "",
  tradeName: "",
  rut: "",
  businessActivity: "",
  address: "",
  isCompany: true,
  notes: "",
};

const toForm = (source: CompanyDetail): Form => ({
  legalName: source.legal_name,
  tradeName: source.trade_name ?? "",
  rut: source.rut ?? "",
  businessActivity: source.business_activity ?? "",
  address: source.address ?? "",
  isCompany: source.is_company,
  notes: source.notes ?? "",
});

/**
 * Creating a client, and everything about one once it exists: its details, the people there and
 * the apps built for it.
 *
 * The same screen does both, like the marketplace's product editor: the route carries an id or it
 * does not. The contacts and the apps only appear once there is a company to hang them from.
 */
export const CompanyEditor = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {companyId} = useParams<{companyId: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [askDelete, setAskDelete] = useState(false);

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (companyId ? customAppsApi.companies.get(companyId, signal) : Promise.resolve(null)),
      [companyId],
    ),
  );

  const save = useMutation(
    useCallback(
      (payload: CompanyPayload) =>
        companyId
          ? customAppsApi.companies.update(companyId, payload)
          : customAppsApi.companies.create({...payload, legal_name: payload.legal_name ?? ""}),
      [companyId],
    ),
  );
  const remove = useMutation(useCallback(() => customAppsApi.companies.remove(companyId ?? ""), [companyId]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
  }, [loaded]);

  const dirty = useMemo(() => (Object.keys(form) as FieldName[]).some((key) => form[key] !== baseline[key]), [form, baseline]);

  const set = <K extends FieldName>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const rutError = (value: string) => {
    if (!value.trim()) return undefined;
    const parsed = parseRut(value);
    return parsed.ok ? undefined : t(`custom_apps:rut.${parsed.reason}`);
  };

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const name = form.legalName.trim();
    if (!name) found.legalName = t("custom_apps:validation.required");
    else if (name.length > NAME_MAX) found.legalName = t("custom_apps:validation.too_long", {max: NAME_MAX});
    const rut = rutError(form.rut);
    if (rut) found.rut = rut;
    return found;
  };

  /** The RUT goes up normalised, so what is saved is exactly what the form shows afterwards. */
  const normalisedRut = () => {
    if (!form.rut.trim()) return null;
    const parsed = parseRut(form.rut);
    return parsed.ok ? parsed.value : form.rut.trim();
  };

  /** Only what changed goes on the wire, so an untouched RUT cannot collide with itself on a PATCH. */
  const payloadOf = (): CompanyPayload => {
    const full: CompanyPayload = {
      legal_name: form.legalName.trim(),
      trade_name: orNull(form.tradeName),
      rut: normalisedRut(),
      business_activity: orNull(form.businessActivity),
      address: orNull(form.address),
      is_company: form.isCompany,
      notes: orNull(form.notes),
    };
    if (!companyId) return full;

    const changed: CompanyPayload = {};
    if (form.legalName !== baseline.legalName) changed.legal_name = full.legal_name;
    if (form.tradeName !== baseline.tradeName) changed.trade_name = full.trade_name;
    if (form.rut !== baseline.rut) changed.rut = full.rut;
    if (form.businessActivity !== baseline.businessActivity) changed.business_activity = full.business_activity;
    if (form.address !== baseline.address) changed.address = full.address;
    if (form.isCompany !== baseline.isCompany) changed.is_company = full.is_company;
    if (form.notes !== baseline.notes) changed.notes = full.notes;
    return changed;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const outcome = await save.run(payloadOf());
    if (!outcome.ok) return;

    if (!companyId) {
      notify(t("admin:common.created"));
      setBaseline(form);
      navigate(customAppsRoute.company(outcome.data.id), {replace: true});
      return;
    }
    notify(t("admin:common.saved"));
    record.reload();
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(customAppsRoute.companies, {replace: true});
  };

  const formId = "company-form";
  const header = (
    <PageHeader
      title={companyId ? loaded?.legal_name || t("custom_apps:companies.edit_title") : t("custom_apps:companies.new_title")}
      description={companyId ? loaded?.trade_name ?? undefined : t("custom_apps:companies.new_description")}
      back={{to: customAppsRoute.companies, label: t("custom_apps:companies.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {companyId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => {
                remove.reset();
                setAskDelete(true);
              }}
              className="border-red-500/50 text-red-300 fs-ripple-danger"
            >
              <Trash size={16} /> {t("admin:common.delete")}
            </Button>
          )}
          <Button type="submit" form={formId} disabled={save.pending}>
            {save.pending ? <Spinner size={16} /> : <FloppyDisk size={16} />}
            {companyId ? t("admin:common.save") : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  if (companyId && (record.loading || record.error) && !loaded) {
    return (
      <>
        {header}
        <Panel title={t("custom_apps:companies.details")}>
          <PanelState loading={record.loading} error={record.error} forbidden={record.status === 403} onRetry={record.reload} ns="admin">
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  return (
    <>
      {header}

      <div className="flex flex-col gap-6">
        <form id={formId} onSubmit={submit} noValidate>
          <Panel title={t("custom_apps:companies.details")} description={t("custom_apps:companies.details_hint")}>
            <div className="flex flex-col gap-5">
              {save.error && (
                <Alert tone="error" title={t("admin:common.failed")}>
                  {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
                </Alert>
              )}

              <div className="grid gap-5 sm:grid-cols-2">
                <fieldset className="flex flex-col gap-1.5 sm:col-span-2">
                  <legend className="mb-1.5 text-sm font-medium text-neutral-300">{t("custom_apps:companies.fields.kind")}</legend>
                  <div className="flex flex-wrap gap-2">
                    {[true, false].map((isCompany) => (
                      <label
                        key={String(isCompany)}
                        className="flex cursor-pointer items-center gap-2 rounded-[var(--radius-md)] border border-neutral-800 px-3 py-2 text-sm text-neutral-300 has-[:checked]:border-accent-700 has-[:checked]:bg-accent-900/30"
                      >
                        <input
                          type="radio"
                          name="company-kind"
                          checked={form.isCompany === isCompany}
                          onChange={() => set("isCompany", isCompany)}
                          className="accent-[var(--color-accent)]"
                        />
                        {isCompany ? t("custom_apps:companies.company") : t("custom_apps:companies.person")}
                      </label>
                    ))}
                  </div>
                </fieldset>

                <Field
                  label={form.isCompany ? t("custom_apps:companies.fields.legal_name") : t("custom_apps:companies.fields.full_name")}
                  htmlFor="company-legal-name"
                  error={errors.legalName}
                  hint={form.isCompany ? t("custom_apps:companies.hints.legal_name") : undefined}
                >
                  <Input
                    id="company-legal-name"
                    value={form.legalName}
                    onChange={(event) => set("legalName", event.target.value)}
                    maxLength={NAME_MAX}
                    aria-invalid={Boolean(errors.legalName)}
                    autoComplete="off"
                    required
                  />
                </Field>

                <Field
                  label={t("custom_apps:companies.fields.trade_name")}
                  htmlFor="company-trade-name"
                  hint={t("custom_apps:companies.hints.trade_name")}
                >
                  <Input
                    id="company-trade-name"
                    value={form.tradeName}
                    onChange={(event) => set("tradeName", event.target.value)}
                    maxLength={NAME_MAX}
                    autoComplete="off"
                  />
                </Field>

                <Field
                  label={t("custom_apps:companies.fields.rut")}
                  htmlFor="company-rut"
                  error={errors.rut}
                  hint={t("custom_apps:companies.hints.rut")}
                >
                  <Input
                    id="company-rut"
                    value={form.rut}
                    onChange={(event) => set("rut", event.target.value)}
                    /* Normalised as soon as the field is left, so the stored shape is what is seen. */
                    onBlur={() => {
                      if (!form.rut.trim()) return;
                      const parsed = parseRut(form.rut);
                      if (parsed.ok) set("rut", parsed.value);
                      else setErrors((current) => ({...current, rut: rutError(form.rut)}));
                    }}
                    placeholder="12345678-5"
                    maxLength={14}
                    aria-invalid={Boolean(errors.rut)}
                    autoComplete="off"
                    className="font-mono"
                  />
                </Field>

                <Field
                  label={t("custom_apps:companies.fields.business_activity")}
                  htmlFor="company-activity"
                  hint={t("custom_apps:companies.hints.business_activity")}
                >
                  <Input
                    id="company-activity"
                    value={form.businessActivity}
                    onChange={(event) => set("businessActivity", event.target.value)}
                    autoComplete="off"
                  />
                </Field>

                <Field label={t("custom_apps:fields.address")} htmlFor="company-address" className="sm:col-span-2">
                  <Input
                    id="company-address"
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                    autoComplete="off"
                  />
                </Field>

                <Field label={t("custom_apps:fields.notes")} htmlFor="company-notes" className="sm:col-span-2">
                  <Textarea
                    id="company-notes"
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                    rows={4}
                    className="resize-y"
                  />
                </Field>
              </div>

              {loaded?.updated_at && (
                <p className="text-[13px] text-neutral-600">
                  {t("custom_apps:updated_at", {date: formatDateTime(loaded.updated_at, i18n.language)})}
                </p>
              )}
            </div>
          </Panel>
        </form>

        {companyId && loaded && (
          <>
            <CompanyContactsPanel companyId={companyId} links={loaded.contacts ?? []} onChanged={record.reload} />

            <Panel
              title={t("custom_apps:companies.apps_title")}
              description={t("custom_apps:companies.apps_description")}
              action={
                <Button variant="secondary" size="sm" asChild>
                  <Link to={customAppsRoute.appNew(companyId)}>
                    <Plus size={14} /> {t("custom_apps:companies.new_app")}
                  </Link>
                </Button>
              }
            >
              {(loaded.apps ?? []).length === 0 ? (
                <EmptyState icon={<AppWindow size={28} />} title={t("custom_apps:companies.apps_empty")} />
              ) : (
                <ul className="flex flex-col gap-2">
                  {loaded.apps.map((app) => (
                    <AppRow key={app.id} app={app} />
                  ))}
                </ul>
              )}
            </Panel>
          </>
        )}
      </div>

      <ConfirmDialog
        open={askDelete}
        title={t("custom_apps:companies.delete_title")}
        body={t("custom_apps:companies.delete_body", {name: form.legalName.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
