import {useCallback, useMemo, useState} from "react";
import type {FormEvent, KeyboardEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useLocation, useNavigate, useSearchParams} from "react-router-dom";
import {CaretDown, CaretRight, PaperPlaneTilt, Plus, X} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import {cmsRoute} from "@/lib/cms/config.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {EmailRecipients} from "@/pages/cms/email/email-recipients.tsx";
import {Segmented} from "@/pages/cms/email/email-segmented.tsx";
import {
  SEND_LIMITS,
  isEmailAddress,
  readComposePrefill,
  recipientsOf,
  scanVariables,
} from "@/pages/cms/email/email-shared.ts";
import type {SendEmail} from "@/lib/cms/types.ts";

/** The two shapes the API accepts: a stored template rendered with variables, or an inline body. */
type Mode = "template" | "custom";
type Layout = "branded" | "raw";

/**
 * Writing and sending one message.
 *
 * The endpoint takes a single flat body and decides for itself which combination of keys it likes,
 * which makes it easy to build a form that can produce a payload the service will reject. So the
 * screen commits to the two combinations that mean something — send a template, or write a one-off
 * — and sends only the keys of the mode that is on screen.
 */
export const EmailCompose = () => {
  const {t} = useTranslation(["cms_emails", "cms", "prose"]);
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const {notify} = useToast();

  /* "Send again" hands the whole logged message over in the router state — bodies are far too big
     for a query string — while `?template=` is the shareable link the templates section uses. */
  const prefill = readComposePrefill(location.state);
  const prefilledTemplate = prefill?.template ?? params.get("template") ?? "";

  const [mode, setMode] = useState<Mode>(() => (prefilledTemplate || !prefill ? "template" : "custom"));
  const [to, setTo] = useState<string[]>(() => recipientsOf(prefill ?? {}));
  const [templateSlug, setTemplateSlug] = useState(prefilledTemplate);
  const [values, setValues] = useState<Record<string, string>>(() => ({...prefill?.variables}));
  const [extra, setExtra] = useState<string[]>(() => Object.keys(prefill?.variables ?? {}));
  const [newVariable, setNewVariable] = useState("");

  const [subject, setSubject] = useState(prefill?.subject ?? "");
  const [layout, setLayout] = useState<Layout>(prefill?.layout === "raw" ? "raw" : "branded");
  const [heading, setHeading] = useState(prefill?.heading ?? "");
  const [html, setHtml] = useState(prefill?.html ?? "");
  const [text, setText] = useState(prefill?.text ?? "");
  const [htmlView, setHtmlView] = useState<"write" | "preview">("write");

  const [advanced, setAdvanced] = useState(Boolean(prefill?.from || prefill?.reply_to));
  const [from, setFrom] = useState(prefill?.from ?? "");
  const [replyTo, setReplyTo] = useState(prefill?.reply_to ?? "");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [confirming, setConfirming] = useState(false);

  const templates = useResource(useCallback((signal: AbortSignal) => cmsApi.templates.list(signal), []));
  const chosen = (templates.data ?? []).find((template) => template.slug === templateSlug);

  /* The picker knows the slug; the bodies the variable scan needs only come with the detail call. */
  const chosenId = chosen?.id;
  const detail = useResource(
    useCallback(
      (signal: AbortSignal) => (chosenId ? cmsApi.templates.get(chosenId, signal) : Promise.resolve(null)),
      [chosenId],
    ),
  );

  const scanned = useMemo(
    () => scanVariables(detail.data?.subject, detail.data?.html, detail.data?.text),
    [detail.data],
  );
  const names = useMemo(
    () => [...scanned, ...extra.filter((name) => !scanned.includes(name))],
    [scanned, extra],
  );

  /* A `?template=` link outlives the template it points at, and a picker silently showing its own
     placeholder while the form still holds the stale slug is the worst of both worlds. */
  const unknownTemplate = Boolean(templateSlug) && !templates.loading && !templates.error && !chosen;

  const send = useMutation(useCallback((body: SendEmail) => cmsApi.emails.send(body), []));

  const addVariable = () => {
    /* Typing the placeholder rather than its name is the obvious mistake, so both forms are taken. */
    const name = newVariable.trim().replace(/^\{+\s*|\s*\}+$/g, "");
    if (!name || names.includes(name)) {
      setNewVariable("");
      return;
    }
    setExtra((current) => [...current, name]);
    setNewVariable("");
  };

  const onNewVariableKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Enter") return;
    /* Enter inside a form submits it; here it means "add this variable". */
    event.preventDefault();
    addVariable();
  };

  const validate = () => {
    const found: Record<string, string> = {};

    if (to.length === 0) found.to = t("cms_emails:compose.errors.no_recipients");
    else if (to.some((address) => !isEmailAddress(address))) found.to = t("cms:validation.invalid_email");

    if (mode === "template") {
      if (!templateSlug) found.template = t("cms_emails:compose.errors.no_template");
    } else {
      const trimmed = subject.trim();
      if (!trimmed) found.subject = t("cms:validation.required");
      else if (trimmed.length > SEND_LIMITS.subject) {
        found.subject = t("cms:validation.too_long", {max: SEND_LIMITS.subject});
      }
      if (heading.trim().length > SEND_LIMITS.heading) {
        found.heading = t("cms:validation.too_long", {max: SEND_LIMITS.heading});
      }
      if (html.length > SEND_LIMITS.body) found.html = t("cms:validation.too_long", {max: SEND_LIMITS.body});
      if (text.length > SEND_LIMITS.body) found.text = t("cms:validation.too_long", {max: SEND_LIMITS.body});
      if (!html.trim() && !text.trim()) found.body = t("cms_emails:compose.errors.no_body");
    }

    if (from.trim() && !isEmailAddress(from.trim())) found.from = t("cms:validation.invalid_email");
    if (replyTo.trim() && !isEmailAddress(replyTo.trim())) found.reply_to = t("cms:validation.invalid_email");

    return found;
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    send.reset();
    const found = validate();
    setErrors(found);
    /* A complaint about a field nobody can see is a dead end. */
    if (found.from || found.reply_to) setAdvanced(true);
    if (Object.keys(found).length > 0) return;
    setConfirming(true);
  };

  /** Only the keys of the chosen mode, and never an `undefined` one. */
  const payload = (): SendEmail => {
    const body: SendEmail = {to};

    if (mode === "template") {
      body.template = templateSlug;
      const variables = Object.fromEntries(names.map((name) => [name, values[name] ?? ""]));
      if (Object.keys(variables).length > 0) body.variables = variables;
    } else {
      body.subject = subject.trim();
      body.layout = layout;
      if (layout === "branded" && heading.trim()) body.heading = heading.trim();
      if (html.trim()) body.html = html;
      if (text.trim()) body.text = text;
    }

    if (from.trim()) body.from = from.trim();
    if (replyTo.trim()) body.reply_to = replyTo.trim();
    return body;
  };

  const confirmSend = async () => {
    const outcome = await send.run(payload());
    if (!outcome.ok) return;

    setConfirming(false);

    /* The send is synchronous and a provider failure comes back as a 200 carrying a `failed`
       record, not as an HTTP error — the attempt was logged either way. So the record's own status
       is what decides the wording here: a 2xx alone would happily tell someone their mail went out
       when the provider had just bounced it. Any other value (`queued`, or something the service
       adds later) is neither, and says so. */
    const created = outcome.data;
    if (created.status === "sent") {
      notify(t("cms_emails:compose.sent"));
    } else if (created.status === "failed") {
      notify(
        created.error
          ? t("cms_emails:compose.rejected_reason", {error: created.error})
          : t("cms_emails:compose.rejected"),
        "error",
      );
    } else {
      notify(t("cms_emails:compose.recorded"), "info");
    }

    /* Either way the detail screen is where the whole record — and the failure — lives. */
    navigate(cmsRoute.emailItem(created.id));
  };

  const recipientCount = t("cms_emails:compose.recipient_count", {count: to.length});

  return (
    <>
      <PageHeader
        back={{to: cmsRoute.emails, label: t("cms_emails:compose.back")}}
        title={t("cms_emails:compose.title")}
        description={t("cms_emails:compose.description")}
      />

      <form className="flex flex-col gap-6" onSubmit={submit} noValidate>
        {send.error && (
          <Alert tone="error" title={t("cms_emails:compose.failed_title")}>
            {t(`admin:errors.${send.error}`, {defaultValue: send.error})}
          </Alert>
        )}

        <Panel
          title={t("cms_emails:compose.recipients_title")}
          description={t("cms_emails:compose.recipients_description")}
        >
          <div className="flex flex-col gap-5">
            <Field label={t("cms_emails:compose.to_label")} htmlFor="compose-to">
              <EmailRecipients id="compose-to" value={to} onChange={setTo} disabled={send.pending} error={errors.to}/>
            </Field>

            <div className="border-t border-neutral-800 pt-4">
              <button
                type="button"
                onClick={() => setAdvanced((open) => !open)}
                aria-expanded={advanced}
                aria-controls="compose-advanced"
                className="inline-flex cursor-pointer items-center gap-1.5 text-[13px] text-neutral-400 transition-colors hover:text-text"
                data-fs-hover
              >
                {advanced ? <CaretDown size={14}/> : <CaretRight size={14}/>}
                {t("cms_emails:compose.advanced")}
              </button>

              {advanced && (
                <div id="compose-advanced" className="mt-4 grid gap-4 sm:grid-cols-2">
                  <Field
                    label={t("cms_emails:compose.from_label")}
                    htmlFor="compose-from"
                    hint={t("cms_emails:compose.from_hint")}
                    error={errors.from}
                  >
                    <Input
                      id="compose-from"
                      type="email"
                      inputMode="email"
                      value={from}
                      maxLength={SEND_LIMITS.address}
                      disabled={send.pending}
                      aria-invalid={errors.from ? true : undefined}
                      onChange={(event) => setFrom(event.target.value)}
                      placeholder="hola@franciscosolis.cl"
                    />
                  </Field>

                  <Field
                    label={t("cms_emails:compose.reply_to_label")}
                    htmlFor="compose-reply-to"
                    hint={t("cms_emails:compose.reply_to_hint")}
                    error={errors.reply_to}
                  >
                    <Input
                      id="compose-reply-to"
                      type="email"
                      inputMode="email"
                      value={replyTo}
                      maxLength={SEND_LIMITS.address}
                      disabled={send.pending}
                      aria-invalid={errors.reply_to ? true : undefined}
                      onChange={(event) => setReplyTo(event.target.value)}
                      placeholder="hola@franciscosolis.cl"
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>
        </Panel>

        <Panel
          title={t("cms_emails:compose.message_title")}
          description={t(`cms_emails:compose.mode_${mode}_description`)}
          action={
            <Segmented
              name="compose-mode"
              label={t("cms_emails:compose.mode_label")}
              value={mode}
              disabled={send.pending}
              onChange={(next) => {
                setMode(next);
                setErrors({});
              }}
              options={[
                {value: "template" as Mode, label: t("cms_emails:compose.mode_template")},
                {value: "custom" as Mode, label: t("cms_emails:compose.mode_custom")},
              ]}
            />
          }
        >
          {mode === "template" ? (
            <div className="flex flex-col gap-5">
              {templates.error && (
                <Alert tone="error" title={t("admin:common.failed")}>
                  {t(`admin:errors.${templates.error}`, {defaultValue: templates.error})}
                </Alert>
              )}

              <Field
                label={t("cms_emails:compose.template_label")}
                htmlFor="compose-template"
                hint={t("cms_emails:compose.template_hint")}
                error={errors.template}
              >
                <Select
                  id="compose-template"
                  value={templateSlug}
                  disabled={send.pending || templates.loading}
                  aria-invalid={errors.template ? true : undefined}
                  onChange={(event) => setTemplateSlug(event.target.value)}
                >
                  <option value="">
                    {templates.loading ? t("admin:common.loading") : t("cms_emails:compose.template_none")}
                  </option>
                  {unknownTemplate && <option value={templateSlug}>{templateSlug}</option>}
                  {(templates.data ?? []).map((template) => (
                    <option key={template.id} value={template.slug}>
                      {template.name ? `${template.name} · ${template.slug}` : template.slug}
                    </option>
                  ))}
                </Select>
              </Field>

              {unknownTemplate && (
                <Alert tone="info">{t("cms_emails:compose.template_unknown", {slug: templateSlug})}</Alert>
              )}

              {!templates.loading && (templates.data ?? []).length === 0 && !templates.error && (
                <Alert tone="info" title={t("cms_emails:compose.no_templates_title")}>
                  {t("cms_emails:compose.no_templates_body")}{" "}
                  <Link to={cmsRoute.templates} className="underline" data-fs-hover>
                    {t("cms_emails:compose.no_templates_link")}
                  </Link>
                </Alert>
              )}

              {templateSlug && (
                <>
                  <Field
                    label={t("cms_emails:compose.template_subject_label")}
                    htmlFor="compose-template-subject"
                    hint={t("cms_emails:compose.template_subject_hint")}
                  >
                    <Input
                      id="compose-template-subject"
                      readOnly
                      disabled
                      value={detail.data?.subject ?? chosen?.subject ?? ""}
                    />
                  </Field>

                  <div className="flex flex-col gap-4 border-t border-neutral-800 pt-5">
                    <div>
                      <h3 className="text-sm font-medium text-neutral-300">
                        {t("cms_emails:compose.variables_title")}
                      </h3>
                      {/* The list comes from reading the template's own text — see `scanVariables`
                          — so it is a helpful guess, not something the API guarantees. */}
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                        {t("cms_emails:compose.variables_hint")}
                      </p>
                    </div>

                    {detail.loading || templates.loading ? (
                      <p className="flex items-center gap-2 text-[13px] text-neutral-500">
                        <Spinner size={14} label={t("admin:common.loading")}/> {t("admin:common.loading")}
                      </p>
                    ) : names.length === 0 ? (
                      <p className="text-[13px] text-neutral-500">{t("cms_emails:compose.variables_empty")}</p>
                    ) : (
                      <div className="grid gap-4 sm:grid-cols-2">
                        {names.map((name) => (
                          <Field key={name} label={name} htmlFor={`compose-var-${name}`}>
                            <div className="flex items-center gap-2">
                              <Input
                                id={`compose-var-${name}`}
                                value={values[name] ?? ""}
                                disabled={send.pending}
                                onChange={(event) =>
                                  setValues((current) => ({...current, [name]: event.target.value}))
                                }
                              />
                              {!scanned.includes(name) && (
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  disabled={send.pending}
                                  aria-label={t("cms_emails:compose.variable_remove", {name})}
                                  onClick={() => setExtra((current) => current.filter((entry) => entry !== name))}
                                  data-fs-hover
                                >
                                  <X size={14}/>
                                </Button>
                              )}
                            </div>
                          </Field>
                        ))}
                      </div>
                    )}

                    <div className="flex flex-wrap items-end gap-2">
                      <Field
                        className="min-w-[14rem] flex-1"
                        label={t("cms_emails:compose.add_variable_label")}
                        htmlFor="compose-variable-new"
                        hint={t("cms_emails:compose.add_variable_hint")}
                      >
                        <Input
                          id="compose-variable-new"
                          value={newVariable}
                          disabled={send.pending}
                          placeholder="first_name"
                          onChange={(event) => setNewVariable(event.target.value)}
                          onKeyDown={onNewVariableKeyDown}
                        />
                      </Field>
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={send.pending || !newVariable.trim()}
                        onClick={addVariable}
                        className="mb-6"
                        data-fs-hover
                      >
                        <Plus size={16}/> {t("cms_emails:compose.add_variable")}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <Field
                label={t("cms_emails:compose.subject_label")}
                htmlFor="compose-subject"
                error={errors.subject}
                hint={t("cms_emails:compose.subject_hint")}
              >
                <Input
                  id="compose-subject"
                  value={subject}
                  maxLength={SEND_LIMITS.subject}
                  disabled={send.pending}
                  aria-invalid={errors.subject ? true : undefined}
                  onChange={(event) => setSubject(event.target.value)}
                  placeholder={t("cms_emails:compose.subject_placeholder")}
                />
              </Field>

              <div className="flex flex-col gap-1.5">
                <p className="text-sm font-medium text-neutral-300">{t("cms_emails:compose.layout_label")}</p>
                <Segmented
                  name="compose-layout"
                  label={t("cms_emails:compose.layout_label")}
                  value={layout}
                  disabled={send.pending}
                  onChange={setLayout}
                  options={[
                    {value: "branded" as Layout, label: t("cms_emails:compose.layout_branded")},
                    {value: "raw" as Layout, label: t("cms_emails:compose.layout_raw")},
                  ]}
                />
                <p className="text-xs leading-relaxed text-neutral-500">
                  {t(`cms_emails:compose.layout_${layout}_hint`)}
                </p>
              </div>

              {/* `heading` is drawn by the house layout, so under `raw` there is nowhere to put it. */}
              {layout === "branded" && (
                <Field
                  label={t("cms_emails:compose.heading_label")}
                  htmlFor="compose-heading"
                  hint={t("cms_emails:compose.heading_hint")}
                  error={errors.heading}
                >
                  <Input
                    id="compose-heading"
                    value={heading}
                    maxLength={SEND_LIMITS.heading}
                    disabled={send.pending}
                    aria-invalid={errors.heading ? true : undefined}
                    onChange={(event) => setHeading(event.target.value)}
                  />
                </Field>
              )}

              {errors.body && <Alert tone="error">{errors.body}</Alert>}

              <div className="flex flex-col gap-1.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {htmlView === "write" ? (
                    <label htmlFor="compose-html" className="text-sm font-medium text-neutral-300">
                      {t("cms_emails:compose.html_label")}
                    </label>
                  ) : (
                    <p className="text-sm font-medium text-neutral-300">{t("cms_emails:compose.html_label")}</p>
                  )}
                  <Segmented
                    name="compose-html-view"
                    label={t("cms_emails:compose.html_view_label")}
                    value={htmlView}
                    onChange={setHtmlView}
                    options={[
                      {value: "write" as const, label: t("prose:markdown.write")},
                      {value: "preview" as const, label: t("prose:markdown.preview")},
                    ]}
                  />
                </div>

                {htmlView === "write" ? (
                  <Textarea
                    id="compose-html"
                    rows={12}
                    value={html}
                    disabled={send.pending}
                    spellCheck={false}
                    aria-invalid={errors.html ? true : undefined}
                    onChange={(event) => setHtml(event.target.value)}
                    className="font-mono text-[13px] leading-relaxed"
                    placeholder="<p>Hola…</p>"
                  />
                ) : html.trim() ? (
                  /* This is HTML written to run inside somebody else's mail client, so it never
                     touches this document: `dangerouslySetInnerHTML` would run a pasted <script>
                     with the CMS session's origin behind it. An iframe with `sandbox=""` — every
                     capability withheld, scripts and same-origin included — is the honest preview. */
                  <iframe
                    title={t("cms_emails:compose.html_preview_title")}
                    sandbox=""
                    srcDoc={html}
                    /* An email is rendered on the client's own canvas, which is white everywhere. */
                    className="h-80 w-full rounded-[var(--radius-md)] border border-neutral-800 bg-white"
                  />
                ) : (
                  <p className="rounded-[var(--radius-md)] border border-dashed border-neutral-800 px-4 py-10 text-center text-[13px] text-neutral-500">
                    {t("prose:markdown.preview_empty")}
                  </p>
                )}

                <p className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className={errors.html ? "text-red-400" : "text-neutral-500"}>
                    {errors.html ?? t("cms_emails:compose.html_hint")}
                  </span>
                  <span className="text-neutral-600">
                    {t("prose:markdown.count_max", {count: html.length, max: SEND_LIMITS.body})}
                  </span>
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="compose-text" className="text-sm font-medium text-neutral-300">
                  {t("cms_emails:compose.text_label")}
                </label>
                <Textarea
                  id="compose-text"
                  rows={8}
                  value={text}
                  disabled={send.pending}
                  aria-invalid={errors.text ? true : undefined}
                  onChange={(event) => setText(event.target.value)}
                  className="font-mono text-[13px] leading-relaxed"
                />
                <p className="flex flex-wrap justify-between gap-2 text-xs">
                  <span className={errors.text ? "text-red-400" : "text-neutral-500"}>
                    {errors.text ?? t("cms_emails:compose.text_hint")}
                  </span>
                  <span className="text-neutral-600">
                    {t("prose:markdown.count_max", {count: text.length, max: SEND_LIMITS.body})}
                  </span>
                </p>
              </div>
            </div>
          )}
        </Panel>

        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit" disabled={send.pending} data-fs-hover>
            {send.pending ? <Spinner size={16}/> : <PaperPlaneTilt size={16}/>}
            {send.pending ? t("cms_emails:compose.sending") : t("cms_emails:compose.send")}
          </Button>
          <Button asChild variant="ghost" data-fs-hover>
            <Link to={cmsRoute.emails}>{t("admin:common.cancel")}</Link>
          </Button>
        </div>
      </form>

      <ConfirmDialog
        open={confirming}
        title={t("cms_emails:compose.confirm_title")}
        body={
          mode === "template"
            ? t("cms_emails:compose.confirm_template", {recipients: recipientCount, template: templateSlug})
            : t("cms_emails:compose.confirm_custom", {recipients: recipientCount, subject: subject.trim()})
        }
        confirmLabel={t("cms_emails:compose.confirm_cta")}
        pending={send.pending}
        error={send.error}
        onConfirm={() => void confirmSend()}
        onClose={() => {
          setConfirming(false);
          send.reset();
        }}
      />
    </>
  );
};
