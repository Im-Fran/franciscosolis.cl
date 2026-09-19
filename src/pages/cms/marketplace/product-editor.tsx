import {useCallback, useEffect, useMemo, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {
  Article,
  ArrowSquareOut,
  CurrencyDollar,
  FloppyDisk,
  IdentificationCard,
  Palette,
  SquaresFour,
  Trash,
} from "@phosphor-icons/react";
import type {Icon} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {Tabs, TabsContent, TabsList, TabsTrigger} from "@/components/ui/tabs.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {SLUG_PATTERN, orNull, slugify} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {productRoute, marketplaceRoute} from "@/lib/marketplace/config.ts";
import {useMarketplaceTabs} from "@/lib/marketplace/content.ts";
import {CONTENT_STATUSES, PRICING_MODES} from "@/lib/marketplace/types.ts";
import type {
  Product,
  ProductLink,
  ProductPayload,
  ContentStatus,
  PricingMode,
  Translations,
} from "@/lib/marketplace/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {MarkdownEditor} from "@/components/prose/markdown-editor.tsx";
import {ProductNav} from "@/pages/cms/marketplace/components/product-nav.tsx";
import {LinksField} from "@/pages/cms/marketplace/components/links-field.tsx";
import {TabsField} from "@/pages/cms/marketplace/components/tabs-field.tsx";
import {TranslatableField} from "@/components/prose/translatable-field.tsx";
import {TranslationsProvider} from "@/pages/cms/marketplace/components/translations-provider.tsx";

/** The API's own caps. Kept here so a field cannot accept what the service will refuse. */
const NAME_MAX = 120;
const TAGLINE_MAX = 200;
const SUMMARY_MAX = 600;
const BODY_MAX = 200000;

/** The prose a product can be translated into another language. Nothing structural is here. */
/** `#rgb` or `#rrggbb`; the service refuses any other CSS colour, and the page interpolates it. */
const HEX_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

/**
 * The service's own floor on any amount it will charge, in whole pesos.
 *
 * Mirrored here so the form can say no before the redirect does. It is not a policy this screen
 * owns — the service rejects anything under it whatever this field accepts.
 */
const AMOUNT_MIN = 500;
const AMOUNT_MAX = 5_000_000;

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
  links: ProductLink[];
  overviewBody: string;
  contactBody: string;
  pricingMode: PricingMode;
  /** Kept as text so the field can be emptied; the payload turns it into a number or a null. */
  priceAmount: string;
  suggestedAmount: string;
  translations: Translations;
};

type FieldName = keyof Form;

type SectionValue = "general" | "appearance" | "pricing" | "structure" | "content";

type Section = {
  value: SectionValue;
  label: string;
  icon: Icon;
  /** The form fields this section holds. It is what lights a tab up when one of them is refused. */
  fields: readonly FieldName[];
};

/**
 * The editor's sections, in the order a page is usually filled in.
 *
 * They used to be one column of panels, which made editing a published page a scroll past
 * everything that was already right to reach the one field that was not. They are tabs now, beside
 * the content rather than above it — and tabs of this screen rather than routes, because a section
 * per route would throw away whatever is typed on the way between two of them.
 *
 * Each one names its fields, which is what makes a split form safe to submit: a validation failure
 * behind a closed tab would otherwise be a save that refuses with no visible reason.
 *
 * There is deliberately no translations section: the translation of a field lives on that field, in
 * a dialog opened from an icon inside its control (`TranslatableField`). A tab of its own was a
 * second copy of this form, in another language, one tab away from the text it translates.
 */
