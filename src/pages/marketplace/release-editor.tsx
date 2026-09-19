import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {Article, CloudArrowDown, FloppyDisk, LinkSimple, Tag, Trash} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {fromDateTimeLocal, orNull, toDateTimeLocal} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {marketplaceRoute} from "@/lib/marketplace/config.ts";
import {CONTENT_STATUSES} from "@/lib/marketplace/types.ts";
import type {
  ProductLink,
  ProductRelease,
  ContentStatus,
  Translations,
  ReleasePayload,
} from "@/lib/marketplace/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {LinksField} from "@/pages/marketplace/components/links-field.tsx";
import {ReleaseFilesPanel} from "@/pages/marketplace/components/release-files-panel.tsx";
import {TranslatableField} from "@/components/prose/translatable-field.tsx";
import {TranslationsProvider} from "@/pages/marketplace/components/translations-provider.tsx";

const VERSION_MAX = 40;
const TITLE_MAX = 200;
/** Deliberately smaller than a page's: a changelog entry that long is a wiki page. */
const BODY_MAX = 50000;

/**
 * What the service accepts as a version. Free text rather than semver — this fronts a Minecraft
 * plugin and a mobile app equally well — but not whitespace or a slash, because it is a path
 * segment on the public route.
 */
const VERSION_PATTERN = /^[^\s/]+$/;

type Form = {
  version: string;
  title: string;
  body: string;
  status: ContentStatus;
  releasedAt: string;
  links: ProductLink[];
  translations: Translations;
};

type FieldName = keyof Form;

type SectionValue = "release" | "notes" | "links" | "builds";

type Section = {
  value: SectionValue;
  label: string;
  icon: Icon;
  /** The form fields this section holds; empty for a section that writes straight to the service. */
  fields: readonly FieldName[];
};

/**
 * The release editor's sections, in the order an entry is written.
 *
 * Tabs rather than a stack of panels, for the same reason the product's are: attaching a build
 * to a release that shipped months ago should not mean scrolling past its notes to get there. They
 * are tabs of this screen rather than routes, so moving between them keeps what has been typed.
 *
 * `builds` holds no form field at all — the panel behind it registers and uploads on its own, which
 * is why it is the one section that is not offered while the release is still being created.
 *
 * There is deliberately no translations section: the translation of a field lives on that field, in
 * a dialog opened from an icon inside its control (`TranslatableField`). A tab of its own was a
 * second copy of this form, in another language, one tab away from the text it translates.
 */
const SECTIONS: readonly Section[] = [
  {
    value: "release",
    label: "marketplace_admin:releases.sections.release",
    icon: Tag,
    fields: ["version", "title", "releasedAt", "status"],
  },
  {value: "notes", label: "marketplace_admin:releases.sections.notes", icon: Article, fields: ["body"]},
  {value: "links", label: "marketplace_admin:releases.sections.links", icon: LinkSimple, fields: ["links"]},
  {value: "builds", label: "marketplace_admin:releases.sections.builds", icon: CloudArrowDown, fields: []},
];

/** The first section holding something the form refused, so a failed save can open itself. */
const firstInvalidSection = (found: Partial<Record<FieldName, string>>) =>
  SECTIONS.find((section) => section.fields.some((field) => found[field]))?.value;

const EMPTY: Form = {
  version: "",
  title: "",
  body: "",
  status: "draft",
  releasedAt: "",
  links: [],
  translations: {},
};

const asStatus = (value: string): ContentStatus =>
  (CONTENT_STATUSES as string[]).includes(value) ? (value as ContentStatus) : "draft";

const toForm = (source: ProductRelease): Form => ({
  version: source.version,
  title: source.title,
  body: source.body ?? "",
  status: asStatus(source.status),
  releasedAt: toDateTimeLocal(source.released_at),
  links: source.links ?? [],
  translations: source.translations ?? {},
});

/**
 * Writing one release note.
 *
 * The date is the one field worth understanding: it is the day the version *shipped*, not the day
 * the entry was written, and it is what the public tab orders by. Leaving it blank on something
 * published is not an error — the service dates it now — but back-dating a release somebody forgot
 * is exactly what it exists for.
 */
