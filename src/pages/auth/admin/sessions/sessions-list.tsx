import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowClockwise, Monitor, SignOut} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {AdminSession} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

const PAGE_SIZE = 50;

/**
 * Who is signed in right now.
 *
 * A session is one sign-in on one device in one application, so the same person signed in to the
 * site and to the CMS is two rows — revoking one leaves the other alone. Revoking ends the refresh
 * chain immediately, but an access token already in that browser stays syntactically valid until it
 * expires; what stops it is that every endpoint re-checks the session, so the next request fails.
 */
export const SessionsList = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const {notify} = useToast();
  const [params, setParams] = useSearchParams();

  const application = params.get("application") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;

  const sessions = useResource(
    useCallback(
      (signal: AbortSignal) =>
        authApi.admin.sessions(
          {application_id: application || undefined, limit: PAGE_SIZE, offset},
          signal,
        ),
      [application, offset],
    ),
  );
  const applications = useResource(
    useCallback(
      (signal: AbortSignal) => (can("applications:read") ? authApi.admin.applications(signal) : Promise.resolve([])),
      [can],
    ),
  );

  const revoke = useMutation(useCallback((id: string) => authApi.admin.revokeUserSession(id), []));
  const [revoking, setRevoking] = useState<AdminSession | null>(null);

  const rows = sessions.data ?? [];

  const setParam = (key: string, value: string) =>
    setParams((current) => {
      const next = new URLSearchParams(current);
      if (value) next.set(key, value);
      else next.delete(key);
      if (key !== "offset") next.delete("offset");
      return next;
    });

  const columns = useMemo<Column<AdminSession>[]>(
    () => [
      {
        key: "user",
        header: t("auth_admin:sessions.column_user"),
        cell: (session) => (
          <span className="flex items-center gap-3">
            <Avatar
              name={session.user_name}
              email={session.user_email ?? ""}
              picture={session.user_picture}
              size={28}
            />
            <span className="min-w-0">
              {session.user_id ? (
                <Link
                  to={adminRoute.user(session.user_id)}
                  onClick={(event) => event.stopPropagation()}
                  className="block truncate text-text underline-offset-2 hover:underline"
                >
                  {session.user_name || session.user_email}
                </Link>
              ) : (
                <span className="block truncate text-text">{session.user_email}</span>
              )}
              {session.user_name && (
                <span className="block truncate text-[12px] text-neutral-500">{session.user_email}</span>
              )}
            </span>
          </span>
        ),
      },
      {
        key: "application",
        header: t("auth_admin:sessions.column_application"),
        className: "w-48",
        cell: (session) => session.application_name ?? session.application_id,
      },
      {
        key: "device",
        header: t("auth_admin:sessions.column_device"),
        hideBelowLg: true,
        cell: (session) => (
          <span className="min-w-0">
            <span className="block truncate">{describeUserAgent(session.user_agent) ?? t("admin:common.none")}</span>
            {session.ip && <span className="block truncate text-[12px] text-neutral-600">{session.ip}</span>}
          </span>
        ),
      },
      {
        key: "provider",
        header: t("auth_admin:sessions.column_provider"),
        className: "w-36",
        hideBelowLg: true,
        cell: (session) => t(`auth:providers.${session.provider}`, {defaultValue: session.provider}),
      },
      {
        key: "last_seen",
        header: t("auth_admin:sessions.column_last_seen"),
        className: "w-48",
        cell: (session) => formatDateTime(session.last_seen_at, i18n.language),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("auth_admin:sessions.revoke")}</span>,
        className: "w-32 text-right",
        cell: (session) =>
          can("sessions:revoke") ? (
            <Button
              variant="ghost"
              size="sm"
              className="text-red-300 fs-ripple-danger"
              onClick={() => setRevoking(session)}
            >
              <SignOut size={14}/> {t("auth_admin:sessions.revoke")}
            </Button>
          ) : null,
      },
    ],
    [t, i18n.language, can],
  );

  return (
    <>
      <PageHeader
        title={t("auth_admin:sessions.title")}
        description={t("auth_admin:sessions.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={sessions.reload}>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <Surface>
        {(applications.data ?? []).length > 0 && (
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <label className="flex items-center gap-2 text-[13px] text-neutral-400">
              {t("auth_admin:sessions.filter_application")}
              <select
                value={application}
                onChange={(event) => setParam("application", event.target.value)}
                className="h-9 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
              >
                <option value="">{t("admin:common.filter_all")}</option>
                {(applications.data ?? []).map((entry) => (
                  <option key={entry.client_id} value={entry.client_id}>
                    {entry.name}
                  </option>
                ))}
              </select>
            </label>
          </div>
        )}

        <SectionState
          resource={sessions}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<Monitor size={32}/>}
              title={t("auth_admin:sessions.empty")}
              description={t("auth_admin:sessions.empty_hint")}
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(session) => session.id}
            caption={t("auth_admin:sessions.title")}
          />
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            onChange={(next) => setParam("offset", next > 0 ? String(next) : "")}
          />
        </SectionState>
      </Surface>

      <ConfirmDialog
        open={revoking !== null}
        title={t("auth_admin:sessions.revoke")}
        body={t("auth_admin:sessions.revoke_body", {
          email: revoking?.user_email ?? "",
          application: revoking?.application_name ?? revoking?.application_id ?? "",
        })}
        confirmLabel={t("auth_admin:sessions.revoke")}
        pending={revoke.pending}
        error={revoke.error}
        onClose={() => {
          revoke.reset();
          setRevoking(null);
        }}
        onConfirm={async () => {
          if (!revoking) return;
          const result = await revoke.run(revoking.id);
          if (result.ok) {
            notify(t("auth_admin:sessions.revoked"));
            setRevoking(null);
            sessions.reload();
          }
        }}
      />
    </>
  );
};