const SECTIONS: readonly Section[] = [
  {
    value: "general",
    label: "cms_marketplace:editor.sections.general",
    icon: IdentificationCard,
    fields: ["name", "slug", "tagline", "summary", "status", "featured"],
  },
  {
    value: "appearance",
    label: "cms_marketplace:editor.sections.appearance",
    icon: Palette,
    fields: ["bannerImageUrl", "iconImageUrl", "accentColor"],
  },
  {
    value: "pricing",
    label: "cms_marketplace:editor.sections.pricing",
    icon: CurrencyDollar,
    fields: ["pricingMode", "priceAmount", "suggestedAmount"],
  },
  {
    value: "structure",
    label: "cms_marketplace:editor.sections.structure",
    icon: SquaresFour,
    fields: ["tabs", "links"],
  },
  {
    value: "content",
    label: "cms_marketplace:editor.sections.content",
    icon: Article,
    fields: ["overviewBody", "contactBody"],
  },
];

/** The first section holding something the form refused, so a failed save can open itself. */
const firstInvalidSection = (found: Partial<Record<FieldName, string>>) =>
  SECTIONS.find((section) => section.fields.some((field) => found[field]))?.value;

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
  pricingMode: "free",
  priceAmount: "",
  suggestedAmount: "",
  translations: {},
};

/** The API types `status` as a plain string, so an unexpected value falls back to a safe draft. */
const asStatus = (value: string): ContentStatus =>
  (CONTENT_STATUSES as string[]).includes(value) ? (value as ContentStatus) : "draft";

/** Same defensiveness for the pricing mode: an unknown one reads as the mode that charges nobody. */
const asPricingMode = (value: string | undefined): PricingMode =>
  (PRICING_MODES as readonly string[]).includes(value ?? "") ? (value as PricingMode) : "free";

const amountText = (value: number | null | undefined) =>
  typeof value === "number" && Number.isFinite(value) ? String(value) : "";

const toForm = (source: Product): Form => ({
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
  pricingMode: asPricingMode(source.pricing?.mode),
  /*
   * Read from the *derived* `pricing`, which nulls the figure belonging to another mode — so an
   * product switched to `donation` shows no price until it is switched back, exactly as the
   * public page sees it. The row keeps the old number; the service is what remembers it.
   */
  priceAmount: amountText(source.pricing?.price),
  suggestedAmount: amountText(source.pricing?.suggested_amount),
  translations: source.translations ?? {},
});

/**
 * Creating and editing one product page.
 *
 * The same screen does both: the route either carries an id or it does not, which is the only
 * difference between a POST and a PATCH here. What it cannot do is edit the release notes or the
 * wiki — those are lists with screens of their own, reachable from the navigation above, and only
 * once the product exists to hold them.
 */
