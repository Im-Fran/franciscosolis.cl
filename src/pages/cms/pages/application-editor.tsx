import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowSquareOut, FloppyDisk, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {SLUG_PATTERN, orNull, slugify} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {pagesApi} from "@/lib/pages/client.ts";
import {applicationRoute, pagesRoute} from "@/lib/pages/config.ts";
import {usePagesTabs} from "@/lib/pages/content.ts";
import {CONTENT_STATUSES} from "@/lib/pages/types.ts";
import type {
  Application,
  ApplicationLink,
  ApplicationPayload,
  ContentStatus,
  Translations,
} from "@/lib/pages/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {MarkdownEditor} from "@/pages/cms/components/markdown-editor.tsx";
import {ApplicationNav} from "@/pages/cms/pages/components/application-nav.tsx";
import {LinksField} from "@/pages/cms/pages/components/links-field.tsx";
import {TabsField} from "@/pages/cms/pages/components/tabs-field.tsx";
import {TranslationsPanel} from "@/pages/cms/pages/components/translations-panel.tsx";

/** The API's own caps. Kept here so a field cannot accept what the service will refuse. */
const NAME_MAX = 120;
const TAGLINE_MAX = 200;
const SUMMARY_MAX = 600;
const BODY_MAX = 200000;

/** The prose an application can be translated into another language. Nothing structural is here. */
const TRANSLATABLE = ["name", "tagline", "summary", "overview_body", "contact_body"] as const;

/** `#rgb` or `#rrggbb`; the service refuses any other CSS colour, and the page interpolates it. */
const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

type Form = {
  name: string;
  slug: string;
  tagline: string;
  summary: string;
  status: ContentStatus;
  featured: boolean;
  bannerImageUrl: string;
  iconImageUrl: string;
  accentColor: string;
  tabs: string[];
  links: ApplicationLink[];
  overviewBody: string;
  contactBody: string;
  translations: Translations;
};

type FieldName = keyof Form;

const EMPTY: Form = {
  name: "",
  slug: "",
  tagline: "",
  summary: "",
  status: "draft",
  featured: false,
  bannerImageUrl: "",
  iconImageUrl: "",
  accentColor: "",
  tabs: ["overview"],
  links: [],
  overviewBody: "",
  contactBody: "",
  translations: {},
};

/** The API types `status` as a plain string, so an unexpected value falls back to a safe draft. */
const asStatus = (value: string): ContentStatus =>
  (CONTENT_STATUSES as string[]).includes(value) ? (value as ContentStatus) : "draft";

const toForm = (source: Application): Form => ({
  name: source.name,
  slug: source.slug,
  tagline: source.tagline ?? "",
  summary: source.summary ?? "",
  status: asStatus(source.status),
  featured: source.featured ?? false,
  bannerImageUrl: source.banner_image_url ?? "",
  iconImageUrl: source.icon_image_url ?? "",
  accentColor: source.accent_color ?? "",
  tabs: source.tabs.length > 0 ? source.tabs : ["overview"],
  links: source.links ?? [],
  overviewBody: source.overview_body ?? "",
  contactBody: source.contact_body ?? "",
  translations: source.translations ?? {},
});

/**
 * Creating and editing one application page.
 *
 * The same screen does both: the route either carries an id or it does not, which is the only
 * difference between a POST and a PATCH here. What it cannot do is edit the release notes or the
 * wiki — those are lists with screens of their own, reachable from the navigation above, and only
 * once the application exists to hold them.
 */
