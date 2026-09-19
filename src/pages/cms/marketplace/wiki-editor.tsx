import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {FloppyDisk, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {SLUG_PATTERN, orNull, slugify} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import {CONTENT_STATUSES} from "@/lib/marketplace/types.ts";
import type {ContentStatus, Translations, WikiPage, WikiPayload} from "@/lib/marketplace/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {TranslatableField} from "@/components/prose/translatable-field.tsx";
import {TranslationsProvider} from "@/pages/cms/marketplace/components/translations-provider.tsx";

const TITLE_MAX = 200;
const ICON_MAX = 60;
const BODY_MAX = 200000;

type Form = {
  title: string;
  slug: string;
  parentId: string;
  icon: string;
  status: ContentStatus;
  body: string;
  translations: Translations;
};

type FieldName = keyof Form;

const EMPTY: Form = {
  title: "",
  slug: "",
  parentId: "",
  icon: "",
  status: "draft",
  body: "",
  translations: {},
};

const asStatus = (value: string): ContentStatus =>
  (CONTENT_STATUSES as string[]).includes(value) ? (value as ContentStatus) : "draft";

const toForm = (source: WikiPage): Form => ({
  title: source.title,
  slug: source.slug,
  parentId: source.parent_id ?? "",
  icon: source.icon ?? "",
  status: asStatus(source.status),
  body: source.body ?? "",
  translations: source.translations ?? {},
});

/**
 * Writing one wiki page.
 *
 * The only unusual field is the section. The service caps the sidebar at two levels, so the choices
 * offered here are exactly the pages that *can* hold this one: every top-level page except this one
 * and except any page that already has children. Filtering the list is what turns the service's
 * 422 into a choice that was never offered — the rule is the same either way, but a rejected save
 * is a worse way to learn it.
 */
export const WikiEditor = () => {
  const {t} = useTranslation(["cms_marketplace", "cms"]);
  const {id = "", pageId} = useParams<{id: string; pageId?: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (pageId ? marketplaceApi.wiki.get(id, pageId, signal) : Promise.resolve(null)),
      [id, pageId],
    ),
  );

  /* The sibling list, for the section picker. Cheap: the flat listing carries no bodies of its own
     beyond what an editor already asked to see, and a wiki is tens of pages rather than thousands. */
  const siblings = useResource(useCallback((signal: AbortSignal) => marketplaceApi.wiki.list(id, {}, signal), [id]));

  const save = useMutation(
    useCallback(
      (payload: WikiPayload) =>
        pageId
          ? marketplaceApi.wiki.update(id, pageId, payload)
          : marketplaceApi.wiki.create(id, {...payload, title: payload.title ?? ""}),
      [id, pageId],
    ),
  );

  const remove = useMutation(useCallback(() => marketplaceApi.wiki.remove(id, pageId ?? ""), [id, pageId]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
    /* An existing page's slug is its public address, so retitling must not silently move it. */
    setSlugTouched(true);
  }, [loaded]);

  /**
   * The pages this one may hang under.
   *
   * Three exclusions, each of them a shape the sidebar cannot render and the service would refuse:
   * the page itself, a page that is already nested, and — when this page has children of its own —
   * everything, because nesting it would put its children three levels deep.
   */
  const hasChildren = useMemo(
    () => Boolean(pageId) && (siblings.data ?? []).some((page) => page.parent_id === pageId),
    [siblings.data, pageId],
  );

  const parentOptions = useMemo(
    () =>
      hasChildren ? [] : (siblings.data ?? []).filter((page) => page.id !== pageId && !page.parent_id),
    [siblings.data, pageId, hasChildren],
  );

  const sameValue = (key: FieldName) =>
    key === "translations" ? JSON.stringify(form[key]) === JSON.stringify(baseline[key]) : form[key] === baseline[key];

  const dirty = useMemo(
    () => (Object.keys(form) as FieldName[]).some((key) => !sameValue(key)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [form, baseline],
  );

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

    if (slug && !SLUG_PATTERN.test(slug)) found.slug = t("cms:validation.slug_invalid");
    if (form.icon.trim().length > ICON_MAX) found.icon = t("cms:validation.too_long", {max: ICON_MAX});
    if (form.body.length > BODY_MAX) found.body = t("cms:validation.too_long", {max: BODY_MAX});

    return found;
  };

  const payloadOf = (): WikiPayload => {
    const full: WikiPayload = {
      title: form.title.trim(),
      body: orNull(form.body),
      /* An empty select is "top level", which the API spells as an explicit null. */
      parent_id: form.parentId || null,
      icon: orNull(form.icon),
      status: form.status,
      translations: form.translations,
    };
    const slug = form.slug.trim();
    if (slug) full.slug = slug;

    if (!pageId) return full;

    const changed: WikiPayload = {};
    if (form.title !== baseline.title) changed.title = full.title;
    if (form.body !== baseline.body) changed.body = full.body;
    if (form.parentId !== baseline.parentId) changed.parent_id = full.parent_id;
    if (form.icon !== baseline.icon) changed.icon = full.icon;
    if (form.status !== baseline.status) changed.status = full.status;
    if (form.slug !== baseline.slug && slug) changed.slug = slug;
    if (!sameValue("translations")) changed.translations = full.translations;
    return changed;
  };

  const persist = async () => {
    const outcome = await save.run(payloadOf());
    if (!outcome.ok) return;

    if (!pageId) {
      notify(t("admin:common.created"));
      setBaseline(form);
      navigate(marketplaceRoute.wikiItem(id, outcome.data.id), {replace: true});
      return;
    }

    notify(t("admin:common.saved"));
    setBaseline(form);
    record.reload();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    void persist();
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(marketplaceRoute.wiki(id), {replace: true});
  };

  const heading = pageId ? loaded?.title || t("cms_marketplace:wiki.title_edit") : t("cms_marketplace:wiki.title_new");
  const formId = "wiki-editor-form";

  const header = (
    <PageHeader
      title={heading}
      description={t("cms_marketplace:wiki.editor_description")}
      back={{to: marketplaceRoute.wiki(id), label: t("cms_marketplace:wiki.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {pageId && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAskDelete(true)}
              className="border-red-500/50 text-red-300 fs-ripple-danger"
            >
              <Trash size={16}/> {t("admin:common.delete")}
            </Button>
          )}
          <Button type="submit" form={formId} disabled={save.pending}>
            {save.pending ? <Spinner size={16}/> : <FloppyDisk size={16}/>}
            {save.pending
              ? pageId
                ? t("admin:common.saving")
                : t("admin:common.creating")
              : pageId
                ? t("admin:common.save")
                : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  if (pageId && (record.loading || record.error)) {
    return (
      <>
        {header}
        <Panel title={t("cms_marketplace:wiki.page")}>
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
    <TranslationsProvider>
    <>
      {header}

      <form id={formId} onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
          </Alert>
        )}

        <Panel title={t("cms_marketplace:wiki.page")} description={t("cms_marketplace:wiki.page_hint")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <TranslatableField
              label={t("cms_marketplace:fields.title")}
              htmlFor="wiki-title"
              error={errors.title}
              hint={t("cms_marketplace:hints.wiki_title")}
              field="title"
              source={form.title}
              value={form.translations}
              onChange={(value) => setForm((current) => ({...current, translations: value}))}
              limit={TITLE_MAX}
              disabled={save.pending}
            >
              <Input
                id="wiki-title"
                value={form.title}
                onChange={(event) => onTitleChange(event.target.value)}
                maxLength={TITLE_MAX}
                aria-invalid={Boolean(errors.title)}
                autoComplete="off"
                required
              />
            </TranslatableField>

            <Field
              label={t("cms_marketplace:fields.slug")}
              htmlFor="wiki-slug"
              error={errors.slug}
              hint={t("cms_marketplace:hints.wiki_slug")}
            >
              <Input
                id="wiki-slug"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value);
                }}
                placeholder="installation"
                maxLength={80}
                aria-invalid={Boolean(errors.slug)}
                autoComplete="off"
                className="font-mono"
              />
            </Field>

            <Field
              label={t("cms_marketplace:fields.parent")}
              htmlFor="wiki-parent"
              hint={hasChildren ? t("cms_marketplace:hints.parent_locked") : t("cms_marketplace:hints.parent")}
            >
              <Select
                id="wiki-parent"
                value={form.parentId}
                disabled={hasChildren}
                onChange={(event) => set("parentId", event.target.value)}
              >
                <option value="">{t("cms_marketplace:wiki.top_level")}</option>
                {parentOptions.map((page) => (
                  <option key={page.id} value={page.id}>
                    {page.title}
                  </option>
                ))}
              </Select>
            </Field>

            <Field
              label={t("cms_marketplace:fields.status")}
              htmlFor="wiki-status"
              hint={t(`cms_marketplace:wiki.status_hint.${form.status}`)}
            >
              <Select
                id="wiki-status"
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
              label={t("cms_marketplace:fields.icon")}
              htmlFor="wiki-icon"
              error={errors.icon}
              hint={t("cms_marketplace:hints.wiki_icon")}
              className="sm:col-span-2"
            >
              <Input
                id="wiki-icon"
                value={form.icon}
                onChange={(event) => set("icon", event.target.value)}
                placeholder="book-open"
                maxLength={ICON_MAX}
                aria-invalid={Boolean(errors.icon)}
                autoComplete="off"
                className="font-mono sm:max-w-xs"
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("cms_marketplace:wiki.text")} description={t("cms_marketplace:wiki.text_hint")}>
          <TranslatableField
            label={t("cms_marketplace:fields.body")}
            htmlFor="wiki-body"
            error={errors.body}
            field="body"
            source={form.body}
            value={form.translations}
            onChange={(value) => setForm((current) => ({...current, translations: value}))}
            limit={BODY_MAX}
            disabled={save.pending}
          >
            {/* The Markdown editor has a toolbar of its own, so the icon goes in it. */}
            {(action) => (
              <MarkdownEditor
                id="wiki-body"
                value={form.body}
                onChange={(value) => set("body", value)}
                placeholder={t("cms_marketplace:wiki.body_placeholder")}
                maxLength={BODY_MAX}
                rows={28}
                disabled={save.pending}
                action={action}
              />
            )}
          </TranslatableField>
        </Panel>

      </form>

      <ConfirmDialog
        open={askDelete}
        title={t("cms_marketplace:wiki.delete_title")}
        body={t("cms_marketplace:wiki.delete_body", {title: form.title.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_marketplace:wiki.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
    </TranslationsProvider>
  );
};