export const ReleaseEditor = () => {
  const {t} = useTranslation(["marketplace_admin", "cms"]);
  const {id = "", releaseId} = useParams<{id: string; releaseId?: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [section, setSection] = useState<SectionValue>("release");
  const [askDelete, setAskDelete] = useState(false);

  /* No builds tab until there is a release to hang one off — the panel behind it has no id to use. */
  const sections = useMemo(
    () => SECTIONS.filter((entry) => entry.value !== "builds" || Boolean(releaseId)),
    [releaseId],
  );

  /* Marked on the tab itself: the field saying why is inside a section that may not be open. */
  const invalidSections = useMemo(
    () => new Set(SECTIONS.filter((entry) => entry.fields.some((field) => errors[field])).map((entry) => entry.value)),
    [errors],
  );

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (releaseId ? marketplaceApi.releases.get(id, releaseId, signal) : Promise.resolve(null)),
      [id, releaseId],
    ),
  );

  const save = useMutation(
    useCallback(
      (payload: ReleasePayload) =>
        releaseId
          ? marketplaceApi.releases.update(id, releaseId, payload)
          : marketplaceApi.releases.create(id, {
              ...payload,
              version: payload.version ?? "",
              title: payload.title ?? "",
            }),
      [id, releaseId],
    ),
  );

  const remove = useMutation(useCallback(() => marketplaceApi.releases.remove(id, releaseId ?? ""), [id, releaseId]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
  }, [loaded]);

  const sameValue = (key: FieldName) =>
    key === "translations" || key === "links"
      ? JSON.stringify(form[key]) === JSON.stringify(baseline[key])
      : form[key] === baseline[key];

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

  const validate = () => {
    const found: Partial<Record<FieldName, string>> = {};
    const version = form.version.trim();
    const title = form.title.trim();

    if (!version) found.version = t("cms:validation.required");
    else if (version.length > VERSION_MAX) found.version = t("cms:validation.too_long", {max: VERSION_MAX});
    else if (!VERSION_PATTERN.test(version)) found.version = t("marketplace_admin:releases.version_invalid");

    if (!title) found.title = t("cms:validation.required");
    else if (title.length > TITLE_MAX) found.title = t("cms:validation.too_long", {max: TITLE_MAX});

    if (form.body.length > BODY_MAX) found.body = t("cms:validation.too_long", {max: BODY_MAX});
    if (form.links.some((link) => !link.url.trim())) found.links = t("marketplace_admin:editor.link_url_required");

    return found;
  };

  const linksPayload = (): ProductLink[] =>
    form.links
      .filter((link) => link.url.trim())
      .map((link) => ({kind: link.kind, url: link.url.trim(), label: orNull(link.label ?? "")}));

  const payloadOf = (): ReleasePayload => {
    const full: ReleasePayload = {
      version: form.version.trim(),
      title: form.title.trim(),
      body: orNull(form.body),
      status: form.status,
      released_at: fromDateTimeLocal(form.releasedAt),
      links: linksPayload(),
      translations: form.translations,
    };

    if (!releaseId) return full;

    const changed: ReleasePayload = {};
    if (form.version !== baseline.version) changed.version = full.version;
    if (form.title !== baseline.title) changed.title = full.title;
    if (form.body !== baseline.body) changed.body = full.body;
    if (form.status !== baseline.status) changed.status = full.status;
    if (form.releasedAt !== baseline.releasedAt) changed.released_at = full.released_at;
    if (!sameValue("links")) changed.links = full.links;
    if (!sameValue("translations")) changed.translations = full.translations;
    return changed;
  };

  const persist = async () => {
    const outcome = await save.run(payloadOf());
    if (!outcome.ok) return;

    if (!releaseId) {
      notify(t("admin:common.created"));
      setBaseline(form);
      navigate(marketplaceRoute.releaseItem(id, outcome.data.id), {replace: true});
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
    if (Object.keys(found).length > 0) {
      /* Opened rather than only marked: the message is under the field, and the field is in here. */
      const target = firstInvalidSection(found);
      if (target) setSection(target);
      return;
    }
    void persist();
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    navigate(marketplaceRoute.releases(id), {replace: true});
  };

  const heading = releaseId
    ? loaded?.version
      ? t("marketplace_admin:releases.title_edit", {version: loaded.version})
      : t("marketplace_admin:releases.title_edit_generic")
    : t("marketplace_admin:releases.title_new");
  const formId = "release-editor-form";

  const header = (
    <PageHeader
      title={heading}
      description={t("marketplace_admin:releases.editor_description")}
      back={{to: marketplaceRoute.releases(id), label: t("marketplace_admin:releases.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {releaseId && (
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
              ? releaseId
                ? t("admin:common.saving")
                : t("admin:common.creating")
              : releaseId
                ? t("admin:common.save")
                : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  if (releaseId && (record.loading || record.error)) {
    return (
      <>
        {header}
        <Panel title={t("marketplace_admin:releases.release")}>
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

        <Tabs value={section} onValueChange={(value) => setSection(value as SectionValue)}>
          <TabsList aria-label={t("marketplace_admin:releases.sections.label")}>
            {sections.map(({value, label, icon: SectionIcon}) => (
              <TabsTrigger
                key={value}
                value={value}
                icon={<SectionIcon size={16}/>}
                invalid={invalidSections.has(value)}
              >
                {t(label)}
              </TabsTrigger>
            ))}
          </TabsList>

          <TabsContent value="release">
            <Panel title={t("marketplace_admin:releases.release")} description={t("marketplace_admin:releases.release_hint")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={t("marketplace_admin:fields.version")}
                  htmlFor="release-version"
                  error={errors.version}
                  hint={t("marketplace_admin:hints.version")}
                >
                  <Input
                    id="release-version"
                    value={form.version}
                    onChange={(event) => set("version", event.target.value)}
                    placeholder="2.6.4"
                    maxLength={VERSION_MAX}
                    aria-invalid={Boolean(errors.version)}
                    autoComplete="off"
                    className="font-mono"
                    required
                  />
                </Field>

                <Field
                  label={t("marketplace_admin:fields.released_at")}
                  htmlFor="release-released-at"
                  hint={t("marketplace_admin:hints.released_at")}
                >
                  <Input
                    id="release-released-at"
                    type="datetime-local"
                    value={form.releasedAt}
                    onChange={(event) => set("releasedAt", event.target.value)}
                  />
                </Field>

                <TranslatableField
                  label={t("marketplace_admin:fields.title")}
                  htmlFor="release-title"
                  error={errors.title}
                  hint={t("marketplace_admin:hints.update_title")}
                  className="sm:col-span-2"
                  field="title"
                  source={form.title}
                  value={form.translations}
                  onChange={(value) => setForm((current) => ({...current, translations: value}))}
                  limit={TITLE_MAX}
                  disabled={save.pending}
                >
                  <Input
                    id="release-title"
                    value={form.title}
                    onChange={(event) => set("title", event.target.value)}
                    maxLength={TITLE_MAX}
                    aria-invalid={Boolean(errors.title)}
                    autoComplete="off"
                    required
                  />
                </TranslatableField>

                <Field
                  label={t("marketplace_admin:fields.status")}
                  htmlFor="release-status"
                  hint={t(`marketplace_admin:releases.status_hint.${form.status}`)}
                >
                  <Select
                    id="release-status"
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
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="notes">
            <Panel title={t("marketplace_admin:releases.notes")} description={t("marketplace_admin:releases.notes_hint")}>
              <TranslatableField
                label={t("marketplace_admin:fields.body")}
                htmlFor="release-body"
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
                    id="release-body"
                    value={form.body}
                    onChange={(value) => set("body", value)}
                    placeholder={t("marketplace_admin:releases.body_placeholder")}
                    maxLength={BODY_MAX}
                    rows={16}
                    disabled={save.pending}
                    action={action}
                  />
                )}
              </TranslatableField>
            </Panel>
          </TabsContent>

          <TabsContent value="links">
            <Panel title={t("marketplace_admin:releases.links")} description={t("marketplace_admin:releases.links_hint")}>
              {errors.links && <p className="mb-3 text-xs text-red-400">{errors.links}</p>}
              <LinksField
                idPrefix="release-link"
                value={form.links}
                onChange={(links) => set("links", links)}
                disabled={save.pending}
              />
            </Panel>
          </TabsContent>

          <TabsContent value="builds">
            {/*
              * Only once the release exists. A build hangs off a release note, so there is nothing to
              * attach it to while the note is still being written — and the panel writes straight to the
              * service rather than through this form's save, because bytes are not a field.
              */}
            {releaseId && <ReleaseFilesPanel productId={id} releaseId={releaseId}/>}
          </TabsContent>
        </Tabs>
      </form>

      <ConfirmDialog
        open={askDelete}
        title={t("marketplace_admin:releases.delete_title")}
        body={t("marketplace_admin:releases.delete_body", {version: form.version.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("marketplace_admin:releases.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
    </TranslationsProvider>
  );
};
