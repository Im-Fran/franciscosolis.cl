import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent, MouseEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowCounterClockwise, FloppyDisk, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {SLUG_PATTERN, fromDateTimeLocal, orNull, slugify, toDateTimeLocal} from "@/lib/admin/format.ts";
import {parseJsonObject, stringifyJson} from "@/lib/cms/json.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {CONTENT_STATUSES} from "@/lib/cms/types.ts";
import type {ContentItem, ContentPayload, ContentStatus, NewContent, Translations} from "@/lib/cms/types.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {JsonEditor} from "@/components/admin/json-editor.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TagInput} from "@/components/admin/tag-input.tsx";
import {TranslationsPanel} from "@/pages/cms/components/translations-panel.tsx";
import {useCollectionMeta} from "@/pages/cms/content/use-collection.ts";

/** Every limit here is the API's own, from `openapi.json`; the form refuses what it would reject. */
const LIMITS = {
  title: 200,
  subtitle: 200,
  summary: 600,
  body: 100000,
  url: 2048,
  position: 9999,
  tag: 60,
} as const;

/** The prose the API lets a translation override, in the order the panel shows it. */
const TRANSLATABLE = ["title", "subtitle", "summary", "body"] as const;

type FormState = {
  title: string;
  slug: string;
  subtitle: string;
  summary: string;
  body: string;
  status: ContentStatus;
  featured: boolean;
  position: string;
  startedAt: string;
  endedAt: string;
  url: string;
  imageUrl: string;
  tags: string[];
  data: string;
  translations: Translations;
};

type FormErrors = Partial<Record<keyof FormState, string>>;

const EMPTY: FormState = {
  title: "",
  slug: "",
  subtitle: "",
  summary: "",
  body: "",
  status: "draft",
  featured: false,
  position: "",
  startedAt: "",
  endedAt: "",
  url: "",
  imageUrl: "",
  tags: [],
  data: "",
  translations: {},
};

const fromItem = (item: ContentItem): FormState => ({
  title: item.title,
  slug: item.slug,
  subtitle: item.subtitle ?? "",
  summary: item.summary ?? "",
  body: item.body ?? "",
  status: (CONTENT_STATUSES as string[]).includes(item.status) ? (item.status as ContentStatus) : "draft",
  featured: item.featured ?? false,
  position: item.position === undefined ? "" : String(item.position),
  startedAt: toDateTimeLocal(item.started_at),
  endedAt: toDateTimeLocal(item.ended_at),
  url: item.url ?? "",
  imageUrl: item.image_url ?? "",
  tags: item.tags ?? [],
  data: stringifyJson(item.data),
  translations: item.translations ?? {},
});

/** The id of every control, so a validation message can send the focus to the field it belongs to. */
const FIELD_ID: Record<keyof FormState, string> = {
  title: "content-title",
  slug: "content-slug",
  subtitle: "content-subtitle",
  summary: "content-summary",
  body: "content-body",
  status: "content-status",
  featured: "content-featured",
  position: "content-position",
  startedAt: "content-started-at",
  endedAt: "content-ended-at",
  url: "content-url",
  imageUrl: "content-image-url",
  tags: "content-tags",
  data: "content-data",
  translations: "content-translations",
};

/** Absolute http(s) only: the API takes a `uri`, and a relative path is never what was meant here. */
const isHttpUrl = (value: string) => {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
};

/**
 * Creating and editing one entry of a collection — the same screen for both, since the only real
 * difference is whether there is a record to load first.
 *
 * The collection comes from the route, never from a hard-coded list, and its `data` payload is
 * edited as raw JSON: the service validates it against a per-collection schema this interface is
 * not told about, so guessing a form for it would be guessing wrong the day a collection changes.
 */
