import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {ArrowClockwise, FloppyDisk, Plus, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {slugify} from "@/lib/admin/format.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Role} from "@/lib/auth/types.ts";
import {SectionState} from "@/pages/auth/admin/components/section.tsx";

type Draft = {
  slug: string;
  name: string;
  description: string;
  application_id: string;
  is_default: boolean;
  permissions: string[];
};

const EMPTY: Draft = {slug: "", name: "", description: "", application_id: "", is_default: false, permissions: []};

/**
 * One role: what it is called, where it applies, and exactly which permissions it carries.
 *
 * The slug and the scope are not editable after creation, and the API refuses to change them: both
 * are what existing grants and already-issued tokens name this role by, so editing either would
 * re-point every one of them at something else. A role that needs a different slug is a new role.
 *
 * Permissions are sent as the whole set on save rather than as a diff — the same rule the API's own
 * `PATCH` follows — so what is ticked here is exactly what the role ends up with.
 */
export const RoleEditor = ({mode}: {mode: "create" | "edit"}) => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const navigate = useNavigate();
  const {id = ""} = useParams();
  const {can} = useAdmin();
  const {notify} = useToast();

  const roles = useResource(useCallback((signal: AbortSignal) => authApi.admin.roles(signal), []));
  const permissions = useResource(useCallback((signal: AbortSignal) => authApi.admin.permissions(signal), []));
  const applications = useResource(
    useCallback(
      (signal: AbortSignal) => (can("applications:read") ? authApi.admin.applications(signal) : Promise.resolve([])),
      [can],
    ),
  );

  const role: Role | null = useMemo(
    () => (mode === "edit" ? ((roles.data ?? []).find((entry) => entry.id === id) ?? null) : null),
    [roles.data, id, mode],
  );

  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [touched, setTouched] = useState(false);
  const [slugEdited, setSlugEdited] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (!role) return;
    setDraft({
      slug: role.slug,
      name: role.name,
      description: role.description ?? "",
      application_id: role.application_id ?? "",
      is_default: role.is_default ?? false,
      permissions: [...role.permissions],
    });
  }, [role]);

  const create = useMutation(
    useCallback(
      (body: Draft) =>
        authApi.admin.createRole({
          slug: body.slug.trim(),
          name: body.name.trim(),
          description: orNull(body.description),
          application_id: body.application_id || null,
          is_default: body.is_default,
          permissions: body.permissions,
        }),
      [],
    ),
  );
  const update = useMutation(
    useCallback(
      (body: Draft) =>
        authApi.admin.updateRole(id, {
          name: body.name.trim(),
          description: orNull(body.description),
          is_default: body.is_default,
          permissions: body.permissions,
        }),
      [id],
    ),
  );
  const remove = useMutation(useCallback(() => authApi.admin.deleteRole(id), [id]));

  const editable = can("roles:write");
  const pending = create.pending || update.pending;
  const error = create.error ?? update.error;

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({...current, [key]: value}));
  };

  const grouped = useMemo(() => {
    const groups = new Map<string, {slug: string; name: string; description?: string | null}[]>();
    for (const permission of permissions.data ?? []) {
      const [resource] = permission.slug.split(":");
      const key = resource || permission.slug;
      groups.set(key, [...(groups.get(key) ?? []), permission]);
    }
    return [...groups.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [permissions.data]);

  const submit = async () => {
    if (mode === "create") {
      const result = await create.run(draft);
      if (!result.ok) return;
      notify(t("auth_admin:roles.created", {name: draft.name.trim()}));
      navigate(adminRoute.role(result.data.id), {replace: true});
      return;
    }
    const result = await update.run(draft);
    if (!result.ok) return;
    notify(t("admin:common.saved"));
    setTouched(false);
    roles.reload();
  };

  const valid = draft.name.trim().length > 0 && (mode === "edit" || /^[a-z0-9][a-z0-9_-]{1,62}$/.test(draft.slug));

  const body = (
    <div className="flex flex-col gap-6">
      <Panel title={t("auth_admin:roles.identity_title")} description={t("auth_admin:roles.identity_description")}>
        <div className="flex flex-col gap-5">
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:roles.name_label")}</span>
            <Input
              value={draft.name}
              disabled={!editable}
              onChange={(event) => {
                const name = event.target.value;
                setTouched(true);
                setDraft((current) => ({
                  ...current,
                  name,
                  /* Until the slug is touched by hand it follows the name, as it does in the CMS. */
                  slug: mode === "create" && !slugEdited ? slugify(name).slice(0, 63) : current.slug,
                }));
              }}
              maxLength={120}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:roles.slug_label")}</span>
            {mode === "create" ? (
              <Input
                value={draft.slug}
                disabled={!editable}
                onChange={(event) => {
                  setSlugEdited(true);
                  set("slug", event.target.value);
                }}
                placeholder="editor"
              />
            ) : (
              <code className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900 px-3 py-2 text-[13px] text-neutral-300">
                {draft.slug}
              </code>
            )}
            <span className="text-[12px] leading-relaxed text-neutral-600">
              {mode === "create" ? t("auth_admin:roles.slug_hint") : t("auth_admin:roles.slug_fixed")}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:roles.description_label")}</span>
            <Input
              value={draft.description}
              disabled={!editable}
              onChange={(event) => set("description", event.target.value)}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:roles.scope_label")}</span>
            {mode === "create" ? (
              <select
                value={draft.application_id}
                disabled={!editable}
                onChange={(event) => set("application_id", event.target.value)}
                className="h-9 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
              >
                <option value="">{t("auth_admin:roles.global")}</option>
                {(applications.data ?? []).map((application) => (
                  <option key={application.client_id} value={application.client_id}>
                    {application.name}
                  </option>
                ))}
              </select>
            ) : (
              <span className="text-sm text-neutral-300">
                {draft.application_id || t("auth_admin:roles.global")}
              </span>
            )}
            <span className="text-[12px] leading-relaxed text-neutral-600">
              {mode === "create" ? t("auth_admin:roles.scope_hint") : t("auth_admin:roles.scope_fixed")}
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={draft.is_default}
              disabled={!editable}
              onChange={(event) => set("is_default", event.target.checked)}
              className="mt-1"
            />
            <span>
              <span className="block text-[13px] text-neutral-300">{t("auth_admin:roles.default_label")}</span>
              <span className="block text-[12px] leading-relaxed text-neutral-600">
                {t("auth_admin:roles.default_hint")}
              </span>
            </span>
          </label>
        </div>
      </Panel>

      <Panel
        title={t("auth_admin:roles.permissions_title")}
        description={t("auth_admin:roles.permissions_description")}
      >
        <SectionState resource={permissions}>
          <div className="flex flex-col gap-6">
            {grouped.map(([resource, entries]) => (
              <div key={resource} className="flex flex-col gap-2">
                <p className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{resource}</p>
                {entries.map((permission) => (
                  <label key={permission.slug} className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={draft.permissions.includes(permission.slug)}
                      disabled={!editable}
                      onChange={(event) =>
                        set(
                          "permissions",
                          event.target.checked
                            ? [...draft.permissions, permission.slug]
                            : draft.permissions.filter((entry) => entry !== permission.slug),
                        )
                      }
                      className="mt-1"
                    />
                    <span className="min-w-0">
                      <span className="flex flex-wrap items-baseline gap-2">
                        <span className="text-[13px] text-neutral-300">{permission.name}</span>
                        <code className="text-[11px] text-neutral-600">{permission.slug}</code>
                      </span>
                      {permission.description && (
                        <span className="block text-[12px] leading-relaxed text-neutral-600">
                          {permission.description}
                        </span>
                      )}
                    </span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </SectionState>
      </Panel>

      {error && (
        <Alert tone="error" title={t("admin:common.failed")}>
          {t(`admin:errors.${error}`, {defaultValue: error})}
        </Alert>
      )}

      {editable && (
        <div className="flex flex-wrap items-center justify-end gap-3">
          {mode === "edit" && (
            <Button
              variant="ghost"
              className="mr-auto text-red-300 fs-ripple-danger"
              onClick={() => setDeleting(true)}
              data-fs-hover
            >
              <Trash size={16}/> {t("auth_admin:roles.delete")}
            </Button>
          )}
          {touched && <span className="text-[13px] text-neutral-500">{t("admin:common.unsaved")}</span>}
          <Button onClick={submit} disabled={!valid || pending} data-fs-hover>
            {pending ? <Spinner size={16}/> : mode === "create" ? <Plus size={16}/> : <FloppyDisk size={16}/>}
            {mode === "create" ? t("auth_admin:roles.create") : t("admin:common.save")}
          </Button>
        </div>
      )}
    </div>
  );

  return (
    <>
      <PageHeader
        title={mode === "create" ? t("auth_admin:roles.create") : draft.name || t("auth_admin:roles.title")}
        description={mode === "create" ? t("auth_admin:roles.create_description") : draft.slug}
        back={{to: adminRoute.roles, label: t("auth_admin:roles.back")}}
        actions={
          mode === "edit" ? (
            <Button variant="ghost" size="sm" onClick={roles.reload} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
          ) : undefined
        }
      />

      {mode === "create" ? (
        body
      ) : (
        <SectionState resource={roles}>
          {role ? body : <Alert tone="error" title={t("admin:common.failed")}>{t("admin:errors.not_found")}</Alert>}
        </SectionState>
      )}

      <ConfirmDialog
        open={deleting}
        title={t("auth_admin:roles.delete")}
        body={t("auth_admin:roles.delete_body", {name: draft.name || draft.slug})}
        confirmLabel={t("auth_admin:roles.delete")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => {
          remove.reset();
          setDeleting(false);
        }}
        onConfirm={async () => {
          const result = await remove.run();
          if (result.ok) {
            notify(t("auth_admin:roles.deleted"));
            navigate(adminRoute.roles, {replace: true});
          }
        }}
      />
    </>
  );
};