export const ApplicationEditor = () => {
  const {t, i18n} = useTranslation(["cms_pages", "cms"]);
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const availableTabs = usePagesTabs();

  const [form, setForm] = useState<Form>(EMPTY);
  /* What the server last confirmed — the yardstick for "dirty" and for the PATCH's diff. */
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [slugTouched, setSlugTouched] = useState(false);
  const [askPublish, setAskPublish] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const record = useResource(
    useCallback((signal: AbortSignal) => (id ? pagesApi.applications.get(id, signal) : Promise.resolve(null)), [id]),
  );

  const save = useMutation(
    useCallback(
      (payload: ApplicationPayload) =>
        id
          ? pagesApi.applications.update(id, payload)
          : pagesApi.applications.create({...payload, name: payload.name ?? ""}),
      [id],
    ),
  );

  const remove = useMutation(useCallback(() => pagesApi.applications.remove(id ?? ""), [id]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
    /*
     * An existing application's slug is its public address, so renaming must not silently move it;
     * auto-derivation is only ever offered while the page is being created.
     */
    setSlugTouched(true);
  }, [loaded]);

  /** The three object-valued fields are compared by value; identity would both miss an edit and
      call an untouched page dirty the moment a child hands back a new array. */
  const sameValue = (key: FieldName) =>
    key === "translations" || key === "links" || key === "tabs"
      ? JSON.stringify(form[key]) === JSON.stringify(baseline[key])
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

  const onNameChange = (value: string) => {
    setForm((current) => ({...current, name: value, slug: slugTouched ? current.slug : slugify(value)}));
    setErrors((current) => ({...current, name: undefined, slug: undefined}));
  };

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const name = form.name.trim();
    const slug = form.slug.trim();

    if (!name) found.name = t("cms:validation.required");
    else if (name.length > NAME_MAX) found.name = t("cms:validation.too_long", {max: NAME_MAX});

    if (slug && !SLUG_PATTERN.test(slug)) found.slug = t("cms:validation.slug_invalid");
    if (form.tagline.trim().length > TAGLINE_MAX) found.tagline = t("cms:validation.too_long", {max: TAGLINE_MAX});
    if (form.summary.trim().length > SUMMARY_MAX) found.summary = t("cms:validation.too_long", {max: SUMMARY_MAX});

    if (form.accentColor.trim() && !HEX_PATTERN.test(form.accentColor.trim())) {
      found.accentColor = t("cms_pages:editor.accent_invalid");
    }

    /* A link with no destination is the one thing the API will certainly refuse, and the message it
       sends back names a field index rather than a row an editor can see. */
    if (form.links.some((link) => !link.url.trim())) found.links = t("cms_pages:editor.link_url_required");

    return found;
  };

  const linksPayload = (): ApplicationLink[] =>
    form.links
      .filter((link) => link.url.trim())
      .map((link) => ({kind: link.kind, url: link.url.trim(), label: orNull(link.label ?? "")}));

  /** Only what actually changed goes on the wire, so an untouched slug cannot collide on a PATCH. */
  const payloadOf = (): ApplicationPayload => {
    const full: ApplicationPayload = {
      name: form.name.trim(),
      tagline: orNull(form.tagline),
      summary: orNull(form.summary),
      status: form.status,
      featured: form.featured,
      banner_image_url: orNull(form.bannerImageUrl),
      icon_image_url: orNull(form.iconImageUrl),
      accent_color: orNull(form.accentColor),
      tabs: form.tabs,
      links: linksPayload(),
      overview_body: orNull(form.overviewBody),
      contact_body: orNull(form.contactBody),
      translations: form.translations,
    };
    const slug = form.slug.trim();
    if (slug) full.slug = slug;

    if (!id) return full;

    const changed: ApplicationPayload = {};
    if (form.name !== baseline.name) changed.name = full.name;
    if (form.tagline !== baseline.tagline) changed.tagline = full.tagline;
    if (form.summary !== baseline.summary) changed.summary = full.summary;
    if (form.status !== baseline.status) changed.status = full.status;
    if (form.featured !== baseline.featured) changed.featured = full.featured;
    if (form.bannerImageUrl !== baseline.bannerImageUrl) changed.banner_image_url = full.banner_image_url;
    if (form.iconImageUrl !== baseline.iconImageUrl) changed.icon_image_url = full.icon_image_url;
    if (form.accentColor !== baseline.accentColor) changed.accent_color = full.accent_color;
    if (form.overviewBody !== baseline.overviewBody) changed.overview_body = full.overview_body;
    if (form.contactBody !== baseline.contactBody) changed.contact_body = full.contact_body;
    if (form.slug !== baseline.slug && slug) changed.slug = slug;
    /* Sent whole or not at all: the API replaces each of these rather than merging into it. */
    if (!sameValue("tabs")) changed.tabs = full.tabs;
    if (!sameValue("links")) changed.links = full.links;
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
      navigate(pagesRoute.item(outcome.data.id), {replace: true});
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

    /* Only the transition into `published` is worth a question; re-saving a live page is not. */
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
    navigate(pagesRoute.list, {replace: true});
  };

  const heading = id ? loaded?.name || t("cms_pages:editor.title_edit") : t("cms_pages:editor.title_new");
  const formId = "application-editor-form";

  const header = (
    <PageHeader
      title={heading}
      description={id ? t("cms_pages:editor.description_edit") : t("cms_pages:editor.description_new")}
      back={{to: pagesRoute.list, label: t("cms_pages:editor.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {loaded?.status === "published" && (
            <Button variant="ghost" asChild data-fs-hover>
              <a href={applicationRoute.overview(loaded.slug)} target="_blank" rel="noopener">
                <ArrowSquareOut size={16}/> {t("cms_pages:editor.view")}
              </a>
            </Button>
          )}
          {id && (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setAskDelete(true)}
              className="border-red-500/50 text-red-300 hover:bg-red-500/10"
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
        <Panel title={t("cms_pages:editor.identity")}>
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
      {id && <ApplicationNav id={id}/>}

      <form id={formId} onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
          </Alert>
        )}

        <Panel title={t("cms_pages:editor.identity")} description={t("cms_pages:editor.identity_hint")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("cms_pages:fields.name")}
              htmlFor="application-name"
              error={errors.name}
              hint={t("cms_pages:hints.name")}
            >
              <Input
                id="application-name"
                value={form.name}
                onChange={(event) => onNameChange(event.target.value)}
                maxLength={NAME_MAX}
                aria-invalid={Boolean(errors.name)}
                autoComplete="off"
                required
              />
            </Field>

            <Field
              label={t("cms_pages:fields.slug")}
              htmlFor="application-slug"
              error={errors.slug}
              hint={t("cms_pages:hints.slug")}
            >
              <Input
                id="application-slug"
                value={form.slug}
                onChange={(event) => {
                  setSlugTouched(true);
                  set("slug", event.target.value);
                }}
                placeholder="openbattery"
                maxLength={80}
                aria-invalid={Boolean(errors.slug)}
                autoComplete="off"
                className="font-mono"
              />
            </Field>

            <Field
              label={t("cms_pages:fields.tagline")}
              htmlFor="application-tagline"
              error={errors.tagline}
              hint={t("cms_pages:hints.tagline")}
              className="sm:col-span-2"
            >
              <Input
                id="application-tagline"
                value={form.tagline}
                onChange={(event) => set("tagline", event.target.value)}
                maxLength={TAGLINE_MAX}
                aria-invalid={Boolean(errors.tagline)}
                autoComplete="off"
              />
            </Field>

            <Field
              label={t("cms_pages:fields.summary")}
              htmlFor="application-summary"
              error={errors.summary}
              hint={t("cms_pages:hints.summary", {count: form.summary.length, max: SUMMARY_MAX})}
              className="sm:col-span-2"
            >
              <Textarea
                id="application-summary"
                value={form.summary}
                onChange={(event) => set("summary", event.target.value)}
                rows={3}
                maxLength={SUMMARY_MAX}
                aria-invalid={Boolean(errors.summary)}
                className="resize-y"
              />
            </Field>

            <Field
              label={t("cms_pages:fields.status")}
              htmlFor="application-status"
              hint={t(`cms_pages:editor.status_hint.${form.status}`)}
            >
              <Select
                id="application-status"
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
              label={t("cms_pages:fields.featured")}
              htmlFor="application-featured"
              hint={t("cms_pages:hints.featured")}
            >
              <label className="flex h-11 items-center gap-2.5 text-sm text-neutral-300">
                <input
                  id="application-featured"
                  type="checkbox"
                  checked={form.featured}
                  onChange={(event) => set("featured", event.target.checked)}
                  className="size-4 accent-[var(--color-accent)]"
                />
                {t("cms_pages:fields.featured_label")}
              </label>
            </Field>
          </div>
        </Panel>

        <Panel title={t("cms_pages:editor.appearance")} description={t("cms_pages:editor.appearance_hint")}>
          <div className="grid gap-5 sm:grid-cols-2">
            <Field
              label={t("cms_pages:fields.banner")}
              htmlFor="application-banner"
              hint={t("cms_pages:hints.banner")}
              className="sm:col-span-2"
            >
              <Input
                id="application-banner"
                type="url"
                value={form.bannerImageUrl}
                onChange={(event) => set("bannerImageUrl", event.target.value)}
                placeholder="https://"
                className="font-mono text-[13px]"
              />
            </Field>

            {/* Shown as soon as there is a URL: a broken banner is far easier to notice than to
                debug from the public page, and this is the only place it is cheap to check. */}
            {form.bannerImageUrl.trim() && (
              <div className="sm:col-span-2">
                <img
                  src={form.bannerImageUrl}
                  alt=""
                  className="max-h-48 w-full rounded-[var(--radius-md)] border border-neutral-800 object-contain"
                />
              </div>
            )}

            <Field label={t("cms_pages:fields.icon")} htmlFor="application-icon" hint={t("cms_pages:hints.icon")}>
              <Input
                id="application-icon"
                type="url"
                value={form.iconImageUrl}
                onChange={(event) => set("iconImageUrl", event.target.value)}
                placeholder="https://"
                className="font-mono text-[13px]"
              />
            </Field>

            <Field
              label={t("cms_pages:fields.accent")}
              htmlFor="application-accent"
              error={errors.accentColor}
              hint={t("cms_pages:hints.accent")}
            >
              <div className="flex items-center gap-2">
                <Input
                  id="application-accent"
                  value={form.accentColor}
                  onChange={(event) => set("accentColor", event.target.value)}
                  placeholder="#A855F7"
                  maxLength={7}
                  aria-invalid={Boolean(errors.accentColor)}
                  className="font-mono"
                />
                <span
                  aria-hidden="true"
                  className="size-11 shrink-0 rounded-[var(--radius-md)] border border-neutral-800"
                  style={{background: HEX_PATTERN.test(form.accentColor.trim()) ? form.accentColor.trim() : undefined}}
                />
              </div>
            </Field>
          </div>
        </Panel>

        <Panel title={t("cms_pages:editor.tabs")} description={t("cms_pages:editor.tabs_hint")}>
          <TabsField
            available={availableTabs}
            value={form.tabs}
            onChange={(tabs) => set("tabs", tabs)}
            disabled={save.pending}
          />
        </Panel>

        <Panel title={t("cms_pages:editor.links")} description={t("cms_pages:editor.links_hint")}>
          {errors.links && <p className="mb-3 text-xs text-red-400">{errors.links}</p>}
          <LinksField
            idPrefix="application-link"
            value={form.links}
            onChange={(links) => set("links", links)}
            disabled={save.pending}
          />
        </Panel>

        <Panel title={t("cms_pages:editor.overview")} description={t("cms_pages:editor.overview_hint")}>
          <Field label={t("cms_pages:fields.overview_body")} htmlFor="application-overview">
            <MarkdownEditor
              id="application-overview"
              value={form.overviewBody}
              onChange={(value) => set("overviewBody", value)}
              placeholder={t("cms_pages:editor.overview_placeholder")}
              maxLength={BODY_MAX}
              rows={24}
              disabled={save.pending}
            />
          </Field>
        </Panel>

        {/* Shown whether or not the Contact tab is on: writing the text is what usually comes
            before turning the tab on, and hiding the field would make that order impossible. */}
        <Panel title={t("cms_pages:editor.contact")} description={t("cms_pages:editor.contact_hint")}>
          <Field label={t("cms_pages:fields.contact_body")} htmlFor="application-contact">
            <MarkdownEditor
              id="application-contact"
              value={form.contactBody}
              onChange={(value) => set("contactBody", value)}
              placeholder={t("cms_pages:editor.contact_placeholder")}
              maxLength={BODY_MAX}
              rows={14}
              disabled={save.pending}
            />
          </Field>
        </Panel>

        <TranslationsPanel
          fields={TRANSLATABLE}
          source={{
            name: form.name,
            tagline: form.tagline,
            summary: form.summary,
            overview_body: form.overviewBody,
            contact_body: form.contactBody,
          }}
          value={form.translations}
          onChange={(value) => setForm((current) => ({...current, translations: value}))}
          limits={{
            name: NAME_MAX,
            tagline: TAGLINE_MAX,
            summary: SUMMARY_MAX,
            overview_body: BODY_MAX,
            contact_body: BODY_MAX,
          }}
          disabled={save.pending}
        />

        {loaded?.updated_at && (
          <p className="text-[13px] text-neutral-600">
            {t("cms_pages:editor.updated_at", {date: formatDateTime(loaded.updated_at, i18n.language)})}
          </p>
        )}
      </form>

      <ConfirmDialog
        open={askPublish}
        title={t("cms_pages:editor.publish_title")}
        body={t("cms_pages:editor.publish_body", {name: form.name.trim(), slug: form.slug.trim()})}
        confirmLabel={save.pending ? t("admin:common.saving") : t("cms_pages:editor.publish_confirm")}
        onConfirm={() => void persist()}
        onClose={() => setAskPublish(false)}
        pending={save.pending}
        error={save.error}
      />

      <ConfirmDialog
        open={askDelete}
        title={t("cms_pages:editor.delete_title")}
        body={t("cms_pages:editor.delete_body", {name: form.name.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_pages:editor.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
