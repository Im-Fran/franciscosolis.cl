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
import {pagesApi} from "@/lib/pages/client.ts";
import {pagesRoute} from "@/lib/pages/config.ts";
import {CONTENT_STATUSES} from "@/lib/pages/types.ts";
import type {
  ApplicationLink,
  ApplicationUpdate,
  ContentStatus,
  Translations,
  UpdatePayload,
} from "@/lib/pages/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {LinksField} from "@/pages/cms/pages/components/links-field.tsx";
import {ReleaseFilesPanel} from "@/pages/cms/pages/components/release-files-panel.tsx";
import {TranslatableField} from "@/components/prose/translatable-field.tsx";
import {TranslationsProvider} from "@/pages/cms/pages/components/translations-provider.tsx";

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
  links: ApplicationLink[];
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
 * Tabs rather than a stack of panels, for the same reason the application's are: attaching a build
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
    label: "cms_pages:updates.sections.release",
    icon: Tag,
    fields: ["version", "title", "releasedAt", "status"],
  },
  {value: "notes", label: "cms_pages:updates.sections.notes", icon: Article, fields: ["body"]},
  {value: "links", label: "cms_pages:updates.sections.links", icon: LinkSimple, fields: ["links"]},
  {value: "builds", label: "cms_pages:updates.sections.builds", icon: CloudArrowDown, fields: []},
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

