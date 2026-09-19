import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowClockwise, FloppyDisk, Plus} from "@phosphor-icons/react";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TagInput} from "@/components/admin/tag-input.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {CLIENT_AUTH_METHODS, GRANT_TYPES, SUPPORTED_SCOPES} from "@/lib/auth/types.ts";
import type {Application, ClientAuthMethod, GrantType} from "@/lib/auth/types.ts";
import {SectionState} from "@/pages/auth/admin/components/section.tsx";
import {SecretsPanel} from "@/pages/auth/admin/applications/secrets-panel.tsx";

type Draft = {
  client_id: string;
  name: string;
  description: string;
  token_endpoint_auth_method: ClientAuthMethod;
  redirect_uris: string[];
  post_logout_redirect_uris: string[];
  grant_types: GrantType[];
  scopes: string[];
  allowed_origins: string[];
  require_pkce: boolean;
  is_active: boolean;
};

const EMPTY: Draft = {
  client_id: "",
  name: "",
  description: "",
  token_endpoint_auth_method: "none",
  redirect_uris: [],
  post_logout_redirect_uris: [],
  grant_types: ["authorization_code", "refresh_token"],
  scopes: [],
  allowed_origins: [],
  require_pkce: true,
  is_active: true,
};

const toDraft = (application: Application): Draft => ({
  client_id: application.client_id,
  name: application.name,
  description: application.description ?? "",
  token_endpoint_auth_method: application.token_endpoint_auth_method ?? (application.confidential ? "client_secret_post" : "none"),
  redirect_uris: application.redirect_uris ?? [],
  post_logout_redirect_uris: application.post_logout_redirect_uris ?? [],
  grant_types: application.grant_types ?? ["authorization_code", "refresh_token"],
  scopes: application.scopes ?? [],
  allowed_origins: application.allowed_origins ?? [],
  require_pkce: application.require_pkce ?? true,
  is_active: application.is_active ?? true,
});

/**
 * Label, control and hint as one block.
 *
 * The label is a sibling pointing at `htmlFor`, never a wrapper around the control. An implicit
 * label takes the first labelable descendant as its control, and activating the label re-fires the
 * click on it — with a `TagInput` inside, that first descendant is the remove button of the first
 * chip, so removing any one URI also removed the first one.
 */