export const ProductEditor = () => {
  const {t, i18n} = useTranslation(["cms_marketplace", "cms"]);
  const {id} = useParams<{id: string}>();
  const navigate = useNavigate();
  const {notify} = useToast();
  const availableTabs = useMarketplaceTabs();

  const [form, setForm] = useState<Form>(EMPTY);
  /* What the server last confirmed — the yardstick for "dirty" and for the PATCH's diff. */
  const [baseline, setBaseline] = useState<Form>(EMPTY);
  const [errors, setErrors] = useState<Partial<Record<FieldName, string>>>({});
  const [section, setSection] = useState<SectionValue>("general");
  const [slugTouched, setSlugTouched] = useState(false);
  const [askPublish, setAskPublish] = useState(false);
  const [askDelete, setAskDelete] = useState(false);

  const record = useResource(
    useCallback((signal: AbortSignal) => (id ? marketplaceApi.products.get(id, signal) : Promise.resolve(null)), [id]),
  );

  const save = useMutation(
    useCallback(
      (payload: ProductPayload) =>
        id
          ? marketplaceApi.products.update(id, payload)
          : marketplaceApi.products.create({...payload, name: payload.name ?? ""}),
      [id],
    ),
  );

  const remove = useMutation(useCallback(() => marketplaceApi.products.remove(id ?? ""), [id]));

  const loaded = record.data;
  useEffect(() => {
    if (!loaded) return;
    const next = toForm(loaded);
    setForm(next);
    setBaseline(next);
    /*
     * An existing product's slug is its public address, so renaming must not silently move it;
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

  /* Marked on the tab itself: the field saying why is inside a section that may not be open. */
  const invalidSections = useMemo(
    () =>
      new Set(
        SECTIONS.filter((entry) => entry.fields.some((field) => errors[field])).map((entry) => entry.value),
      ),
    [errors],
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
      found.accentColor = t("cms_marketplace:editor.accent_invalid");
    }

    /* A link with no destination is the one thing the API will certainly refuse, and the message it
       sends back names a field index rather than a row an editor can see. */
    if (form.links.some((link) => !link.url.trim())) found.links = t("cms_marketplace:editor.link_url_required");

    /*
     * A paid product with no price is an editor halfway through a change: the service refuses to
     * open a checkout for one, so the page would offer a purchase nobody can complete.
     */
    if (form.pricingMode === "paid") {
      const price = Number.parseInt(form.priceAmount, 10);
      if (!Number.isFinite(price)) found.priceAmount = t("cms:validation.required");
      else if (price < AMOUNT_MIN || price > AMOUNT_MAX) {
        found.priceAmount = t("cms_marketplace:editor.amount_range", {min: AMOUNT_MIN, max: AMOUNT_MAX});
      }
    }

    if (form.pricingMode === "donation" && form.suggestedAmount.trim()) {
      const suggested = Number.parseInt(form.suggestedAmount, 10);
      if (!Number.isFinite(suggested) || suggested < AMOUNT_MIN || suggested > AMOUNT_MAX) {
        found.suggestedAmount = t("cms_marketplace:editor.amount_range", {min: AMOUNT_MIN, max: AMOUNT_MAX});
      }
    }

    return found;
  };

  const linksPayload = (): ProductLink[] =>
    form.links
      .filter((link) => link.url.trim())
      .map((link) => ({kind: link.kind, url: link.url.trim(), label: orNull(link.label ?? "")}));

  /** Only what actually changed goes on the wire, so an untouched slug cannot collide on a PATCH. */
  const payloadOf = (): ProductPayload => {
    const full: ProductPayload = {
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
      pricing_mode: form.pricingMode,
      /*
       * Only the amount the current mode uses is sent. Sending the other one back would write a
       * figure the editor cannot see on this screen, which is how a stale price ends up quoted.
       */
      price_amount: form.pricingMode === "paid" ? Number.parseInt(form.priceAmount, 10) : undefined,
      suggested_amount:
        form.pricingMode === "donation" && form.suggestedAmount.trim()
          ? Number.parseInt(form.suggestedAmount, 10)
          : undefined,
      translations: form.translations,
    };
    const slug = form.slug.trim();
    if (slug) full.slug = slug;

    if (!id) return full;

    const changed: ProductPayload = {};
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
    if (form.pricingMode !== baseline.pricingMode) changed.pricing_mode = full.pricing_mode;
    if (form.priceAmount !== baseline.priceAmount) changed.price_amount = full.price_amount ?? null;
    if (form.suggestedAmount !== baseline.suggestedAmount) changed.suggested_amount = full.suggested_amount ?? null;
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
      navigate(marketplaceRoute.item(outcome.data.id), {replace: true});
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
    navigate(marketplaceRoute.list, {replace: true});
  };

  const heading = id ? loaded?.name || t("cms_marketplace:editor.title_edit") : t("cms_marketplace:editor.title_new");
  const formId = "product-editor-form";

  const header = (
    <PageHeader
      title={heading}
      description={id ? t("cms_marketplace:editor.description_edit") : t("cms_marketplace:editor.description_new")}
      back={{to: marketplaceRoute.list, label: t("cms_marketplace:editor.back")}}
      actions={
        <>
          {dirty && <span className="text-[13px] text-amber-300">{t("admin:common.unsaved")}</span>}
          {loaded?.status === "published" && (
            <Button variant="ghost" asChild>
              <a href={productRoute.overview(loaded.slug)} target="_blank" rel="noopener">
                <ArrowSquareOut size={16}/> {t("cms_marketplace:editor.view")}
              </a>
            </Button>
          )}
          {id && (
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
        <Panel title={t("cms_marketplace:editor.identity")}>
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
      {id && <ProductNav id={id}/>}

      <form id={formId} onSubmit={submit} className="flex flex-col gap-6" noValidate>
        {save.error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${save.error}`, {defaultValue: save.error})}
          </Alert>
        )}

        <Tabs value={section} onValueChange={(value) => setSection(value as SectionValue)}>
          <TabsList aria-label={t("cms_marketplace:editor.sections.label")}>
            {SECTIONS.map(({value, label, icon: SectionIcon}) => (
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

          <TabsContent value="general">
            <Panel title={t("cms_marketplace:editor.identity")} description={t("cms_marketplace:editor.identity_hint")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <TranslatableField
                  label={t("cms_marketplace:fields.name")}
                  htmlFor="product-name"
                  error={errors.name}
                  hint={t("cms_marketplace:hints.name")}
                  field="name"
                  source={form.name}
                  value={form.translations}
                  onChange={(value) => setForm((current) => ({...current, translations: value}))}
                  limit={NAME_MAX}
                  disabled={save.pending}
                >
                  <Input
                    id="product-name"
                    value={form.name}
                    onChange={(event) => onNameChange(event.target.value)}
                    maxLength={NAME_MAX}
                    aria-invalid={Boolean(errors.name)}
                    autoComplete="off"
                    required
                  />
                </TranslatableField>

                <Field
                  label={t("cms_marketplace:fields.slug")}
                  htmlFor="product-slug"
                  error={errors.slug}
                  hint={t("cms_marketplace:hints.slug")}
                >
                  <Input
                    id="product-slug"
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

                <TranslatableField
                  label={t("cms_marketplace:fields.tagline")}
                  htmlFor="product-tagline"
                  error={errors.tagline}
                  hint={t("cms_marketplace:hints.tagline")}
                  className="sm:col-span-2"
                  field="tagline"
                  source={form.tagline}
                  value={form.translations}
                  onChange={(value) => setForm((current) => ({...current, translations: value}))}
                  limit={TAGLINE_MAX}
                  disabled={save.pending}
                >
                  <Input
                    id="product-tagline"
                    value={form.tagline}
                    onChange={(event) => set("tagline", event.target.value)}
                    maxLength={TAGLINE_MAX}
                    aria-invalid={Boolean(errors.tagline)}
                    autoComplete="off"
                  />
                </TranslatableField>

                <TranslatableField
                  label={t("cms_marketplace:fields.summary")}
                  htmlFor="product-summary"
                  error={errors.summary}
                  hint={t("cms_marketplace:hints.summary", {count: form.summary.length, max: SUMMARY_MAX})}
                  className="sm:col-span-2"
                  field="summary"
                  source={form.summary}
                  value={form.translations}
                  onChange={(value) => setForm((current) => ({...current, translations: value}))}
                  limit={SUMMARY_MAX}
                  disabled={save.pending}
                >
                  <Textarea
                    id="product-summary"
                    value={form.summary}
                    onChange={(event) => set("summary", event.target.value)}
                    rows={3}
                    maxLength={SUMMARY_MAX}
                    aria-invalid={Boolean(errors.summary)}
                    className="resize-y"
                  />
                </TranslatableField>

                <Field
                  label={t("cms_marketplace:fields.status")}
                  htmlFor="product-status"
                  hint={t(`cms_marketplace:editor.status_hint.${form.status}`)}
                >
                  <Select
                    id="product-status"
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
                  label={t("cms_marketplace:fields.featured")}
                  htmlFor="product-featured"
                  hint={t("cms_marketplace:hints.featured")}
                >
                  <label className="flex h-11 items-center gap-2.5 text-sm text-neutral-300">
                    <input
                      id="product-featured"
                      type="checkbox"
                      checked={form.featured}
                      onChange={(event) => set("featured", event.target.checked)}
                      className="size-4 accent-[var(--color-accent)]"
                    />
                    {t("cms_marketplace:fields.featured_label")}
                  </label>
                </Field>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="appearance">
            <Panel title={t("cms_marketplace:editor.appearance")} description={t("cms_marketplace:editor.appearance_hint")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={t("cms_marketplace:fields.banner")}
                  htmlFor="product-banner"
                  hint={t("cms_marketplace:hints.banner")}
                  className="sm:col-span-2"
                >
                  <Input
                    id="product-banner"
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

                <Field label={t("cms_marketplace:fields.icon")} htmlFor="product-icon" hint={t("cms_marketplace:hints.icon")}>
                  <Input
                    id="product-icon"
                    type="url"
                    value={form.iconImageUrl}
                    onChange={(event) => set("iconImageUrl", event.target.value)}
                    placeholder="https://"
                    className="font-mono text-[13px]"
                  />
                </Field>

                <Field
                  label={t("cms_marketplace:fields.accent")}
                  htmlFor="product-accent"
                  error={errors.accentColor}
                  hint={t("cms_marketplace:hints.accent")}
                >
                  <div className="flex items-center gap-2">
                    <Input
                      id="product-accent"
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
                      style={{
                        background: HEX_PATTERN.test(form.accentColor.trim()) ? form.accentColor.trim() : undefined,
                      }}
                    />
                  </div>
                </Field>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="pricing">
            <Panel title={t("cms_marketplace:editor.pricing")} description={t("cms_marketplace:editor.pricing_hint")}>
              <div className="grid gap-5 sm:grid-cols-2">
                <Field
                  label={t("cms_marketplace:fields.pricing_mode")}
                  htmlFor="product-pricing-mode"
                  hint={t(`cms_marketplace:hints.pricing_${form.pricingMode}`)}
                  className="sm:col-span-2"
                >
                  <Select
                    id="product-pricing-mode"
                    value={form.pricingMode}
                    onChange={(event) => set("pricingMode", event.target.value as PricingMode)}
                  >
                    {PRICING_MODES.map((mode) => (
                      <option key={mode} value={mode}>
                        {t(`cms_marketplace:pricing_modes.${mode}`)}
                      </option>
                    ))}
                  </Select>
                </Field>

                {/*
                  * One amount field, and only the one this mode uses. A screen showing both would be a
                  * screen where the figure that is *not* in force is still sitting there looking edited.
                  */}
                {form.pricingMode === "paid" && (
                  <Field
                    label={t("cms_marketplace:fields.price_amount")}
                    htmlFor="product-price"
                    error={errors.priceAmount}
                    hint={t("cms_marketplace:hints.price_amount")}
                  >
                    <Input
                      id="product-price"
                      type="number"
                      inputMode="numeric"
                      min={AMOUNT_MIN}
                      max={AMOUNT_MAX}
                      step={100}
                      value={form.priceAmount}
                      onChange={(event) => set("priceAmount", event.target.value)}
                      aria-invalid={Boolean(errors.priceAmount)}
                      className="font-mono"
                    />
                  </Field>
                )}

                {form.pricingMode === "donation" && (
                  <Field
                    label={t("cms_marketplace:fields.suggested_amount")}
                    htmlFor="product-suggested"
                    error={errors.suggestedAmount}
                    hint={t("cms_marketplace:hints.suggested_amount")}
                  >
                    <Input
                      id="product-suggested"
                      type="number"
                      inputMode="numeric"
                      min={AMOUNT_MIN}
                      max={AMOUNT_MAX}
                      step={100}
                      value={form.suggestedAmount}
                      onChange={(event) => set("suggestedAmount", event.target.value)}
                      aria-invalid={Boolean(errors.suggestedAmount)}
                      className="font-mono"
                    />
                  </Field>
                )}

                {form.pricingMode !== "free" && (
                  <p className="text-[13px] leading-relaxed text-neutral-400 sm:col-span-2">
                    {t("cms_marketplace:editor.pricing_downloads_hint")}
                  </p>
                )}
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="structure">
            <Panel title={t("cms_marketplace:editor.tabs")} description={t("cms_marketplace:editor.tabs_hint")}>
              <TabsField
                available={availableTabs}
                value={form.tabs}
                onChange={(tabs) => set("tabs", tabs)}
                disabled={save.pending}
              />
            </Panel>

            <Panel title={t("cms_marketplace:editor.links")} description={t("cms_marketplace:editor.links_hint")}>
              {errors.links && <p className="mb-3 text-xs text-red-400">{errors.links}</p>}
              <LinksField
                idPrefix="product-link"
                value={form.links}
                onChange={(links) => set("links", links)}
                disabled={save.pending}
              />
            </Panel>
          </TabsContent>

          <TabsContent value="content">
            <Panel title={t("cms_marketplace:editor.overview")} description={t("cms_marketplace:editor.overview_hint")}>
              <TranslatableField
                label={t("cms_marketplace:fields.overview_body")}
                htmlFor="product-overview"
                field="overview_body"
                source={form.overviewBody}
                value={form.translations}
                onChange={(value) => setForm((current) => ({...current, translations: value}))}
                limit={BODY_MAX}
                disabled={save.pending}
              >
                {/* The Markdown editor has a toolbar of its own, so the icon goes in it. */}
                {(action) => (
                  <MarkdownEditor
                    id="product-overview"
                    value={form.overviewBody}
                    onChange={(value) => set("overviewBody", value)}
                    placeholder={t("cms_marketplace:editor.overview_placeholder")}
                    maxLength={BODY_MAX}
                    rows={24}
                    disabled={save.pending}
                    action={action}
                  />
                )}
              </TranslatableField>
            </Panel>

            {/* Shown whether or not the Contact tab is on: writing the text is what usually comes
                before turning the tab on, and hiding the field would make that order impossible. */}
            <Panel title={t("cms_marketplace:editor.contact")} description={t("cms_marketplace:editor.contact_hint")}>
              <TranslatableField
                label={t("cms_marketplace:fields.contact_body")}
                htmlFor="product-contact"
                field="contact_body"
                source={form.contactBody}
                value={form.translations}
                onChange={(value) => setForm((current) => ({...current, translations: value}))}
                limit={BODY_MAX}
                disabled={save.pending}
              >
                {(action) => (
                  <MarkdownEditor
                    id="product-contact"
                    value={form.contactBody}
                    onChange={(value) => set("contactBody", value)}
                    placeholder={t("cms_marketplace:editor.contact_placeholder")}
                    maxLength={BODY_MAX}
                    rows={14}
                    disabled={save.pending}
                    action={action}
                  />
                )}
              </TranslatableField>
            </Panel>
          </TabsContent>
        </Tabs>

        {loaded?.updated_at && (
          <p className="text-[13px] text-neutral-600">
            {t("cms_marketplace:editor.updated_at", {date: formatDateTime(loaded.updated_at, i18n.language)})}
          </p>
        )}
      </form>

      <ConfirmDialog
        open={askPublish}
        title={t("cms_marketplace:editor.publish_title")}
        body={t("cms_marketplace:editor.publish_body", {name: form.name.trim(), slug: form.slug.trim()})}
        confirmLabel={save.pending ? t("admin:common.saving") : t("cms_marketplace:editor.publish_confirm")}
        onConfirm={() => void persist()}
        onClose={() => setAskPublish(false)}
        pending={save.pending}
        error={save.error}
      />

      <ConfirmDialog
        open={askDelete}
        title={t("cms_marketplace:editor.delete_title")}
        body={t("cms_marketplace:editor.delete_body", {name: form.name.trim()})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("cms_marketplace:editor.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setAskDelete(false)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
    </TranslationsProvider>
  );
};
