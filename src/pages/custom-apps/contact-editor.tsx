import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {ArrowRight, Buildings, FloppyDisk, Star, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {FormHelpButton, RequiredLegend} from "@/components/ui/help.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime, looksLikeEmail} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatRut} from "@/lib/custom-apps/rut.ts";
import type {ContactDetail, ContactPayload} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TagInput} from "@/components/admin/tag-input.tsx";
import {RoleChips} from "@/pages/custom-apps/components/badges.tsx";
import {FormSection} from "@/pages/custom-apps/components/form-section.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const NAME_MAX = 200;

type Form = {name: string; emails: string[]; phones: string[]; address: string; notes: string};
type FieldName = keyof Form;

const EMPTY: Form = {name: "", emails: [], phones: [], address: "", notes: ""};

const toForm = (source: ContactDetail): Form => ({
  name: source.name,
  emails: source.emails ?? [],
  phones: source.phones ?? [],
  address: source.address ?? "",
  notes: source.notes ?? "",
});

/** A phone as typed, give or take spaces and punctuation: `+56 9 1234 5678`, `(2) 2345 6789`. */
const PHONE_PATTERN = /^\+?[\d\s().-]{6,20}$/;

/**
 * One contact: how to reach them, and which companies they are linked to.
 *
 * The links are edited from the company's side, where the roles mean something — "technical
 * contact" is a fact about a person *at* a client — so here they are listed and linked, not edited.
 */
