import {useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {ArrowClockwise, Plus, ShieldCheck} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Role} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

/**
 * Roles, global and per application.
 *
 * Route guards check permission slugs and never role names, which is what makes a role freely
 * re-definable: what a role *means* is the set of permissions on its row, and changing that set
 * changes what everybody holding it can do, without a line of server code moving.
 */
export const RolesList = () => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const navigate = useNavigate();
  const {can} = useAdmin();

  const roles = useResource(useCallback((signal: AbortSignal) => authApi.admin.roles(signal), []));
  const applications = useResource(
    useCallback(
      (signal: AbortSignal) => (can("applications:read") ? authApi.admin.applications(signal) : Promise.resolve([])),
      [can],
    ),
  );

  const scopeOf = useCallback(
    (role: Role) =>
      role.application_id
        ? ((applications.data ?? []).find((entry) => entry.client_id === role.application_id)?.name ??
          role.application_id)
        : t("auth_admin:roles.global"),
    [applications.data, t],
  );

  const rows = useMemo(
    () =>
      [...(roles.data ?? [])].sort(
        (a, b) =>
          Number(Boolean(a.application_id)) - Number(Boolean(b.application_id)) || a.slug.localeCompare(b.slug),
      ),
    [roles.data],
  );

  const columns = useMemo<Column<Role>[]>(
    () => [
      {
        key: "role",
        header: t("auth_admin:roles.column_role"),
        cell: (role) => (
          <span className="min-w-0">
            <span className="flex items-center gap-2">
              <span className="truncate text-text">{role.name || role.slug}</span>
              {role.is_default && <Badge variant="outline" size="sm">{t("auth_admin:roles.default")}</Badge>}
            </span>
            <code className="block truncate text-[12px] text-neutral-500">{role.slug}</code>
          </span>
        ),
      },
      {
        key: "scope",
        header: t("auth_admin:roles.column_scope"),
        className: "w-56",
        cell: (role) => scopeOf(role),
      },
      {
        key: "permissions",
        header: t("auth_admin:roles.column_permissions"),
        hideBelowLg: true,
        cell: (role) =>
          role.permissions.length === 0 ? (
            <span className="text-neutral-600">{t("auth_admin:roles.no_permissions")}</span>
          ) : (
            <span className="flex flex-wrap gap-1">
              {role.permissions.slice(0, 4).map((slug) => (
                <code
                  key={slug}
                  className="rounded-[var(--radius-sm)] bg-neutral-800/60 px-1.5 py-0.5 text-[11px] text-neutral-400"
                >
                  {slug}
                </code>
              ))}
              {role.permissions.length > 4 && (
                <span className="text-[11px] text-neutral-600">
                  {t("auth_admin:roles.more", {count: role.permissions.length - 4})}
                </span>
              )}
            </span>
          ),
      },
    ],
    [t, scopeOf],
  );

  return (
    <>
      <PageHeader
        title={t("auth_admin:roles.title")}
        description={t("auth_admin:roles.description")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={roles.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            {can("roles:write") && (
              <Button size="sm" onClick={() => navigate(adminRoute.newRole)}>
                <Plus size={14}/> {t("auth_admin:roles.create")}
              </Button>
            )}
          </>
        }
      />

      <Surface>
        <SectionState
          resource={roles}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<ShieldCheck size={32}/>}
              title={t("auth_admin:roles.empty")}
              description={t("auth_admin:roles.empty_hint")}
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(role) => role.id}
            caption={t("auth_admin:roles.title")}
            onRowClick={(role) => navigate(adminRoute.role(role.id))}
          />
        </SectionState>
      </Surface>
    </>
  );
};
