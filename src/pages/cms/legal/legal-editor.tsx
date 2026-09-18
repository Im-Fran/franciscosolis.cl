import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {FloppyDisk, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {SLUG_PATTERN, fromDateTimeLocal, orNull, slugify, toDateTimeLocal} from "@/lib/admin/format.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {CONTENT_STATUSES} from "@/lib/cms/types.ts";
import type {ContentStatus, LegalDocument, LegalPayload, Translations} from "@/lib/cms/types.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TranslationsPanel} from "@/pages/cms/components/translations-panel.tsx";

const TITLE_MAX = 200;
const SUMMARY_MAX = 600;
const VERSION_MAX = 40;
const BODY_MAX = 200000;

/** A legal page has no subtitle, so its translatable prose is these three fields. */
const TRANSLATABLE = ["title", "summary", "body"] as const;

type Form = {
  title: string;
  slug: string;
  summary: string;
  status: ContentStatus;
  version: string;
  effectiveAt: string;
  body: string;
  translations: Translations;
};

type FieldName = keyof Form;

const EMPTY: Form = {
  title: "",
  slug: "",
  summary: "",
  status: "draft",
  version: "",
  effectiveAt: "",
  body: "",
  translations: {},
};

/** The API types `status` as a plain string, so an unexpected value falls back to a safe draft. */
const asStatus = (value: string): ContentStatus =>
  (CONTENT_STATUSES as string[]).includes(value) ? (value as ContentStatus) : "draft";

const toForm = (source: LegalDocument): Form => ({
  title: source.title,
  slug: source.slug,
  summary: source.summary ?? "",
  status: asStatus(source.status),
  version: source.version ?? "",
  effectiveAt: toDateTimeLocal(source.effective_at),
  body: source.body ?? "",
  translations: source.translations ?? {},
});

/**
 * Writing one legal document — the privacy policy, the terms, whatever else the site has to state
 * in writing.
 *
 * The same screen creates and edits: the route either carries an id or it does not, which is the
 * only difference between a POST and a PATCH here.
 */
export const LegalEditor = () => {
  const {t, i18n} = useTranslation(["cms_legal", "cms"]);
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  /* What the server last confirmed — the yardstick for "dirty" and for the PATCH's diff. */
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [askPublish, setAskPublish] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (id ? cmsApi.legal.get(id, signal) : Promise.resolve(null)),
      [id],
    ),
  );

  const save = useMutation(
    useCallback(
      (payload: LegalPayload) =>
        id
          ? cmsApi.legal.update(id, payload)
          : cmsApi.legal.create({...payload, title: payload.title ?? "", body: payload.body ?? ""}),
      [id],
    ),
  );

  const remove = useMutation(useCallback(() => cmsApi.legal.remove(id ?? ""), [id]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
    /*
     * An existing document's slug is its public address, so retitling must not silently move it;
     * auto-derivation is only ever offered while the document is being created.
     */
    setSlugTouched(true);
  }, [loaded]);

  /**
   * `translations` is the one field that is an object rather than a string, so it is compared by
   * value. Comparing it by identity would both miss an edit inside the map and, once the panel
   * hands back a new object, call an untouched document dirty.
   */
  const sameValue = (key: FieldName) =>
    key === "translations" ?
      JSON.stringify(form.translations) === JSON.stringify(baseline.translations)
    : form[key] === baseline[key];

  const dirty = useMemo(
    () => (Object.keys(form) as FieldName[]).some((key) => !sameValue(key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, baseline],
  );

  /* The browser's own "leave site?" prompt is the only guard that survives a tab close. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const set = <K extends FieldName>(key: K, value: Form[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => ({...current, [key]: undefined}));
  };

  const onTitleChange = (value: string) => {
    setForm((current) => ({...current, title: value, slug: slugTouched ? current.slug : slugify(value)}));
    setErrors((current) => ({...current, title: undefined, slug: undefined}));
  };

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const title = form.title.trim();
    const slug = form.slug.trim();

    if (!title) found.title = t("cms:validation.required");
    else if (title.length > TITLE_MAX) found.title = t("cms:validation.too_long", {max: TITLE_MAX});

    /*
     * A document with no text is the failure mode here, so it gets a sentence of its own — but only
     * once the text is actually in hand. The detail endpoint's schema promises no more than
     * id/slug/title/status, and refusing to save metadata over a body the API never sent would
     * strand the document; an untouched body is not part of the PATCH either way.
     */
    if (typeof loaded?.body === "string" || !id) {
      if (!form.body.trim()) found.body = t("cms_legal:editor.body_required");
    }
    if (form.body.length > BODY_MAX) found.body = t("cms:validation.too_long", {max: BODY_MAX});

    if (slug && !SLUG_PATTERN.test(slug)) found.slug = t("cms:validation.slug_invalid");
    if (form.summary.trim().length > SUMMARY_MAX) found.summary = t("cms:validation.too_long", {max: SUMMARY_MAX});
    if (form.version.trim().length > VERSION_MAX) found.version = t("cms:validation.too_long", {max: VERSION_MAX});

    return found;
  };

  /** Only what actually changed goes on the wire, so an untouched slug cannot collide on a PATCH. */
  const payloadOf = (): LegalPayload => {
    const full: LegalPayload = {
      title: form.title.trim(),
      body: form.body,
      summary: orNull(form.summary),
      status: form.status,
      version: orNull(form.version),
      effective_at: fromDateTimeLocal(form.effectiveAt),
      translations: form.translations,
    };
    const slug = form.slug.trim();
    if (slug) full.slug = slug;

    if (!id) return full;

    const changed: LegalPayload = {};
    if (form.title !== baseline.title) changed.title = full.title;
    if (form.body !== baseline.body) changed.body = full.body;
    if (form.summary !== baseline.summary) changed.summary = full.summary;
    if (form.status !== baseline.status) changed.status = full.status;
    if (form.version !== baseline.version) changed.version = full.version;
    if (form.effectiveAt !== baseline.effectiveAt) changed.effective_at = full.effective_at;
    if (form.slug !== baseline.slug && slug) changed.slug = slug;
    /* Sent whole or not at all: the API replaces the map rather than merging into it. */
    if (!sameValue("translations")) changed.translations = full.translations;
    return changed;
  };

  const persist = async () => {
    const outcome = await save.run(payloadOf());
    /* A failure leaves the confirmation up, carrying the reason, so it can be retried in place. */
    if (!outcome.ok) return;
    setAskPublish(false);

    if (!id) {
      notify(t("admin:common.created"));
      /* Settled before the route changes, so the unsaved-changes warning does not flash on the way. */
      setBaseline(form);
      navigate(cmsRoute.legalItem(outcome.data.id), {replace: true});
      return;
    }

    notify(t("admin:common.saved"));
    /* The response only guarantees id/slug/title/status, so the fresh state comes from a re-read. */
    setBaseline(form);
    record.reload();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;

    /* Only the transition into `published` is worth a question; re-saving a live document is not. */
    if (form.status === "published" && baseline.status !== "published") {
      setAskPublish(true);
      return;
    }
    void persist();
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(cmsRoute.legal, {replace: true});
  };

  const heading = id ? loaded?.title || t("cms_legal:editor.title_edit") : t("cms_legal:editor.title_new");
  const formId = "legal-editor-form";

  const header = (
    <PageHeader
      title={heading}
      description={id ? t("cms_legal:editor.description_edit") : t("cms_legal:editor.description_new")}
      back={{to: cmsRoute.legal, label: t("cms_legal:editor.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {id && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAskDelete(true)}
              className="border-red-500/50 text-red-300 fs-ripple-danger"
              data-fs-hover
            >
              <Trash size={16}/> {t("admin:common.delete")}
            </Button>
          )}
          <Button type="submit" form={formId} disabled={save.pending} data-fs-hover>
            {save.pending ? <Spinner size={16}/> : <FloppyDisk size={16}/>}
            {save.pending
              ? id
                ? t("admin:common.saving")
                : t("admin:common.creating")
              : id
                ? t("admin:common.save")
                : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  /* An edit that has not loaded yet has no form to show — the panel carries the state instead. */
  if (id && (record.loading || record.error)) {
    return (
      <>
        {header}
        <Panel title={t("cms_legal:editor.document")}>
          <PanelState
            loading={record.loading}
            error={record.error}
            forbidden={record.status === 403}
            onRetry={record.reload}
            ns="cms"
          >
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  return (
    <>
      {header}

      <form id={formId} onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
          </Alert>
        )}

        <Panel title={t("cms_legal:editor.document")} description={t("cms_legal:editor.document_hint")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("cms_legal:editor.fields.title")}
              htmlFor="legal-title"
              error={errors.title}
              hint={t("cms_legal:editor.hints.title")}
              className="sm:col-span-2"
            >
              <Input
                id="legal-title"
                value={form.title}
                onChange={(event) => onTitleChange(event.target.value)}
                maxLength={TITLE_MAX}
                aria-invalid={Boolean(errors.title)}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label={t("cms_legal:editor.fields.slug")}
              htmlFor="legal-slug"
              error={errors.slug}
              hint={t("cms_legal:editor.hints.slug")}
              className="sm:col-span-2"
            >
              <Input
                id="legal-slug"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value);
                }}
                placeholder="privacy"
                maxLength={80}
                aria-invalid={Boolean(errors.slug)}
                autoComplete="off"
                className="font-mono"
              />
            </Field>

            <Field
              label={t("cms_legal:editor.fields.summary")}
              htmlFor="legal-summary"
              error={errors.summary}
              hint={t("cms_legal:editor.hints.summary", {count: form.summary.length, max: SUMMARY_MAX})}
              className="sm:col-span-2"
            >
              <Textarea
                id="legal-summary"
                value={form.summary}
                onChange={(event) => set("summary", event.target.value)}
                rows={3}
                maxLength={SUMMARY_MAX}
                aria-invalid={Boolean(errors.summary)}
                className="resize-y"
              />
            </Field>

            <Field
              label={t("cms_legal:editor.fields.status")}
              htmlFor="legal-status"
              hint={t(`cms_legal:editor.status_hint.${form.status}`)}
            >
              <Select
                id="legal-status"
                value={form.status}
                onChange={(event) => set("status", asStatus(event.target.value))}
              >
                {CONTENT_STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {t(`admin:status.${status}`)}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t("cms_legal:editor.fields.version")}
              htmlFor="legal-version"
              error={errors.version}
              hint={t("cms_legal:editor.hints.version")}
            >
              <Input
                id="legal-version"
                value={form.version}
                onChange={(event) => set("version", event.target.value)}
                placeholder="2026-08"
                maxLength={VERSION_MAX}
                aria-invalid={Boolean(errors.version)}
                autoComplete="off"
                className="font-mono"
              />
            </Field>

            <Field
              label={t("cms_legal:editor.fields.effective_at")}
              htmlFor="legal-effective-at"
              hint={t("cms_legal:editor.hints.effective_at")}
              className="sm:col-span-2"
            >
              <Input
                id="legal-effective-at"
                type="datetime-local"
                value={form.effectiveAt}
                onChange={(event) => set("effectiveAt", event.target.value)}
                className="sm:max-w-xs"
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("cms_legal:editor.text")} description={t("cms_legal:editor.text_hint")}>
          <Field label={t("cms_legal:editor.fields.body")} htmlFor="legal-body" error={errors.body}>
            <MarkdownEditor
              id="legal-body"
              value={form.body}
              onChange={(value) => set("body", value)}
              placeholder={t("cms_legal:editor.body_placeholder")}
              maxLength={BODY_MAX}
              rows={30}
              disabled={save.pending}
            />
          </Field>
        </Panel>

        <TranslationsPanel
          ns="cms_legal"
          fields={TRANSLATABLE}
          source={{title: form.title, summary: form.summary, body: form.body}}
          value={form.translations}
          onChange={(value) => setForm((current) => ({...current, translations: value}))}
          limits={{title: TITLE_MAX, summary: SUMMARY_MAX, body: BODY_MAX}}
          disabled={save.pending}
        />

        {loaded?.updated_at && (
          <p className="text-[13px] text-neutral-600">
            {t("cms_legal:editor.updated_at", {date: formatDateTime(loaded.updated_at, i18n.language)})}
          </p>
        )}
      </form>

      <ConfirmDialog
        open={askPublish}
        title={t("cms_legal:editor.publish_title")}
        body={t("cms_legal:editor.publish_body", {title: form.title.trim()})}
        confirmLabel={save.pending ? t("admin:common.saving") : t("cms_legal:editor.publish_confirm")}
        onConfirm={() => void persist()}
        onClose={() => setAskPublish(false)}
        pending={save.pending}
        error={save.error}
      />

      <ConfirmDialog
        open={askDelete}
        title={t("cms_legal:editor.delete_title")}
        body={t("cms_legal:editor.delete_body", {title: form.title.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_legal:editor.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
