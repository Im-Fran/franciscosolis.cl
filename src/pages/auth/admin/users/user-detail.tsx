import {useCallback, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {
  ArrowClockwise,
  CheckCircle,
  ImageSquare,
  Prohibit,
  SignOut,
  Trash,
  WarningCircle,
} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {AdminSession, Role} from "@/lib/auth/types.ts";
import {SectionState} from "@/pages/auth/admin/components/section.tsx";

const Field = ({label, children}: {label: string; children: ReactNode}) => (
  <div className="flex flex-col gap-1">
    <dt className="text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{label}</dt>
    <dd className="text-sm break-words text-neutral-300">{children}</dd>
  </div>
);

/**
 * One account, and everything that can be done to it.
 *
 * Nothing here is a profile editor: names and pictures belong to the person, are refreshed from
 * whichever provider authenticated them, and the API offers no way for an administrator to
 * overwrite them. What an administrator decides is access — the status, the roles and which
 * sessions stay open — so those are the only controls.
 */
export const UserDetail = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {id = ""} = useParams();
  const {can} = useAdmin();
  const {notify} = useToast();

  const detail = useResource(useCallback((signal: AbortSignal) => authApi.admin.user(id, signal), [id]));
  const roles = useResource(
    useCallback((signal: AbortSignal) => (can("roles:read") ? authApi.admin.roles(signal) : Promise.resolve([])), [can]),
  );
  const sessions = useResource(
    useCallback(
      (signal: AbortSignal) =>
        can("sessions:read")
          ? authApi.admin.userSessions(id, {include_revoked: false}, signal)
          : Promise.resolve([] as AdminSession[]),
      [id, can],
    ),
  );

  const setStatus = useMutation(
    useCallback((status: "active" | "disabled") => authApi.admin.updateUser(id, {status}), [id]),
  );
  const grantRole = useMutation(useCallback((roleId: string) => authApi.admin.grantRole(id, roleId), [id]));
  const revokeRole = useMutation(useCallback((roleId: string) => authApi.admin.revokeRole(id, roleId), [id]));
  const revokeSession = useMutation(
    useCallback((sessionId: string) => authApi.admin.revokeUserSession(sessionId), []),
  );
  const revokeAll = useMutation(useCallback(() => authApi.admin.revokeUserSessions(id), [id]));

  const [grantChoice, setGrantChoice] = useState("");
  const [confirmSignOut, setConfirmSignOut] = useState(false);

  const user = detail.data?.user;
  /* Memoized because the grant list below derives from it and a fresh [] every render would churn. */
  const held = useMemo(() => detail.data?.roles ?? [], [detail.data]);
  const identities = detail.data?.identities ?? [];
  const live = (sessions.data ?? []).filter((session) => !session.revoked_at);

  const grantable = useMemo<Role[]>(
    () => (roles.data ?? []).filter((role) => !held.some((entry) => entry.id === role.id)),
    [roles.data, held],
  );

  const refresh = () => {
    detail.reload();
    sessions.reload();
  };

  const title = user?.name || user?.email || t("auth_admin:users.detail_title");

  return (
    <>
      <PageHeader
        title={title}
        description={user?.name ? user.email : undefined}
        back={{to: adminRoute.users, label: t("auth_admin:users.back")}}
        actions={
          <>
            {/*
             * The queue filtered to this account, rather than a review panel of its own: the
             * decision and everything it needs already live on one screen, and two places to make
             * it is two places to keep in step.
             */}
            {can("avatars:read") && id && (
              <Button variant="ghost" size="sm" asChild>
                <Link to={adminRoute.userAvatars(id)}>
                  <ImageSquare size={14}/> {t("auth_admin:users.review_avatars")}
                </Link>
              </Button>
            )}
            <Button variant="ghost" size="sm" onClick={refresh}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
          </>
        }
      />

      <SectionState resource={detail}>
        {user && (
          <div className="flex flex-col gap-6">
            <Panel title={t("auth_admin:users.account_title")} description={t("auth_admin:users.account_description")}>
              <div className="flex flex-col gap-6">
                <div className="flex flex-wrap items-center gap-4">
                  <Avatar name={user.name} email={user.email ?? ""} picture={user.picture} size={56}/>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-text">{user.name || user.email}</p>
                    <p className="truncate text-[13px] text-neutral-500">{user.email}</p>
                  </div>
                  {user.status === "disabled" ? (
                    <Badge variant="outline" size="sm">{t("auth_admin:status.disabled")}</Badge>
                  ) : (
                    <Badge variant="accent" size="sm">{t("auth_admin:status.active")}</Badge>
                  )}
                </div>

                {user.email_verified === false && (
                  <Alert tone="info" title={t("auth_admin:users.unverified")}>
                    {t("auth_admin:users.unverified_hint")}
                  </Alert>
                )}

                <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                  <Field label={t("auth_admin:users.field_id")}>
                    <code className="text-[12px] text-neutral-400">{user.id}</code>
                  </Field>
                  <Field label={t("auth_admin:users.field_locale")}>{user.locale || t("admin:common.none")}</Field>
                  <Field label={t("auth_admin:users.column_last_login")}>
                    {formatDateTime(user.last_login_at, i18n.language) ?? t("auth_admin:users.never")}
                  </Field>
                  <Field label={t("auth_admin:users.column_created")}>
                    {formatDateTime(user.created_at, i18n.language) ?? t("admin:common.none")}
                  </Field>
                  <Field label={t("auth_admin:users.field_updated")}>
                    {formatDateTime(user.updated_at, i18n.language) ?? t("admin:common.none")}
                  </Field>
                </dl>

                {can("users:write") && (
                  <div className="flex flex-wrap items-center gap-3 border-t border-neutral-800 pt-5">
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={setStatus.pending}
                      className={
                        user.status === "disabled" ? undefined : "border-red-500/50 text-red-300 fs-ripple-danger"
                      }
                      onClick={async () => {
                        const next = user.status === "disabled" ? "active" : "disabled";
                        const result = await setStatus.run(next);
                        if (result.ok) {
                          notify(t(next === "disabled" ? "auth_admin:users.disabled" : "auth_admin:users.enabled"));
                          refresh();
                        }
                      }}
                    >
                      {setStatus.pending ? <Spinner size={14}/> : user.status === "disabled" ? <CheckCircle size={16}/> : <Prohibit size={16}/>}
                      {user.status === "disabled" ? t("auth_admin:users.enable") : t("auth_admin:users.disable")}
                    </Button>
                    <p className="text-[13px] text-neutral-500">
                      {user.status === "disabled"
                        ? t("auth_admin:users.enable_hint")
                        : t("auth_admin:users.disable_hint")}
                    </p>
                  </div>
                )}

                {setStatus.error && (
                  <Alert tone="error" title={t("admin:common.failed")}>
                    {t(`admin:errors.${setStatus.error}`, {defaultValue: setStatus.error})}
                  </Alert>
                )}
              </div>
            </Panel>

            <Panel title={t("auth_admin:users.roles_title")} description={t("auth_admin:users.roles_description")}>
              <div className="flex flex-col gap-4">
                {held.length === 0 ? (
                  <p className="text-sm text-neutral-500">{t("auth_admin:users.roles_empty")}</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {held.map((role) => (
                      <li
                        key={role.id}
                        className="inline-flex items-center gap-2 rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 py-1 pr-1 pl-2.5 text-xs text-neutral-300"
                      >
                        <span>{role.name || role.slug}</span>
                        {role.application_id && (
                          <span className="text-neutral-500">{role.application_id}</span>
                        )}
                        {can("users:write") && (
                          <button
                            type="button"
                            aria-label={t("auth_admin:users.revoke_role", {role: role.name || role.slug})}
                            disabled={revokeRole.pending}
                            onClick={async () => {
                              const result = await revokeRole.run(role.id);
                              if (result.ok) {
                                notify(t("auth_admin:users.role_revoked"));
                                detail.reload();
                              }
                            }}
                            className="cursor-pointer rounded-[var(--radius-sm)] p-1 text-neutral-500 transition-colors hover:bg-neutral-700/60 hover:text-red-300"
                          >
                            <Trash size={12}/>
                          </button>
                        )}
                      </li>
                    ))}
                  </ul>
                )}

                {can("users:write") && grantable.length > 0 && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 pt-4">
                    <select
                      value={grantChoice}
                      onChange={(event) => setGrantChoice(event.target.value)}
                      aria-label={t("auth_admin:users.grant_role")}
                      className="h-9 min-w-56 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
                    >
                      <option value="">{t("auth_admin:users.grant_role")}</option>
                      {grantable.map((role) => (
                        <option key={role.id} value={role.id}>
                          {role.name || role.slug}
                          {role.application_id ? ` · ${role.application_id}` : ""}
                        </option>
                      ))}
                    </select>
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={!grantChoice || grantRole.pending}
                      onClick={async () => {
                        const result = await grantRole.run(grantChoice);
                        if (result.ok) {
                          notify(t("auth_admin:users.role_granted"));
                          setGrantChoice("");
                          detail.reload();
                        }
                      }}
                    >
                      {grantRole.pending ? <Spinner size={14}/> : null}
                      {t("auth_admin:users.grant")}
                    </Button>
                  </div>
                )}

                {/*
                  * Roles are minted into the access token, so a grant or a revocation reaches the
                  * holder's *own* interface only once their token is refreshed — up to its lifetime
                  * away. The API itself re-reads them per request and is unaffected.
                  */}
                <p className="text-[13px] leading-relaxed text-neutral-500">{t("auth_admin:users.roles_note")}</p>

                {(grantRole.error || revokeRole.error) && (
                  <Alert tone="error" title={t("admin:common.failed")}>
                    {t(`admin:errors.${grantRole.error ?? revokeRole.error}`, {
                      defaultValue: grantRole.error ?? revokeRole.error ?? "",
                    })}
                  </Alert>
                )}
              </div>
            </Panel>

            <Panel
              title={t("auth_admin:users.identities_title")}
              description={t("auth_admin:users.identities_description")}
            >
              {identities.length === 0 ? (
                <p className="text-sm text-neutral-500">{t("auth_admin:users.identities_empty")}</p>
              ) : (
                <ul className="flex flex-col divide-y divide-neutral-800">
                  {identities.map((identity) => (
                    <li key={identity.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                      <span className="text-text">
                        {t(`auth:providers.${identity.provider}`, {defaultValue: identity.provider})}
                      </span>
                      {identity.email && <span className="text-neutral-500">{identity.email}</span>}
                      <span className="ml-auto text-[13px] text-neutral-600">
                        {identity.last_used_at
                          ? t("auth_admin:users.last_used", {
                              value: formatDateTime(identity.last_used_at, i18n.language),
                            })
                          : t("auth_admin:users.never_used")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </Panel>

            {can("sessions:read") && (
              <Panel
                title={t("auth_admin:users.sessions_title")}
                description={t("auth_admin:users.sessions_description")}
                action={
                  can("sessions:revoke") && live.length > 0 ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-300 fs-ripple-danger"
                      onClick={() => setConfirmSignOut(true)}
                    >
                      <SignOut size={14}/> {t("auth_admin:users.revoke_sessions")}
                    </Button>
                  ) : undefined
                }
              >
                <SectionState resource={sessions} isEmpty={live.length === 0} empty={
                  <p className="py-2 text-sm text-neutral-500">{t("auth_admin:sessions.empty_user")}</p>
                }>
                  <ul className="flex flex-col divide-y divide-neutral-800">
                    {live.map((session) => (
                      <li key={session.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                        <span className="min-w-0">
                          <span className="block truncate text-text">
                            {session.application_name ?? session.application_id}
                          </span>
                          <span className="block truncate text-[12px] text-neutral-500">
                            {[describeUserAgent(session.user_agent), session.ip].filter(Boolean).join(" · ") ||
                              t("admin:common.none")}
                          </span>
                        </span>
                        <span className="ml-auto text-[13px] text-neutral-600">
                          {t("auth_admin:sessions.last_seen", {
                            value: formatDateTime(session.last_seen_at, i18n.language),
                          })}
                        </span>
                        {can("sessions:revoke") && (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={revokeSession.pending}
                            className="text-red-300 fs-ripple-danger"
                            onClick={async () => {
                              const result = await revokeSession.run(session.id);
                              if (result.ok) {
                                notify(t("auth_admin:sessions.revoked"));
                                sessions.reload();
                              }
                            }}
                          >
                            <SignOut size={14}/> {t("auth_admin:sessions.revoke")}
                          </Button>
                        )}
                      </li>
                    ))}
                  </ul>
                </SectionState>
              </Panel>
            )}
          </div>
        )}
      </SectionState>

      <ConfirmDialog
        open={confirmSignOut}
        title={t("auth_admin:users.revoke_sessions")}
        body={t("auth_admin:users.revoke_sessions_body", {email: user?.email ?? ""})}
        confirmLabel={t("auth_admin:users.revoke_sessions")}
        pending={revokeAll.pending}
        error={revokeAll.error}
        onClose={() => {
          revokeAll.reset();
          setConfirmSignOut(false);
        }}
        onConfirm={async () => {
          const result = await revokeAll.run();
          if (result.ok) {
            notify(t("auth_admin:users.sessions_revoked"));
            setConfirmSignOut(false);
            refresh();
          }
        }}
      />

      {detail.data && !user && (
        <Alert tone="error" title={t("admin:common.failed")}>
          <WarningCircle size={16}/> {t("admin:errors.not_found")}
        </Alert>
      )}
    </>
  );
};
