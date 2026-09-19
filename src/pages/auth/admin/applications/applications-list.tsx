import {useCallback, useMemo} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate} from "react-router-dom";
import {AppWindow, ArrowClockwise, Plus} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Application} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

/** Every client that may start a sign-in. A row is a client id somebody has configured somewhere. */
export const ApplicationsList = () => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const navigate = useNavigate();
  const {can} = useAdmin();

  const applications = useResource(useCallback((signal: AbortSignal) => authApi.admin.applications(signal), []));
  const rows = applications.data ?? [];

  const columns = useMemo<Column<Application>[]>(
    () => [
      {
        key: "name",
        header: t("auth_admin:applications.column_name"),
        cell: (application) => (
          <span className="min-w-0">
            <span className="block truncate text-text">{application.name}</span>
            <code className="block truncate text-[12px] text-neutral-500">{application.client_id}</code>
          </span>
        ),
      },
      {
        key: "kind",
        header: t("auth_admin:applications.column_kind"),
        className: "w-40",
        cell: (application) => (
          <Badge variant="outline" size="sm">
            {application.confidential
              ? t("auth_admin:applications.confidential")
              : t("auth_admin:applications.public")}
          </Badge>
        ),
      },
      {
        key: "redirects",
        header: t("auth_admin:applications.column_redirects"),
        className: "w-32",
        hideBelowLg: true,
        cell: (application) => (application.redirect_uris ?? []).length,
      },
      {
        key: "status",
        header: t("auth_admin:applications.column_status"),
        className: "w-32",
        cell: (application) => <StatusBadge status={application.is_active === false ? "inactive" : "active"}/>,
      },
    ],
    [t],
  );

  return (
    <>
      <PageHeader
        title={t("auth_admin:applications.title")}
        description={t("auth_admin:applications.description")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={applications.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            {can("applications:write") && (
              <Button size="sm" onClick={() => navigate(adminRoute.newApplication)}>
                <Plus size={14}/> {t("auth_admin:applications.register")}
              </Button>
            )}
          </>
        }
      />

      <Surface>
        <SectionState
          resource={applications}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<AppWindow size={32}/>}
              title={t("auth_admin:applications.empty")}
              description={t("auth_admin:applications.empty_hint")}
              action={
                can("applications:write") ? (
                  <Button size="sm" onClick={() => navigate(adminRoute.newApplication)}>
                    <Plus size={14}/> {t("auth_admin:applications.register")}
                  </Button>
                ) : undefined
              }
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(application) => application.client_id}
            caption={t("auth_admin:applications.title")}
            onRowClick={(application) => navigate(adminRoute.application(application.client_id))}
          />
        </SectionState>
      </Surface>
    </>
  );
};