const Field = ({
  label,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) => (
  <div className="flex flex-col gap-1.5">
    {htmlFor ? (
      <label htmlFor={htmlFor} className="text-[13px] text-neutral-400">{label}</label>
    ) : (
      <span className="text-[13px] text-neutral-400">{label}</span>
    )}
    {children}
    {hint && <span className="text-[12px] leading-relaxed text-neutral-600">{hint}</span>}
  </div>
);

const Toggle = ({
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  hint?: string;
  disabled?: boolean;
}) => (
  <label className="flex items-start gap-3">
    <input
      type="checkbox"
      checked={checked}
      disabled={disabled}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-1"
    />
    <span>
      <span className="block text-[13px] text-neutral-300">{label}</span>
      {hint && <span className="block text-[12px] leading-relaxed text-neutral-600">{hint}</span>}
    </span>
  </label>
);

/**
 * One client application, or a new one.
 *
 * Two of these fields decide how a client authenticates and are easy to get wrong together, so the
 * form keeps them honest rather than letting the service refuse the pair:
 *
 * - **`token_endpoint_auth_method`** is what makes a client public or confidential. A browser
 *   application cannot keep a secret, so `none` is the right answer for every front-end here.
 * - **PKCE** can only be turned off for a confidential client, and exists for off-the-shelf relying
 *   parties that never implemented it. The checkbox is therefore disabled while the client is
 *   public, where PKCE is the only thing binding an authorization code to the browser that asked.
 *
 * Redirect URIs are matched byte for byte, with no wildcards — a trailing slash is a different URI.
 * Allowed origins are the one place a pattern is accepted (`https://*.example.com`), because
 * Cloudflare preview deployments answer on hostnames that do not exist until the deployment does.
 */
export const ApplicationEditor = ({mode}: {mode: "create" | "edit"}) => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const navigate = useNavigate();
  const {id = ""} = useParams();
  const {can} = useAdmin();
  const {notify} = useToast();

  const applications = useResource(
    useCallback(
      (signal: AbortSignal) => (mode === "edit" ? authApi.admin.applications(signal) : Promise.resolve([])),
      [mode],
    ),
  );
  const application = useMemo(
    () => (applications.data ?? []).find((entry) => entry.client_id === id) ?? null,
    [applications.data, id],
  );

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);

  /* The list is the only source of an application's fields, so the form fills in once it lands. */
  useEffect(() => {
    if (application) setDraft(toDraft(application));
  }, [application]);

  const create = useMutation(
    useCallback(
      (body: Draft) =>
        authApi.admin.createApplication({
          client_id: body.client_id.trim(),
          name: body.name.trim(),
          description: orNull(body.description),
          redirect_uris: body.redirect_uris,
          post_logout_redirect_uris: body.post_logout_redirect_uris,
          token_endpoint_auth_method: body.token_endpoint_auth_method,
          grant_types: body.grant_types,
          scopes: body.scopes,
          require_pkce: body.require_pkce,
          allowed_origins: body.allowed_origins,
        }),
      [],
    ),
  );

  const update = useMutation(
    useCallback(
      (body: Draft) =>
        authApi.admin.updateApplication(body.client_id, {
          name: body.name.trim(),
          description: orNull(body.description),
          redirect_uris: body.redirect_uris,
          post_logout_redirect_uris: body.post_logout_redirect_uris,
          token_endpoint_auth_method: body.token_endpoint_auth_method,
          grant_types: body.grant_types,
          scopes: body.scopes,
          require_pkce: body.require_pkce,
          allowed_origins: body.allowed_origins,
          is_active: body.is_active,
        }),
      [],
    ),
  );

  const pending = create.pending || update.pending;
  const error = create.error ?? update.error;
  const confidential = draft.token_endpoint_auth_method !== "none";
  const editable = can("applications:write");

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({...current, [key]: value}));
  };

  const setAuthMethod = (method: ClientAuthMethod) => {
    setTouched(true);
    setDraft((current) => ({
      ...current,
      token_endpoint_auth_method: method,
      /* PKCE is mandatory for a public client, so turning one public turns it back on. */
      require_pkce: method === "none" ? true : current.require_pkce,
    }));
  };

  const submit = async () => {
    if (mode === "create") {
      const result = await create.run(draft);
      if (!result.ok) return;
      notify(t("auth_admin:applications.created", {name: draft.name.trim()}));
      navigate(adminRoute.application(result.data.client_id), {replace: true});
      return;
    }

    const result = await update.run(draft);
    if (!result.ok) return;
    notify(t("admin:common.saved"));
    setTouched(false);
    applications.reload();
  };

  const valid =
    draft.name.trim().length > 0 &&
    draft.redirect_uris.length > 0 &&
    (mode === "edit" || /^[a-z0-9][a-z0-9_-]*$/.test(draft.client_id.trim()));

  const body = (
    <div className="flex flex-col gap-6">
      <Panel title={t("auth_admin:applications.identity_title")} description={t("auth_admin:applications.identity_description")}>
        <div className="flex flex-col gap-5">
          <Field
            label={t("auth_admin:applications.client_id_label")}
            hint={mode === "create" ? t("auth_admin:applications.client_id_hint") : t("auth_admin:applications.client_id_fixed")}
            htmlFor={mode === "create" ? "application-client-id" : undefined}
          >
            {mode === "create" ? (
              <Input
                id="application-client-id"
                value={draft.client_id}
                onChange={(event) => set("client_id", event.target.value)}
                placeholder="my-application"
                disabled={!editable}
              />
            ) : (
              <code className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900 px-3 py-2 text-[13px] text-neutral-300">
                {draft.client_id}
              </code>
            )}
          </Field>

          <Field
            label={t("auth_admin:applications.name_label")}
            hint={t("auth_admin:applications.name_hint")}
            htmlFor="application-name"
          >
            <Input
              id="application-name"
              value={draft.name}
              onChange={(event) => set("name", event.target.value)}
              disabled={!editable}
              maxLength={120}
            />
          </Field>

          <Field label={t("auth_admin:applications.description_label")} htmlFor="application-description">
            <Input
              id="application-description"
              value={draft.description}
              onChange={(event) => set("description", event.target.value)}
              disabled={!editable}
            />
          </Field>

          {mode === "edit" && (
            <Toggle
              checked={draft.is_active}
              onChange={(value) => set("is_active", value)}
              disabled={!editable}
              label={t("auth_admin:applications.active_label")}
              hint={t("auth_admin:applications.active_hint")}
            />
          )}
        </div>
      </Panel>

      <Panel title={t("auth_admin:applications.urls_title")} description={t("auth_admin:applications.urls_description")}>
        <div className="flex flex-col gap-5">
          <Field
            label={t("auth_admin:applications.redirects_label")}
            hint={t("auth_admin:applications.redirects_hint")}
            htmlFor="redirect-uris"
          >
            <TagInput
              id="redirect-uris"
              value={draft.redirect_uris}
              onChange={(value) => set("redirect_uris", value)}
              placeholder="https://example.com/auth/callback"
              disabled={!editable}
              maxTagLength={2048}
            />
          </Field>

          <Field
            label={t("auth_admin:applications.post_logout_label")}
            hint={t("auth_admin:applications.post_logout_hint")}
            htmlFor="post-logout-uris"
          >
            <TagInput
              id="post-logout-uris"
              value={draft.post_logout_redirect_uris}
              onChange={(value) => set("post_logout_redirect_uris", value)}
              placeholder="https://example.com/"
              disabled={!editable}
              maxTagLength={2048}
            />
          </Field>

          <Field
            label={t("auth_admin:applications.origins_label")}
            hint={t("auth_admin:applications.origins_hint")}
            htmlFor="allowed-origins"
          >
            <TagInput
              id="allowed-origins"
              value={draft.allowed_origins}
              onChange={(value) => set("allowed_origins", value)}
              placeholder="https://example.com"
              disabled={!editable}
              maxTagLength={253}
            />
          </Field>
        </div>
      </Panel>

      <Panel title={t("auth_admin:applications.oauth_title")} description={t("auth_admin:applications.oauth_description")}>
        <div className="flex flex-col gap-5">
          <Field
            label={t("auth_admin:applications.auth_method_label")}
            hint={t("auth_admin:applications.auth_method_hint")}
            htmlFor="application-auth-method"
          >
            <select
              id="application-auth-method"
              value={draft.token_endpoint_auth_method}
              onChange={(event) => setAuthMethod(event.target.value as ClientAuthMethod)}
              disabled={!editable}
              className="h-9 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
            >
              {CLIENT_AUTH_METHODS.map((method) => (
                <option key={method} value={method}>
                  {t(`auth_admin:applications.auth_method.${method}`)}
                </option>
              ))}
            </select>
          </Field>

          <Toggle
            checked={draft.require_pkce}
            onChange={(value) => set("require_pkce", value)}
            disabled={!editable || !confidential}
            label={t("auth_admin:applications.pkce_label")}
            hint={confidential ? t("auth_admin:applications.pkce_hint") : t("auth_admin:applications.pkce_locked")}
          />

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] text-neutral-400">{t("auth_admin:applications.grants_label")}</legend>
            {GRANT_TYPES.map((grant) => (
              <Toggle
                key={grant}
                checked={draft.grant_types.includes(grant)}
                disabled={!editable}
                onChange={(value) =>
                  set(
                    "grant_types",
                    value ? [...draft.grant_types, grant] : draft.grant_types.filter((entry) => entry !== grant),
                  )
                }
                label={t(`auth_admin:applications.grant.${grant}`)}
              />
            ))}
            <p className="text-[12px] leading-relaxed text-neutral-600">{t("auth_admin:applications.grants_hint")}</p>
          </fieldset>

          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-[13px] text-neutral-400">{t("auth_admin:applications.scopes_label")}</legend>
            <div className="flex flex-wrap gap-x-6 gap-y-2">
              {SUPPORTED_SCOPES.map((scope) => (
                <Toggle
                  key={scope}
                  checked={draft.scopes.includes(scope)}
                  disabled={!editable}
                  onChange={(value) =>
                    set("scopes", value ? [...draft.scopes, scope] : draft.scopes.filter((entry) => entry !== scope))
                  }
                  label={scope}
                />
              ))}
            </div>
            <p className="text-[12px] leading-relaxed text-neutral-600">
              {draft.scopes.length === 0
                ? t("auth_admin:applications.scopes_all")
                : t("auth_admin:applications.scopes_hint")}
            </p>
          </fieldset>
        </div>
      </Panel>

      {mode === "edit" && <SecretsPanel clientId={draft.client_id} confidential={confidential}/>}

      {error && (
        <Alert tone="error" title={t("admin:common.failed")}>
          {t(`admin:errors.${error}`, {defaultValue: error})}
        </Alert>
      )}

      {editable && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {touched && <span className="text-[13px] text-neutral-500">{t("admin:common.unsaved")}</span>}
          <Button onClick={submit} disabled={!valid || pending}>
            {pending ? <Spinner size={16}/> : mode === "create" ? <Plus size={16}/> : <FloppyDisk size={16}/>}
            {mode === "create" ? t("auth_admin:applications.register") : t("admin:common.save")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={mode === "create" ? t("auth_admin:applications.register") : draft.name || id}
        description={mode === "create" ? t("auth_admin:applications.register_description") : draft.client_id}
        back={{to: adminRoute.applications, label: t("auth_admin:applications.back")}}
        actions={
          mode === "edit" ? (
            <Button variant="ghost" size="sm" onClick={applications.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
          ) : undefined
        }
      />

      {mode === "create" ? (
        body
      ) : (
        <SectionState resource={applications}>
          {application ? (
            body
          ) : (
            <Alert tone="error" title={t("admin:common.failed")}>{t("admin:errors.not_found")}</Alert>
          )}
        </SectionState>
      )}
    </>
  );
};
