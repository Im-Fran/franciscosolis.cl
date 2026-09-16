import {useCallback, useEffect, useId, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate, useParams} from "react-router-dom";
import {Code, Eye, PaperPlaneTilt, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {SLUG_PATTERN, orNull, slugify} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import type {EmailTemplate, EmailTemplatePayload, NewEmailTemplate} from "@/lib/cms/types.ts";

/* The API's own limits, from `/cms/admin/email-templates` in the OpenAPI document. */
const NAME_MAX = 120;
const SUBJECT_MAX = 200;
const DESCRIPTION_MAX = 400;
const BODY_MAX = 200000;

/**
 * A placeholder written literally in the copy would be read as an i18next interpolation, so the
 * example is handed to `t()` as a value instead.
 */
const PLACEHOLDER_EXAMPLE = "{{name}}";

const VARIABLE_PATTERN = /\{\{\s*([\w.-]+)\s*\}\}/g;

/**
 * The distinct `{{variable}}` names appearing in a subject or a body.
 *
 * This is a reading of the text as it stands, not a contract: the API publishes no list of the
 * variables a template accepts, it simply interpolates whatever the send supplies. Treat the chips
 * as a reminder of what a send will have to pass, never as validation.
 */
const scanVariables = (...sources: string[]) => {
  const found = new Set<string>();
  for (const source of sources) {
    for (const match of source.matchAll(VARIABLE_PATTERN)) found.add(match[1]);
  }
  return [...found].sort((a, b) => a.localeCompare(b));
};

type Form = {
  name: string;
  slug: string;
  description: string;
  subject: string;
  html: string;
  text: string;
};

type Errors = Partial<Record<keyof Form, string>>;

const EMPTY_FORM: Form = {name: "", slug: "", description: "", subject: "", html: "", text: ""};

const formOf = (template: EmailTemplate): Form => ({
  name: template.name ?? "",
  slug: template.slug,
  description: template.description ?? "",
  subject: template.subject,
  html: template.html ?? "",
  text: template.text ?? "",
});

/**
 * Writing one reusable message: the subject and bodies the API renders whenever a send names this
 * template by its slug.
 *
 * The same screen creates and edits — `/cms/email/templates/new` has no `:id`, which is the only
 * difference between the two modes.
 */
export const TemplateEditor = () => {
  const {t, i18n} = useTranslation(["cms_templates", "cms"]);
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const formId = useId();

  const template = useResource(
    useCallback(
      (signal: AbortSignal) => (id ? cmsApi.templates.get(id, signal) : Promise.resolve(null)),
      [id],
    ),
  );

  const create = useMutation(useCallback((body: NewEmailTemplate) => cmsApi.templates.create(body), []));
  const save = useMutation(
    useCallback((templateId: string, body: EmailTemplatePayload) => cmsApi.templates.update(templateId, body), []),
  );
  const remove = useMutation(useCallback((templateId: string) => cmsApi.templates.remove(templateId), []));

  const [form, setForm] = useState<Form>(EMPTY_FORM);
  /* What the server last told us, so "dirty" means "differs from what is stored", not "was typed in". */
  const [baseline, setBaseline] = useState<Form>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [preview, setPreview] = useState(false);
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    if (!template.data) return;
    const loaded = formOf(template.data);
    setForm(loaded);
    setBaseline(loaded);
    /* An existing template already has a slug; re-deriving it from the name would silently move it. */
    setSlugTouched(true);
  }, [template.data]);

  const dirty = useMemo(
    () => (Object.keys(EMPTY_FORM) as (keyof Form)[]).some((key) => form[key] !== baseline[key]),
    [form, baseline],
  );

  /* Leaving with unsaved edits is almost always a mistake; the browser asks before the tab goes. */
  useEffect(() => {
    if (!dirty) return;
    const guard = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", guard);
    return () => window.removeEventListener("beforeunload", guard);
  }, [dirty]);

  const variables = useMemo(
    () => scanVariables(form.subject, form.html, form.text),
    [form.subject, form.html, form.text],
  );

  const update = <K extends keyof Form>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => (current[key] ? {...current, [key]: undefined} : current));
  };

  const updateName = (value: string) =>
    setForm((current) => ({...current, name: value, slug: slugTouched ? current.slug : slugify(value)}));

  const validate = (): Errors => {
    const found: Errors = {};
    const name = form.name.trim();
    const subject = form.subject.trim();
    const slug = form.slug.trim();

    if (!name) found.name = t("cms:validation.required");
    else if (name.length > NAME_MAX) found.name = t("cms:validation.too_long", {max: NAME_MAX});

    if (!subject) found.subject = t("cms:validation.required");
    else if (subject.length > SUBJECT_MAX) found.subject = t("cms:validation.too_long", {max: SUBJECT_MAX});

    if (slug && !SLUG_PATTERN.test(slug)) found.slug = t("cms:validation.slug_invalid");

    if (form.description.trim().length > DESCRIPTION_MAX) {
      found.description = t("cms:validation.too_long", {max: DESCRIPTION_MAX});
    }
    if (form.html.length > BODY_MAX) found.html = t("cms:validation.too_long", {max: BODY_MAX});
    if (form.text.length > BODY_MAX) found.text = t("cms:validation.too_long", {max: BODY_MAX});

    /*
     * The API documents a create as requiring at least one of the two bodies, so a template with
     * neither is refused here rather than sent to be rejected. It says nothing of the sort about a
     * PATCH, and inventing the rule there could block a legitimate edit — an update with both
     * emptied only gets the warning below.
     */
    if (!id && form.html.trim() === "" && form.text.trim() === "") {
      found.html = t("cms_templates:editor.body_required");
    }

    return found;
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    const slug = form.slug.trim();
    /* The slug key is omitted rather than sent empty, which is what lets the service derive one. */
    const body = {
      name: form.name.trim(),
      subject: form.subject.trim(),
      description: orNull(form.description),
      html: orNull(form.html),
      text: orNull(form.text),
      ...(slug ? {slug} : {}),
    };

    if (id) {
      const outcome = await save.run(id, body);
      if (!outcome.ok) return;
      notify(t("admin:common.saved"));
      template.reload();
      return;
    }

    const outcome = await create.run(body);
    if (!outcome.ok) return;
    notify(t("admin:common.created"));
    navigate(cmsRoute.templateItem(outcome.data.id), {replace: true});
  };

  const confirmDelete = async () => {
    if (!id) return;
    const outcome = await remove.run(id);
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setConfirming(false);
    navigate(cmsRoute.templates, {replace: true});
  };

  const loading = Boolean(id) && template.loading;
  const unreadable = Boolean(id) && !template.loading && template.error !== null;
  const pending = create.pending || save.pending;
  const failure = create.error ?? save.error;
  const bodiesEmpty = form.html.trim() === "" && form.text.trim() === "";
  const slug = form.slug.trim();

  const counter = (value: string) => (
    <span className={value.length > BODY_MAX ? "text-red-400" : "text-neutral-600"}>
      {t("cms_templates:editor.counter", {
        chars: value.length.toLocaleString(i18n.language),
        max: BODY_MAX.toLocaleString(i18n.language),
      })}
    </span>
  );

  return (
    <>
      <PageHeader
        title={id ? t("cms_templates:editor.title") : t("cms_templates:editor.new_title")}
        description={id ? t("cms_templates:editor.description") : t("cms_templates:editor.new_description")}
        back={{to: cmsRoute.templates, label: t("cms_templates:editor.back")}}
        actions={
          !loading &&
          !unreadable && (
            <>
              {id && slug && (
                /*
                 * The compose screen picks the template up from `?template=`; if it ever stops
                 * reading the parameter, this still lands on a blank compose form, which is where
                 * someone wanting to send a test was heading anyway.
                 */
                <Button variant="secondary" size="sm" asChild data-fs-hover>
                  <Link to={`${cmsRoute.emailNew}?template=${encodeURIComponent(slug)}`}>
                    <PaperPlaneTilt size={14}/> {t("cms_templates:editor.send_test")}
                  </Link>
                </Button>
              )}
              {id && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="border-red-500/50 text-red-300 hover:bg-red-500/10"
                  onClick={() => {
                    remove.reset();
                    setConfirming(true);
                  }}
                  data-fs-hover
                >
                  <Trash size={14}/> {t("admin:common.delete")}
                </Button>
              )}
              <Button type="submit" form={formId} size="sm" disabled={pending} data-fs-hover>
                {pending && <Spinner size={14}/>}
                {id ?
                  pending ? t("admin:common.saving") : t("admin:common.save")
                : pending ? t("admin:common.creating")
                : t("admin:common.create")}
              </Button>
            </>
          )
        }
      />

      {loading || unreadable ?
        <Panel title={t("cms_templates:editor.panel_template")}>
          <PanelState
            loading={loading}
            error={template.error}
            forbidden={template.status === 403}
            onRetry={template.reload}
            ns="cms"
          >
            {null}
          </PanelState>
        </Panel>
      : <form id={formId} onSubmit={(event) => void submit(event)} className="flex flex-col gap-6" noValidate>
          {failure && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${failure}`, {defaultValue: failure})}
            </Alert>
          )}

          {bodiesEmpty && (
            <Alert tone="info" title={t("cms_templates:editor.no_body_title")}>
              {t("cms_templates:editor.no_body_body")}
            </Alert>
          )}

          <Panel
            title={t("cms_templates:editor.panel_template")}
            description={t("cms_templates:editor.panel_template_description")}
          >
            <div className="flex flex-col gap-5">
              <div className="grid gap-5 md:grid-cols-2">
                <Field
                  label={t("cms_templates:editor.name_label")}
                  htmlFor={`${formId}-name`}
                  hint={t("cms_templates:editor.name_hint")}
                  error={errors.name}
                >
                  <Input
                    id={`${formId}-name`}
                    value={form.name}
                    onChange={(event) => updateName(event.target.value)}
                    maxLength={NAME_MAX}
                    aria-invalid={Boolean(errors.name)}
                    placeholder={t("cms_templates:editor.name_placeholder")}
                    required
                  />
                </Field>

                <Field
                  label={t("cms_templates:editor.slug_label")}
                  htmlFor={`${formId}-slug`}
                  hint={t("cms_templates:editor.slug_hint")}
                  error={errors.slug}
                >
                  <Input
                    id={`${formId}-slug`}
                    value={form.slug}
                    onChange={(event) => {
                      setSlugTouched(true);
                      update("slug", event.target.value);
                    }}
                    maxLength={80}
                    aria-invalid={Boolean(errors.slug)}
                    placeholder={t("cms_templates:editor.slug_placeholder")}
                    className="font-mono text-[13px]"
                  />
                </Field>
              </div>

              <Field
                label={t("cms_templates:editor.description_label")}
                htmlFor={`${formId}-description`}
                hint={t("cms_templates:editor.description_hint")}
                error={errors.description}
              >
                <Textarea
                  id={`${formId}-description`}
                  value={form.description}
                  onChange={(event) => update("description", event.target.value)}
                  maxLength={DESCRIPTION_MAX}
                  aria-invalid={Boolean(errors.description)}
                  rows={2}
                  className="resize-y"
                  placeholder={t("cms_templates:editor.description_placeholder")}
                />
              </Field>

              <Field
                label={t("cms_templates:editor.subject_label")}
                htmlFor={`${formId}-subject`}
                hint={t("cms_templates:editor.subject_hint", {example: PLACEHOLDER_EXAMPLE})}
                error={errors.subject}
              >
                <Input
                  id={`${formId}-subject`}
                  value={form.subject}
                  onChange={(event) => update("subject", event.target.value)}
                  maxLength={SUBJECT_MAX}
                  aria-invalid={Boolean(errors.subject)}
                  placeholder={t("cms_templates:editor.subject_placeholder")}
                  required
                />
              </Field>
            </div>
          </Panel>

          <Panel
            title={t("cms_templates:editor.panel_html")}
            description={t("cms_templates:editor.panel_html_description")}
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setPreview((current) => !current)}
                aria-pressed={preview}
                data-fs-hover
              >
                {preview ? <Code size={14}/> : <Eye size={14}/>}
                {preview ? t("cms_templates:editor.edit_html") : t("cms_templates:editor.preview")}
              </Button>
            }
          >
            <div className="flex flex-col gap-2">
              {preview ?
                /*
                 * An email template is HTML written to be rendered by someone else's client, so the
                 * CMS must not be the place where it executes: the preview goes into a fully
                 * sandboxed frame — no scripts, no same-origin access, no forms — rather than
                 * through `dangerouslySetInnerHTML`, where a template could reach this session.
                 */
                <iframe
                  sandbox=""
                  srcDoc={form.html}
                  title={t("cms_templates:editor.preview_title")}
                  className="h-[28rem] w-full rounded-[var(--radius-md)] border border-neutral-800 bg-white"
                />
              : /* No `maxLength`: pasting a body over the limit should be told, not silently cut. */
                <Textarea
                  id={`${formId}-html`}
                  value={form.html}
                  onChange={(event) => update("html", event.target.value)}
                  aria-label={t("cms_templates:editor.panel_html")}
                  aria-invalid={Boolean(errors.html)}
                  rows={18}
                  spellCheck={false}
                  className="resize-y font-mono text-[13px] leading-relaxed"
                  placeholder={t("cms_templates:editor.html_placeholder")}
                />
              }
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-neutral-600">{t("cms_templates:editor.html_hint")}</span>
                {counter(form.html)}
              </div>
              {errors.html && <p className="text-xs text-red-400">{errors.html}</p>}
            </div>
          </Panel>

          <Panel
            title={t("cms_templates:editor.panel_text")}
            description={t("cms_templates:editor.panel_text_description")}
          >
            <div className="flex flex-col gap-2">
              <Textarea
                id={`${formId}-text`}
                value={form.text}
                onChange={(event) => update("text", event.target.value)}
                aria-label={t("cms_templates:editor.panel_text")}
                aria-invalid={Boolean(errors.text)}
                rows={12}
                className="resize-y font-mono text-[13px] leading-relaxed"
                placeholder={t("cms_templates:editor.text_placeholder")}
              />
              <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                <span className="text-neutral-600">{t("cms_templates:editor.text_hint")}</span>
                {counter(form.text)}
              </div>
              {errors.text && <p className="text-xs text-red-400">{errors.text}</p>}
            </div>
          </Panel>

          <Panel
            title={t("cms_templates:editor.panel_variables")}
            description={t("cms_templates:editor.panel_variables_description", {example: PLACEHOLDER_EXAMPLE})}
          >
            {variables.length === 0 ?
              <p className="text-[13px] text-neutral-500">
                {t("cms_templates:editor.variables_empty", {example: PLACEHOLDER_EXAMPLE})}
              </p>
            : <ul className="flex flex-wrap gap-2">
                {variables.map((variable) => (
                  <li key={variable}>
                    <Badge variant="neutral" size="sm" className="font-mono">{variable}</Badge>
                  </li>
                ))}
              </ul>
            }
          </Panel>

          <div className="flex flex-wrap items-center justify-end gap-3">
            {dirty && <span className="mr-auto text-[13px] text-neutral-500">{t("admin:common.unsaved")}</span>}
            <Button variant="ghost" size="sm" asChild data-fs-hover>
              <Link to={cmsRoute.templates}>{t("admin:common.cancel")}</Link>
            </Button>
            <Button type="submit" size="sm" disabled={pending} data-fs-hover>
              {pending && <Spinner size={14}/>}
              {id ?
                pending ? t("admin:common.saving") : t("admin:common.save")
              : pending ? t("admin:common.creating")
              : t("admin:common.create")}
            </Button>
          </div>
        </form>
      }

      <ConfirmDialog
        open={confirming}
        title={t("cms_templates:editor.delete_title")}
        body={t("cms_templates:editor.delete_body", {name: form.name.trim() || slug, slug})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_templates:editor.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setConfirming(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