export const ContentEditor = () => {
  const {t} = useTranslation(["cms_content", "cms"]);
  const {collection = "", id} = useParams();
  const navigate = useNavigate();
  const {notify} = useToast();
  const meta = useCollectionMeta(collection);
  const creating = id === undefined;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [errors, setErrors] = useState<FormErrors>({});
  const [dirty, setDirty] = useState(false);
  /* A saved entry keeps the slug it was published under: only a brand new one still tracks the title. */
  const [slugTouched, setSlugTouched] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const item = useResource(
    useCallback(
      (signal: AbortSignal) => (id ? cmsApi.content.get(collection, id, signal) : Promise.resolve(null)),
      [collection, id],
    ),
  );

  const loaded = item.data;

  useEffect(() => {
    if (!loaded) return;
    setForm(fromItem(loaded));
    setErrors({});
    setSlugTouched(true);
    setDirty(false);
  }, [loaded]);

  const json = useMemo(() => parseJsonObject(form.data), [form.data]);

  const save = useMutation(
    useCallback(
      (payload: ContentPayload) =>
        id ?
          cmsApi.content.update(collection, id, payload)
        : cmsApi.content.create(collection, payload as NewContent),
      [collection, id],
    ),
  );

  const remove = useMutation(
    useCallback(() => cmsApi.content.remove(collection, id ?? ""), [collection, id]),
  );

  /* The browser's own prompt is the only warning that survives a tab close or a reload. */
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({...current, [key]: value}));
    setErrors((current) => (current[key] ? {...current, [key]: undefined} : current));
    setDirty(true);
  };

  const onTitleChange = (value: string) => {
    setForm((current) => ({...current, title: value, slug: slugTouched ? current.slug : slugify(value)}));
    setErrors((current) => (current.title || current.slug ? {...current, title: undefined, slug: undefined} : current));
    setDirty(true);
  };

  /**
   * Caught in the capture phase, before react-router's own click handler runs: a `preventDefault()`
   * here stops both the navigation and the anchor's default. React-router 7 does ship a blocker
   * API, but this needs nothing from the router and cannot drift with it.
   */
  const guardLeaving = (event: MouseEvent<HTMLDivElement>) => {
    if (!dirty) return;
    if (!(event.target as HTMLElement | null)?.closest("a")) return;
    if (!window.confirm(t("cms_content:editor.leave_confirm"))) event.preventDefault();
  };

  const discard = () => {
    setForm(loaded ? fromItem(loaded) : EMPTY);
    setErrors({});
    setSlugTouched(Boolean(loaded));
    setDirty(false);
    save.reset();
  };

  const validate = (): FormErrors => {
    const next: FormErrors = {};
    const title = form.title.trim();
    const slug = form.slug.trim();
    const position = form.position.trim();

    if (!title) next.title = t("cms:validation.required");
    else if (title.length > LIMITS.title) next.title = t("cms:validation.too_long", {max: LIMITS.title});

    if (slug && !SLUG_PATTERN.test(slug)) next.slug = t("cms:validation.slug_invalid");
    if (form.subtitle.trim().length > LIMITS.subtitle)
      next.subtitle = t("cms:validation.too_long", {max: LIMITS.subtitle});
    if (form.summary.trim().length > LIMITS.summary)
      next.summary = t("cms:validation.too_long", {max: LIMITS.summary});
    if (form.body.length > LIMITS.body) next.body = t("cms:validation.too_long", {max: LIMITS.body});

    if (position) {
      const value = Number(position);
      if (!Number.isInteger(value) || value < 0 || value > LIMITS.position)
        next.position = t("cms_content:editor.position_invalid", {max: LIMITS.position});
    }

    for (const key of ["url", "imageUrl"] as const) {
      const value = form[key].trim();
      if (!value) continue;
      if (value.length > LIMITS.url) next[key] = t("cms:validation.too_long", {max: LIMITS.url});
      else if (!isHttpUrl(value)) next[key] = t("cms:validation.invalid_url");
    }

    if (form.startedAt && form.endedAt && form.endedAt < form.startedAt)
      next.endedAt = t("cms_content:editor.ended_before_started");

    if (!json.ok) next.data = t("cms:validation.invalid_json");

    return next;
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const found = validate();
    setErrors(found);

    /* Fields are rendered by three different components that all take an id and none a ref, so the
       first offender is reached through the DOM rather than through a map of refs. */
    const first = (Object.keys(FIELD_ID) as (keyof FormState)[]).find((key) => found[key]);
    if (first) {
      const element = document.getElementById(FIELD_ID[first]);
      element?.scrollIntoView({block: "center", behavior: "smooth"});
      element?.focus({preventScroll: true});
      return;
    }

    const payload: ContentPayload = {
      title: form.title.trim(),
      subtitle: orNull(form.subtitle),
      summary: orNull(form.summary),
      body: orNull(form.body),
      status: form.status,
      featured: form.featured,
      started_at: fromDateTimeLocal(form.startedAt),
      ended_at: fromDateTimeLocal(form.endedAt),
      url: orNull(form.url),
      image_url: orNull(form.imageUrl),
      tags: form.tags,
      /* Replaced wholesale by the API, like `data`, so the panel's whole map goes every time. */
      translations: form.translations,
    };

    const slug = form.slug.trim();
    if (slug) payload.slug = slug;

    const position = form.position.trim();
    if (position) payload.position = Number(position);

    /* An emptied box means "drop what was stored"; leaving the key out would keep the old payload. */
    if (json.ok && json.value) payload.data = json.value;
    else if (loaded?.data && Object.keys(loaded.data).length > 0) payload.data = {};

    const outcome = await save.run(payload);
    if (!outcome.ok) return;

    setDirty(false);
    if (creating) {
      notify(t("admin:common.created"));
      /* Replaced, so "back" from the saved record lands on the list and not on an empty form. */
      navigate(cmsRoute.contentItem(collection, outcome.data.id), {replace: true});
      return;
    }
    notify(t("admin:common.saved"));
    item.reload();
  };

  const confirmDelete = async () => {
    const outcome = await remove.run();
    if (!outcome.ok) return;
    notify(t("admin:common.deleted"));
    setDirty(false);
    setConfirmingDelete(false);
    navigate(cmsRoute.content(collection), {replace: true});
  };

  const back = {to: cmsRoute.content(collection), label: t("cms_content:editor.back", {name: meta.name})};
  const heading = creating ? t("cms_content:editor.new_title", {name: meta.singular}) : (loaded?.title ?? form.title);

  /* Loading and a failed load both stand in for the whole form: there is nothing to edit yet. */
  if (!creating && (item.loading || item.error)) {
    return (
      <>
        <PageHeader title={t("cms_content:editor.loading_title")} back={back}/>
        <Panel title={meta.name} description={t("cms_content:editor.loading_description")}>
          <PanelState
            loading={item.loading}
            error={item.error}
            forbidden={item.status === 403}
            onRetry={item.reload}
            ns="cms"
          >
            {null}
          </PanelState>
        </Panel>
      </>
    );
  }

  const submitting = save.pending;
  const derived = slugify(form.title);

  return (
    <div onClickCapture={guardLeaving}>
      <PageHeader
        title={heading || t("cms_content:editor.new_title", {name: meta.singular})}
        description={
          creating ?
            t("cms_content:editor.new_description", {name: meta.name})
          : t("cms_content:editor.edit_description", {name: meta.name})
        }
        back={back}
        actions={
          <>
            {!creating && (
              <Button
                variant="secondary"
                size="sm"
                className="border-red-500/40 text-red-300 fs-ripple-danger"
                onClick={() => {
                  remove.reset();
                  setConfirmingDelete(true);
                }}
                data-fs-hover
              >
                <Trash size={15}/> {t("admin:common.delete")}
              </Button>
            )}
            <Button
              type="submit"
              form="content-form"
              variant="primary"
              size="sm"
              disabled={submitting || !json.ok || (!creating && !dirty)}
              data-fs-hover
            >
              {submitting ? <Spinner size={14}/> : <FloppyDisk size={15}/>}
              {creating ?
                submitting ? t("admin:common.creating")
                : t("admin:common.create")
              : submitting ? t("admin:common.saving")
              : t("admin:common.save")}
            </Button>
          </>
        }
      />

      <form id="content-form" onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
        {save.error && (
          <Alert tone="error" title={t("cms_content:editor.save_failed")}>
            {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
          </Alert>
        )}

        {dirty && (
          <Alert tone="info" title={t("admin:common.unsaved")}>
            <div className="flex flex-wrap items-center gap-3">
              <span>{t("cms_content:editor.unsaved_body")}</span>
              <Button variant="ghost" size="sm" type="button" onClick={discard} data-fs-hover>
                <ArrowCounterClockwise size={14}/> {t("admin:common.discard")}
              </Button>
            </div>
          </Alert>
        )}

        <Panel title={t("cms_content:editor.basics_title")} description={t("cms_content:editor.basics_description")}>
          <div className="flex flex-col gap-4">
            <Field label={t("cms_content:editor.title")} htmlFor={FIELD_ID.title} error={errors.title}>
              <Input
                id={FIELD_ID.title}
                value={form.title}
                maxLength={LIMITS.title}
                required
                onChange={(event) => onTitleChange(event.target.value)}
                placeholder={t("cms_content:editor.title_placeholder")}
              />
            </Field>

            <Field
              label={t("cms_content:editor.slug")}
              htmlFor={FIELD_ID.slug}
              error={errors.slug}
              hint={
                slugTouched ? t("cms_content:editor.slug_hint")
                : derived ? t("cms_content:editor.slug_derived", {slug: derived})
                : t("cms_content:editor.slug_empty")
              }
            >
              <Input
                id={FIELD_ID.slug}
                value={form.slug}
                maxLength={80}
                className="font-mono text-[13px]"
                onChange={(event) => {
                  setSlugTouched(true);
                  update("slug", event.target.value);
                }}
                placeholder={derived || t("cms_content:editor.slug_placeholder")}
              />
            </Field>

            <Field
              label={t("cms_content:editor.subtitle")}
              htmlFor={FIELD_ID.subtitle}
              error={errors.subtitle}
              hint={t("cms_content:editor.subtitle_hint")}
            >
              <Input
                id={FIELD_ID.subtitle}
                value={form.subtitle}
                maxLength={LIMITS.subtitle}
                onChange={(event) => update("subtitle", event.target.value)}
              />
            </Field>

            <Field
              label={t("cms_content:editor.summary")}
              htmlFor={FIELD_ID.summary}
              error={errors.summary}
              hint={t("cms_content:editor.summary_hint", {used: form.summary.length, max: LIMITS.summary})}
            >
              <Textarea
                id={FIELD_ID.summary}
                value={form.summary}
                maxLength={LIMITS.summary}
                rows={3}
                onChange={(event) => update("summary", event.target.value)}
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("cms_content:editor.status")} htmlFor={FIELD_ID.status}>
                <Select
                  id={FIELD_ID.status}
                  value={form.status}
                  onChange={(event) => update("status", event.target.value as ContentStatus)}
                >
                  {CONTENT_STATUSES.map((entry) => (
                    <option key={entry} value={entry}>{t(`admin:status.${entry}`)}</option>
                  ))}
                </Select>
              </Field>

              <Field
                label={t("cms_content:editor.position")}
                htmlFor={FIELD_ID.position}
                error={errors.position}
                hint={t("cms_content:editor.position_hint")}
              >
                <Input
                  id={FIELD_ID.position}
                  type="number"
                  inputMode="numeric"
                  min={0}
                  max={LIMITS.position}
                  step={1}
                  value={form.position}
                  onChange={(event) => update("position", event.target.value)}
                  placeholder="0"
                />
              </Field>
            </div>

            <label
              className="flex cursor-pointer items-start gap-2 text-sm text-neutral-300"
              htmlFor={FIELD_ID.featured}
              data-fs-hover
            >
              <input
                id={FIELD_ID.featured}
                type="checkbox"
                checked={form.featured}
                onChange={(event) => update("featured", event.target.checked)}
                className="mt-0.5 size-4 cursor-pointer accent-[var(--color-accent)]"
              />
              <span>
                {t("cms_content:editor.featured")}
                <span className="block text-xs text-neutral-500">{t("cms_content:editor.featured_hint")}</span>
              </span>
            </label>
          </div>
        </Panel>

        <Panel title={t("cms_content:editor.body_title")} description={t("cms_content:editor.body_description")}>
          <Field label={t("cms_content:editor.body")} htmlFor={FIELD_ID.body} error={errors.body}>
            <MarkdownEditor
              id={FIELD_ID.body}
              value={form.body}
              onChange={(value) => update("body", value)}
              maxLength={LIMITS.body}
              placeholder={t("cms_content:editor.body_placeholder")}
              disabled={submitting}
            />
          </Field>
        </Panel>

        <TranslationsPanel
          ns="cms_content"
          fields={TRANSLATABLE}
          source={{title: form.title, subtitle: form.subtitle, summary: form.summary, body: form.body}}
          value={form.translations}
          onChange={(value) => update("translations", value)}
          limits={{title: LIMITS.title, subtitle: LIMITS.subtitle, summary: LIMITS.summary, body: LIMITS.body}}
          disabled={submitting}
        />

        <Panel title={t("cms_content:editor.links_title")} description={t("cms_content:editor.links_description")}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label={t("cms_content:editor.url")}
              htmlFor={FIELD_ID.url}
              error={errors.url}
              hint={t("cms_content:editor.url_hint")}
            >
              <Input
                id={FIELD_ID.url}
                type="url"
                inputMode="url"
                value={form.url}
                maxLength={LIMITS.url}
                onChange={(event) => update("url", event.target.value)}
                placeholder="https://"
                className="font-mono text-[13px]"
              />
            </Field>

            <Field
              label={t("cms_content:editor.image_url")}
              htmlFor={FIELD_ID.imageUrl}
              error={errors.imageUrl}
              hint={t("cms_content:editor.image_url_hint")}
            >
              <Input
                id={FIELD_ID.imageUrl}
                type="url"
                inputMode="url"
                value={form.imageUrl}
                maxLength={LIMITS.url}
                onChange={(event) => update("imageUrl", event.target.value)}
                placeholder="https://"
                className="font-mono text-[13px]"
              />
            </Field>

            <Field
              label={t("cms_content:editor.started_at")}
              htmlFor={FIELD_ID.startedAt}
              hint={t("cms_content:editor.started_at_hint")}
            >
              <Input
                id={FIELD_ID.startedAt}
                type="datetime-local"
                value={form.startedAt}
                onChange={(event) => update("startedAt", event.target.value)}
              />
            </Field>

            <Field
              label={t("cms_content:editor.ended_at")}
              htmlFor={FIELD_ID.endedAt}
              error={errors.endedAt}
              hint={t("cms_content:editor.ended_at_hint")}
            >
              <Input
                id={FIELD_ID.endedAt}
                type="datetime-local"
                value={form.endedAt}
                onChange={(event) => update("endedAt", event.target.value)}
              />
            </Field>
          </div>
        </Panel>

        <Panel title={t("cms_content:editor.tags_title")} description={t("cms_content:editor.tags_description")}>
          <Field label={t("cms_content:editor.tags")} htmlFor={FIELD_ID.tags} hint={t("cms_content:editor.tags_hint")}>
            <TagInput
              id={FIELD_ID.tags}
              value={form.tags}
              onChange={(value) => update("tags", value)}
              maxTagLength={LIMITS.tag}
              disabled={submitting}
            />
          </Field>
        </Panel>

        <Panel
          title={t("cms_content:editor.data_title")}
          description={t("cms_content:editor.data_description", {name: meta.name})}
        >
          <Field label={t("cms_content:editor.data")} htmlFor={FIELD_ID.data} error={errors.data}>
            <JsonEditor
              id={FIELD_ID.data}
              value={form.data}
              onChange={(value) => update("data", value)}
              disabled={submitting}
              rows={10}
            />
          </Field>
        </Panel>
      </form>

      <ConfirmDialog
        open={confirmingDelete}
        title={t("cms_content:editor.delete_title", {name: meta.singular})}
        body={t("cms_content:editor.delete_body", {title: loaded?.title ?? form.title})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        pending={remove.pending}
        error={remove.error}
        onConfirm={() => void confirmDelete()}
        onClose={() => {
          setConfirmingDelete(false);
          remove.reset();
        }}
      />
    </div>
  );
};