export const ContactEditor = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {contactId} = useParams<{contactId: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const help = useHelp();

  const [form, setForm] = useState<Form>(EMPTY);
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [askDelete, setAskDelete] = useState(false);

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (contactId ? customAppsApi.contacts.get(contactId, signal) : Promise.resolve(null)),
      [contactId],
    ),
  );

  const save = useMutation(
    useCallback(
      (payload: ContactPayload) =>
        contactId
          ? customAppsApi.contacts.update(contactId, payload)
          : customAppsApi.contacts.create({...payload, name: payload.name ?? ""}),
      [contactId],
    ),
  );
  const remove = useMutation(useCallback(() => customAppsApi.contacts.remove(contactId ?? ""), [contactId]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
  }, [loaded]);

  /* The two lists are compared by value; a fresh array from the tag input is not an edit. */
  const same = (key: FieldName) =>
    Array.isArray(form[key]) ? JSON.stringify(form[key]) === JSON.stringify(baseline[key]) : form[key] === baseline[key];

  const dirty = useMemo(
    () => (Object.keys(form) as FieldName[]).some((key) => !same(key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, baseline],
  );

  const set = <K extends FieldName>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const name = form.name.trim();
    if (!name) found.name = t("custom_apps:validation.required");
    else if (name.length > NAME_MAX) found.name = t("custom_apps:validation.too_long", {max: NAME_MAX});

    const badEmail = form.emails.find((email) => !looksLikeEmail(email));
    if (badEmail) found.emails = t("custom_apps:contacts.invalid_email", {value: badEmail});
    const badPhone = form.phones.find((phone) => !PHONE_PATTERN.test(phone));
    if (badPhone) found.phones = t("custom_apps:contacts.invalid_phone", {value: badPhone});
    return found;
  };

  const payloadOf = (): ContactPayload => {
    const full: ContactPayload = {
      name: form.name.trim(),
      emails: form.emails,
      phones: form.phones,
      address: orNull(form.address),
      notes: orNull(form.notes),
    };
    if (!contactId) return full;

    const changed: ContactPayload = {};
    if (!same("name")) changed.name = full.name;
    /* Sent whole or not at all: the service replaces a list rather than merging into it. */
    if (!same("emails")) changed.emails = full.emails;
    if (!same("phones")) changed.phones = full.phones;
    if (!same("address")) changed.address = full.address;
    if (!same("notes")) changed.notes = full.notes;
    return changed;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const outcome = await save.run(payloadOf());
    if (!outcome.ok) return;

    if (!contactId) {
      notify(t("admin:common.created"));
      setBaseline(form);
      navigate(customAppsRoute.contact(outcome.data.id), {replace: true});
      return;
    }
    notify(t("admin:common.saved"));
    record.reload();
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(customAppsRoute.contacts, {replace: true});
  };

  const formId = "contact-form";
  const header = (
    <PageHeader
      title={contactId ? loaded?.name || t("custom_apps:contacts.edit_title") : t("custom_apps:contacts.new_title")}
      description={contactId ? undefined : t("custom_apps:contacts.new_description")}
      back={{to: customAppsRoute.contacts, label: t("custom_apps:contacts.back")}}
      actions={
        <>
          <FormHelpButton help={help.form("contacts.form_help")} />
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {contactId && (
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
            {contactId ? t("admin:common.save") : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  if (contactId && (record.loading || record.error) && !loaded) {
    return (
      <>
        {header}
        <Panel title={t("custom_apps:contacts.details")}>
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
          <Panel title={t("custom_apps:contacts.details")} description={t("custom_apps:contacts.details_hint")}>
            <div className="flex flex-col gap-5">
              {save.error && (
                <Alert tone="error" title={t("admin:common.failed")}>
                  {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
                </Alert>
              )}

              <RequiredLegend />

              <FormSection title={t("custom_apps:contacts.sections.person")}>
                <Field
                  label={t("custom_apps:contacts.fields.name")}
                  htmlFor="contact-name"
                  error={errors.name}
                  help={help.field("contacts.help.name")}
                  required
                >
                  <Input
                    id="contact-name"
                    value={form.name}
                    onChange={(event) => set("name", event.target.value)}
                    maxLength={NAME_MAX}
                    aria-invalid={Boolean(errors.name)}
                    autoComplete="off"
                    required
                  />
                </Field>
              </FormSection>

              <FormSection title={t("custom_apps:contacts.sections.contact")} bodyClassName="sm:grid-cols-2">
                <Field
                  label={t("custom_apps:contacts.fields.emails")}
                  htmlFor="contact-emails"
                  error={errors.emails}
                  hint={t("custom_apps:contacts.hints.list")}
                  help={help.field("contacts.help.emails")}
                >
                  <TagInput
                    id="contact-emails"
                    value={form.emails}
                    onChange={(value) => set("emails", value)}
                    placeholder="nombre@empresa.cl"
                    maxTagLength={254}
                  />
                </Field>

                <Field
                  label={t("custom_apps:contacts.fields.phones")}
                  htmlFor="contact-phones"
                  error={errors.phones}
                  hint={t("custom_apps:contacts.hints.list")}
                  help={help.field("contacts.help.phones")}
                >
                  <TagInput
                    id="contact-phones"
                    value={form.phones}
                    onChange={(value) => set("phones", value)}
                    placeholder="+56 9 1234 5678"
                    maxTagLength={20}
                  />
                </Field>
              </FormSection>

              <FormSection title={t("custom_apps:contacts.sections.address")}>
                <Field label={t("custom_apps:fields.address")} htmlFor="contact-address" help={help.field("contacts.help.address")}>
                  <Input
                    id="contact-address"
                    value={form.address}
                    onChange={(event) => set("address", event.target.value)}
                    autoComplete="off"
                  />
                </Field>
              </FormSection>

              <FormSection title={t("custom_apps:contacts.sections.notes")}>
                <Field label={t("custom_apps:fields.notes")} htmlFor="contact-notes" help={help.field("contacts.help.notes")}>
                  <Textarea
                    id="contact-notes"
                    value={form.notes}
                    onChange={(event) => set("notes", event.target.value)}
                    rows={4}
                    className="resize-y"
                  />
                </Field>
              </FormSection>

              {loaded?.updated_at && (
                <p className="text-[13px] text-neutral-600">
                  {t("custom_apps:updated_at", {date: formatDateTime(loaded.updated_at, i18n.language)})}
                </p>
              )}
            </div>
          </Panel>
        </form>

        {contactId && loaded && (
          <Panel title={t("custom_apps:contacts.companies_title")} description={t("custom_apps:contacts.companies_description")}>
            {(loaded.companies ?? []).length === 0 ? (
              <EmptyState
                icon={<Buildings size={28} />}
                title={t("custom_apps:contacts.companies_empty")}
                description={t("custom_apps:contacts.companies_empty_description")}
              />
            ) : (
              <ul className="flex flex-col gap-2">
                {loaded.companies.map((link) => (
                  <li key={link.company_id}>
                    <Link
                      to={customAppsRoute.company(link.company_id)}
                      className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="flex items-center gap-2 text-sm text-text">
                          <span className="truncate">{link.company.trade_name || link.company.legal_name}</span>
                          {link.is_primary && (
                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-300">
                              <Star size={12} weight="fill" /> {t("custom_apps:company_contacts.primary")}
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-[12px] text-neutral-500">
                          {[link.company.trade_name ? link.company.legal_name : null, formatRut(link.company.rut)]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                        <span className="mt-2 block">
                          <RoleChips roles={link.roles} />
                        </span>
                      </span>
                      <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
      </div>

      <ConfirmDialog
        open={askDelete}
        title={t("custom_apps:contacts.delete_title")}
        body={t("custom_apps:contacts.delete_body", {name: form.name.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
