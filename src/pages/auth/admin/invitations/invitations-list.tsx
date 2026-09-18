import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, EnvelopeSimple, PaperPlaneTilt, Plus, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {loginUrl} from "@/lib/auth/config.ts";
import {formatDate, looksLikeEmail} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Invitation, NewInvitation} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

const FILTERS = ["all", "pending", "accepted", "expired", "revoked"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Sign-up is invitation-only, so this list is the service's allowlist: an address that is not on it
 * cannot create an account through either provider.
 *
 * An invitation carries no secret — it is consumed the first time the address completes a sign-in,
 * whichever link it used — which is why "resend" here really does just send the same message again
 * rather than minting a new one.
 */
export const InvitationsList = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const {notify} = useToast();

  const invitations = useResource(useCallback((signal: AbortSignal) => authApi.admin.invitations(signal), []));
  const applications = useResource(
    useCallback(
      (signal: AbortSignal) => (can("applications:read") ? authApi.admin.applications(signal) : Promise.resolve([])),
      [can],
    ),
  );
  const roles = useResource(
    useCallback((signal: AbortSignal) => (can("roles:read") ? authApi.admin.roles(signal) : Promise.resolve([])), [can]),
  );

  const create = useMutation(useCallback((invitation: NewInvitation) => authApi.admin.createInvitation(invitation), []));
  const resend = useMutation(useCallback((id: string) => authApi.admin.resendInvitation(id), []));
  const revoke = useMutation(useCallback((id: string) => authApi.admin.revokeInvitation(id), []));

  const [filter, setFilter] = useState<Filter>("all");
  const [composing, setComposing] = useState(false);
  const [draft, setDraft] = useState({email: "", application_id: "", role_id: "", expires_in_days: ""});
  const [revoking, setRevoking] = useState<Invitation | null>(null);

  const applicationName = useCallback(
    (id: string | null | undefined) =>
      id ? ((applications.data ?? []).find((entry) => entry.client_id === id)?.name ?? id) : t("auth_admin:invitations.global"),
    [applications.data, t],
  );

  const rows = useMemo(
    () => (invitations.data ?? []).filter((invitation) => filter === "all" || invitation.status === filter),
    [invitations.data, filter],
  );

  const columns = useMemo<Column<Invitation>[]>(
    () => [
      {
        key: "email",
        header: t("auth_admin:invitations.column_email"),
        cell: (invitation) => <span className="text-text">{invitation.email}</span>,
      },
      {
        key: "status",
        header: t("auth_admin:invitations.column_status"),
        className: "w-32",
        cell: (invitation) => <StatusBadge status={invitation.status}/>,
      },
      {
        key: "application",
        header: t("auth_admin:invitations.column_application"),
        className: "w-56",
        hideBelowLg: true,
        cell: (invitation) => applicationName(invitation.application_id),
      },
      {
        key: "expires",
        header: t("auth_admin:invitations.column_expires"),
        className: "w-40",
        hideBelowLg: true,
        cell: (invitation) => formatDate(invitation.expires_at, i18n.language) ?? t("admin:common.none"),
      },
      {
        key: "actions",
        header: <span className="sr-only">{t("auth_admin:invitations.actions")}</span>,
        className: "w-44 text-right",
        cell: (invitation) =>
          can("invitations:write") && invitation.status === "pending" ? (
            <span className="flex justify-end gap-1">
              <Button
                variant="ghost"
                size="sm"
                disabled={resend.pending}
                onClick={async () => {
                  const result = await resend.run(invitation.id);
                  if (result.ok) notify(t("auth_admin:invitations.resent", {email: invitation.email}));
                  else notify(t(`admin:errors.${result.error}`, {defaultValue: result.error}), "error");
                }}
                data-fs-hover
              >
                <PaperPlaneTilt size={14}/> {t("auth_admin:invitations.resend")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="text-red-300 fs-ripple-danger"
                onClick={() => setRevoking(invitation)}
                aria-label={t("auth_admin:invitations.revoke")}
                data-fs-hover
              >
                <Trash size={14}/>
              </Button>
            </span>
          ) : null,
      },
    ],
    [t, i18n.language, applicationName, can, resend, notify],
  );

  const emailValid = looksLikeEmail(draft.email.trim());

  const submit = async () => {
    const invitation: NewInvitation = {
      email: draft.email.trim(),
      application_id: draft.application_id || null,
      role_id: draft.role_id || null,
      /*
       * The service falls back to the origin of the application's first redirect URI, which is
       * right for a client with a sign-in page of its own. A global invitation has no application
       * to derive one from, so this site's own sign-in stands in.
       */
      login_url: draft.application_id ? undefined : loginUrl(),
    };
    if (draft.expires_in_days) invitation.expires_in_days = Number(draft.expires_in_days);

    const result = await create.run(invitation);
    if (!result.ok) return;

    notify(
      result.data.emailed === false
        ? t("auth_admin:invitations.created_unsent", {email: invitation.email})
        : t("auth_admin:invitations.created", {email: invitation.email}),
      result.data.emailed === false ? "info" : "success",
    );
    setComposing(false);
    setDraft({email: "", application_id: "", role_id: "", expires_in_days: ""});
    invitations.reload();
  };

  return (
    <>
      <PageHeader
        title={t("auth_admin:invitations.title")}
        description={t("auth_admin:invitations.description")}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={invitations.reload} data-fs-hover>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            {can("invitations:write") && (
              <Button size="sm" onClick={() => setComposing(true)} data-fs-hover>
                <Plus size={14}/> {t("auth_admin:invitations.invite")}
              </Button>
            )}
          </>
        }
      />

      <Surface>
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((name) => (
            <button
              key={name}
              type="button"
              onClick={() => setFilter(name)}
              aria-pressed={filter === name}
              className={`cursor-pointer rounded-[var(--radius-md)] border px-3 py-1.5 text-[13px] transition-colors ${
                filter === name
                  ? "border-accent bg-accent-900/40 text-accent-200"
                  : "border-neutral-800 text-neutral-400 hover:border-neutral-700 hover:text-text"
              }`}
              data-fs-hover
            >
              {name === "all" ? t("admin:common.filter_all") : t(`admin:status.${name}`, {defaultValue: name})}
            </button>
          ))}
        </div>

        <SectionState
          resource={invitations}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<EnvelopeSimple size={32}/>}
              title={filter === "all" ? t("auth_admin:invitations.empty") : t("auth_admin:invitations.no_matches")}
              description={t("auth_admin:invitations.empty_hint")}
              action={
                can("invitations:write") && filter === "all" ? (
                  <Button size="sm" onClick={() => setComposing(true)} data-fs-hover>
                    <Plus size={14}/> {t("auth_admin:invitations.invite")}
                  </Button>
                ) : undefined
              }
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(invitation) => invitation.id}
            caption={t("auth_admin:invitations.title")}
          />
        </SectionState>
      </Surface>

      <Modal
        open={composing}
        onClose={() => (create.pending ? undefined : setComposing(false))}
        title={t("auth_admin:invitations.invite")}
        className="max-w-lg"
      >
        <form
          className="flex flex-col gap-5"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void submit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:invitations.email_label")}</span>
            <Input
              type="email"
              value={draft.email}
              onChange={(event) => setDraft((current) => ({...current, email: event.target.value}))}
              placeholder="name@example.com"
              autoFocus
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:invitations.application_label")}</span>
            <select
              value={draft.application_id}
              onChange={(event) => setDraft((current) => ({...current, application_id: event.target.value}))}
              className="h-9 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
            >
              <option value="">{t("auth_admin:invitations.any_application")}</option>
              {(applications.data ?? []).map((application) => (
                <option key={application.client_id} value={application.client_id}>
                  {application.name}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-neutral-600">{t("auth_admin:invitations.application_hint")}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:invitations.role_label")}</span>
            <select
              value={draft.role_id}
              onChange={(event) => setDraft((current) => ({...current, role_id: event.target.value}))}
              className="h-9 rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-300"
            >
              <option value="">{t("auth_admin:invitations.default_role")}</option>
              {(roles.data ?? []).map((role) => (
                <option key={role.id} value={role.id}>
                  {role.name || role.slug}
                  {role.application_id ? ` · ${role.application_id}` : ""}
                </option>
              ))}
            </select>
            <span className="text-[12px] text-neutral-600">{t("auth_admin:invitations.role_hint")}</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:invitations.expiry_label")}</span>
            <Input
              type="number"
              min={1}
              max={90}
              value={draft.expires_in_days}
              onChange={(event) => setDraft((current) => ({...current, expires_in_days: event.target.value}))}
              placeholder="7"
            />
          </label>

          {create.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${create.error}`, {defaultValue: create.error})}
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setComposing(false)} disabled={create.pending} data-fs-hover>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={!emailValid || create.pending} data-fs-hover>
              {create.pending ? <Spinner size={16}/> : <EnvelopeSimple size={16}/>}
              {t("auth_admin:invitations.send")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        title={t("auth_admin:invitations.revoke")}
        body={t("auth_admin:invitations.revoke_body", {email: revoking?.email ?? ""})}
        confirmLabel={t("auth_admin:invitations.revoke")}
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
            notify(t("auth_admin:invitations.revoked", {email: revoking.email}));
            setRevoking(null);
            invitations.reload();
          }
        }}
      />
    </>
  );
};
