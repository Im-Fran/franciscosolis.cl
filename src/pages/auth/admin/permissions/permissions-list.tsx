import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, Key, PencilSimple, Plus, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Permission} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

type Draft = {slug: string; name: string; description: string};

const EMPTY: Draft = {slug: "", name: "", description: ""};

/**
 * The permission catalog: every capability a role can be given.
 *
 * Creating one grants nothing by itself. A permission is a string that travels in the access token,
 * so defining one here is how a *different* service — the CMS, or anything else pointed at this
 * issuer — gets a capability of its own without a migration in the auth Worker. Whether anything
 * checks it is that service's business.
 *
 * The slugs the auth Worker guards its own routes with are the exception: it refuses to delete
 * them, because removing one takes no capability away from anybody, it only leaves a guard nothing
 * can satisfy. That refusal is not mirrored here — the service's own sentence says which slug and
 * why, and a copy of the list in this file would drift the first time a route is added.
 */
export const PermissionsList = () => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const {notify} = useToast();

  const permissions = useResource(useCallback((signal: AbortSignal) => authApi.admin.permissions(signal), []));
  const roles = useResource(useCallback((signal: AbortSignal) => authApi.admin.roles(signal), []));

  const create = useMutation(
    useCallback(
      (draft: Draft) =>
        authApi.admin.createPermission({
          slug: draft.slug.trim(),
          name: draft.name.trim(),
          description: orNull(draft.description),
        }),
      [],
    ),
  );
  const update = useMutation(
    useCallback(
      (permissionId: string, draft: Draft) =>
        authApi.admin.updatePermission(permissionId, {
          name: draft.name.trim(),
          description: orNull(draft.description),
        }),
      [],
    ),
  );
  const remove = useMutation(useCallback((permissionId: string) => authApi.admin.deletePermission(permissionId), []));

  const [editing, setEditing] = useState<Permission | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [deleting, setDeleting] = useState<Permission | null>(null);

  const holders = useCallback(
    (slug: string) => (roles.data ?? []).filter((role) => role.permissions.includes(slug)),
    [roles.data],
  );

  const rows = useMemo(
    () => [...(permissions.data ?? [])].sort((a, b) => a.slug.localeCompare(b.slug)),
    [permissions.data],
  );

  const editable = can("roles:write");

  const columns = useMemo<Column<Permission>[]>(
    () => [
      {
        key: "permission",
        header: t("auth_admin:permissions.column_permission"),
        cell: (permission) => (
          <span className="min-w-0">
            <span className="block truncate text-text">{permission.name}</span>
            <code className="block truncate text-[12px] text-neutral-500">{permission.slug}</code>
          </span>
        ),
      },
      {
        key: "description",
        header: t("auth_admin:permissions.column_description"),
        hideBelowLg: true,
        cell: (permission) => permission.description || <span className="text-neutral-600">{t("admin:common.none")}</span>,
      },
      {
        key: "roles",
        header: t("auth_admin:permissions.column_roles"),
        className: "w-56",
        cell: (permission) => {
          const using = holders(permission.slug);
          return using.length === 0 ? (
            <span className="text-neutral-600">{t("auth_admin:permissions.unused")}</span>
          ) : (
            <span className="text-neutral-400">{using.map((role) => role.name || role.slug).join(", ")}</span>
          );
        },
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("auth_admin:permissions.actions")}</span>,
        className: "w-28 text-right",
        cell: (permission) =>
          editable ? (
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                aria-label={t("auth_admin:permissions.edit")}
                onClick={() => {
                  update.reset();
                  setEditing(permission);
                  setDraft({
                    slug: permission.slug,
                    name: permission.name,
                    description: permission.description ?? "",
                  });
                }}
                data-fs-hover
              >
                <PencilSimple size={14}/>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-300 fs-ripple-danger"
                aria-label={t("auth_admin:permissions.delete")}
                onClick={() => setDeleting(permission)}
                data-fs-hover
              >
                <Trash size={14}/>
              </Button>
            </span>
          ) : null,
      },
    ],
    [t, holders, editable, update],
  );

  const open = creating || editing !== null;
  const mutation = creating ? create : update;
  const valid = draft.name.trim().length > 0 && (!creating || /^[a-z0-9][a-z0-9_-]*(:[a-z0-9][a-z0-9_-]*)?$/.test(draft.slug.trim()));

  const close = () => {
    mutation.reset();
    setCreating(false);
    setEditing(null);
    setDraft(EMPTY);
  };

  return (
    <>
      <PageHeader
        title={t("auth_admin:permissions.title")}
        description={t("auth_admin:permissions.description")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={permissions.reload} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            {editable && (
              <Button
                size="sm"
                onClick={() => {
                  create.reset();
                  setDraft(EMPTY);
                  setCreating(true);
                }}
                data-fs-hover
              >
                <Plus size={14}/> {t("auth_admin:permissions.create")}
              </Button>
            )}
          </>
        }
      />

      <Surface>
        <SectionState
          resource={permissions}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<Key size={32}/>}
              title={t("auth_admin:permissions.empty")}
              description={t("auth_admin:permissions.empty_hint")}
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(permission) => permission.id}
            caption={t("auth_admin:permissions.title")}
          />
        </SectionState>
      </Surface>

      <Modal
        open={open}
        onClose={() => (mutation.pending ? undefined : close())}
        title={creating ? t("auth_admin:permissions.create") : t("auth_admin:permissions.edit")}
        className="max-w-lg"
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = creating ? await create.run(draft) : await update.run(editing?.id ?? "", draft);
            if (!result.ok) return;
            notify(creating ? t("auth_admin:permissions.created") : t("admin:common.saved"));
            close();
            permissions.reload();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:permissions.slug_label")}</span>
            {creating ? (
              <Input
                value={draft.slug}
                onChange={(event) => setDraft((current) => ({...current, slug: event.target.value}))}
                placeholder="reports:read"
                autoFocus
                maxLength={64}
              />
            ) : (
              <code className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900 px-3 py-2 text-[13px] text-neutral-300">
                {draft.slug}
              </code>
            )}
            <span className="text-[12px] leading-relaxed text-neutral-600">
              {creating ? t("auth_admin:permissions.slug_hint") : t("auth_admin:permissions.slug_fixed")}
            </span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:permissions.name_label")}</span>
            <Input
              value={draft.name}
              onChange={(event) => setDraft((current) => ({...current, name: event.target.value}))}
              maxLength={120}
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:permissions.description_label")}</span>
            <Input
              value={draft.description}
              onChange={(event) => setDraft((current) => ({...current, description: event.target.value}))}
            />
          </label>

          {mutation.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${mutation.error}`, {defaultValue: mutation.error})}
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={close} disabled={mutation.pending} data-fs-hover>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={!valid || mutation.pending} data-fs-hover>
              {mutation.pending ? <Spinner size={16}/> : null}
              {creating ? t("admin:common.create") : t("admin:common.save")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={t("auth_admin:permissions.delete")}
        body={t("auth_admin:permissions.delete_body", {
          slug: deleting?.slug ?? "",
          count: deleting ? holders(deleting.slug).length : 0,
        })}
        confirmLabel={t("auth_admin:permissions.delete")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => {
          remove.reset();
          setDeleting(null);
        }}
        onConfirm={async () => {
          if (!deleting) return;
          const result = await remove.run(deleting.id);
          if (result.ok) {
            notify(t("auth_admin:permissions.deleted"));
            setDeleting(null);
            permissions.reload();
            roles.reload();
          }
        }}
      />
    </>
  );
};