const toForm = (source: ApplicationUpdate): Form => ({
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
export const UpdateEditor = () => {
  const {t} = useTranslation(["cms_pages", "cms"]);
  const {id = "", updateId} = useParams<{id: string; updateId?: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();

  const [form, setForm] = useState<Form>(EMPTY);
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [section, setSection] = useState<SectionValue>("release");
  const [askDelete, setAskDelete] = useState(false);

  /* No builds tab until there is a release to hang one off — the panel behind it has no id to use. */
  const sections = useMemo(
    () => SECTIONS.filter((entry) => entry.value !== "builds" || Boolean(updateId)),
    [updateId],
  );

  /* Marked on the tab itself: the field saying why is inside a section that may not be open. */
  const invalidSections = useMemo(
    () => new Set(SECTIONS.filter((entry) => entry.fields.some((field) => errors[field])).map((entry) => entry.value)),
    [errors],
  );

  const record = useResource(
    useCallback(
      (signal: AbortSignal) => (updateId ? pagesApi.updates.get(id, updateId, signal) : Promise.resolve(null)),
      [id, updateId],
    ),
  );

  const save = useMutation(
    useCallback(
      (payload: UpdatePayload) =>
        updateId
          ? pagesApi.updates.update(id, updateId, payload)
          : pagesApi.updates.create(id, {
              ...payload,
              version: payload.version ?? "",
              title: payload.title ?? "",
            }),
      [id, updateId],
    ),
  );

  const remove = useMutation(useCallback(() => pagesApi.updates.remove(id, updateId ?? ""), [id, updateId]));

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
    else if (!VERSION_PATTERN.test(version)) found.version = t("cms_pages:updates.version_invalid");

    if (!title) found.title = t("cms:validation.required");
    else if (title.length > TITLE_MAX) found.title = t("cms:validation.too_long", {max: TITLE_MAX});

    if (form.body.length > BODY_MAX) found.body = t("cms:validation.too_long", {max: BODY_MAX});
    if (form.links.some((link) => !link.url.trim())) found.links = t("cms_pages:editor.link_url_required");

    return found;
  };

  const linksPayload = (): ApplicationLink[] =>
    form.links
      .filter((link) => link.url.trim())
      .map((link) => ({kind: link.kind, url: link.url.trim(), label: orNull(link.label ?? "")}));

  const payloadOf = (): UpdatePayload => {
    const full: UpdatePayload = {
      version: form.version.trim(),
      title: form.title.trim(),
      body: orNull(form.body),
      status: form.status,
      released_at: fromDateTimeLocal(form.releasedAt),
      links: linksPayload(),
      translations: form.translations,
    };

    if (!updateId) return full;

    const changed: UpdatePayload = {};
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

    if (!updateId) {
      notify(t("admin:common.created"));
      setBaseline(form);
      navigate(pagesRoute.updateItem(id, outcome.data.id), {replace: true});
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
    navigate(pagesRoute.updates(id), {replace: true});
  };

  const heading = updateId
    ? loaded?.version
      ? t("cms_pages:updates.title_edit", {version: loaded.version})
      : t("cms_pages:updates.title_edit_generic")
    : t("cms_pages:updates.title_new");
  const formId = "update-editor-form";

  const header = (
    <PageHeader
      title={heading}
      description={t("cms_pages:updates.editor_description")}
      back={{to: pagesRoute.updates(id), label: t("cms_pages:updates.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {updateId && (
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
              ? updateId
                ? t("admin:common.saving")
                : t("admin:common.creating")
              : updateId
                ? t("admin:common.save")
                : t("admin:common.create")}
          </Button>
        </>
      }
    />
  );

  if (updateId && (record.loading || record.error)) {
    return (
      <>
        {header}
        <Panel title={t("cms_pages:updates.release")}>
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
          <TabsList aria-label={t("cms_pages:updates.sections.label")}>
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
            <Panel title={t("cms_pages:updates.release")} description={t("cms_pages:updates.release_hint")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={t("cms_pages:fields.version")}
                  htmlFor="update-version"
                  error={errors.version}
                  hint={t("cms_pages:hints.version")}
                >
                  <Input
                    id="update-version"
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
                  label={t("cms_pages:fields.released_at")}
                  htmlFor="update-released-at"
                  hint={t("cms_pages:hints.released_at")}
                >
                  <Input
                    id="update-released-at"
                    type="datetime-local"
                    value={form.releasedAt}
                    onChange={(event) => set("releasedAt", event.target.value)}
                  />
                </Field>

                <TranslatableField
                  label={t("cms_pages:fields.title")}
                  htmlFor="update-title"
                  error={errors.title}
                  hint={t("cms_pages:hints.update_title")}
                  className="sm:col-span-2"
                  field="title"
                  source={form.title}
                  value={form.translations}
                  onChange={(value) => setForm((current) => ({...current, translations: value}))}
                  limit={TITLE_MAX}
                  disabled={save.pending}
                >
                  <Input
                    id="update-title"
                    value={form.title}
                    onChange={(event) => set("title", event.target.value)}
                    maxLength={TITLE_MAX}
                    aria-invalid={Boolean(errors.title)}
                    autoComplete="off"
                    required
                  />
                </TranslatableField>

                <Field
                  label={t("cms_pages:fields.status")}
                  htmlFor="update-status"
                  hint={t(`cms_pages:updates.status_hint.${form.status}`)}
                >
                  <Select
                    id="update-status"
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
            <Panel title={t("cms_pages:updates.notes")} description={t("cms_pages:updates.notes_hint")}>
              <TranslatableField
                label={t("cms_pages:fields.body")}
                htmlFor="update-body"
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
                    id="update-body"
                    value={form.body}
                    onChange={(value) => set("body", value)}
                    placeholder={t("cms_pages:updates.body_placeholder")}
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
            <Panel title={t("cms_pages:updates.links")} description={t("cms_pages:updates.links_hint")}>
              {errors.links && <p className="mb-3 text-xs text-red-400">{errors.links}</p>}
              <LinksField
                idPrefix="update-link"
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
            {updateId && <ReleaseFilesPanel applicationId={id} updateId={updateId}/>}
          </TabsContent>
        </Tabs>
      </form>

      <ConfirmDialog
        open={askDelete}
        title={t("cms_pages:updates.delete_title")}
        body={t("cms_pages:updates.delete_body", {version: form.version.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_pages:updates.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
    </TranslationsProvider>
  );
};
