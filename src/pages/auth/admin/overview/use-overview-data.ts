import {useCallback} from "react";
import {authApi} from "@/lib/auth/api.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Application, ApplicationSecret, AuditEntry, Invitation} from "@/lib/auth/types.ts";

/** An invitation this close to its expiry is worth mentioning before it lapses unnoticed. */
const EXPIRING_SOON_DAYS = 3;
/** Same idea for a client secret, but a deployment has to be updated, which takes longer. */
const SECRET_EXPIRING_SOON_DAYS = 14;

const withinDays = (value: string | null | undefined, days: number) => {
  if (!value) return false;
  const at = Date.parse(value);
  if (Number.isNaN(at)) return false;
  return at > Date.now() && at - Date.now() <= days * 86_400_000;
};

export type Attention =
  | {kind: "invitations_expiring"; count: number}
  | {kind: "invitations_expired"; count: number}
  | {kind: "applications_inactive"; count: number}
  | {kind: "secrets_expiring"; count: number}
  | {kind: "secrets_missing"; clients: string[]};

/**
 * Everything the overview reads, with each call skipped when the account cannot make it.
 *
 * Each section is loaded on its own rather than through one combined request: the console's
 * permissions are per resource, so an account that may read users and not applications should get
 * the half it is allowed to see instead of an empty screen.
 */
export const useOverviewData = () => {
  const {can} = useAdmin();

  const invitations = useResource(
    useCallback(
      (signal: AbortSignal) =>
        can("invitations:read") ? authApi.admin.invitations(signal) : Promise.resolve([] as Invitation[]),
      [can],
    ),
  );

  const applications = useResource(
    useCallback(
      (signal: AbortSignal) =>
        can("applications:read") ? authApi.admin.applications(signal) : Promise.resolve([] as Application[]),
      [can],
    ),
  );

  /*
   * One request per confidential client. There are a handful of them — every front-end on this
   * origin is a public client — and the answer is the only way to know whether a client is about
   * to lose the secret it authenticates with, which is the failure this screen exists to catch.
   */
  const secrets = useResource(
    useCallback(
      async (signal: AbortSignal) => {
        if (!can("applications:read")) return [] as {clientId: string; secrets: ApplicationSecret[]}[];
        const clients = (await authApi.admin.applications(signal)).filter(
          (application) => application.confidential && application.is_active !== false,
        );
        return Promise.all(
          clients.map(async (client) => ({
            clientId: client.name || client.client_id,
            secrets: await authApi.admin.secrets(client.client_id, signal),
          })),
        );
      },
      [can],
    ),
  );

  const activity = useResource(
    useCallback(
      (signal: AbortSignal) =>
        can("audit:read") ? authApi.admin.audit({limit: 8}, signal) : Promise.resolve([] as AuditEntry[]),
      [can],
    ),
  );

  const pending = (invitations.data ?? []).filter((invitation) => invitation.status === "pending");
  const live = (secrets.data ?? []).map((entry) => ({
    ...entry,
    active: entry.secrets.filter((secret) => secret.active && !secret.revoked_at),
  }));

  const candidates: Attention[] = [
    {
      kind: "invitations_expiring" as const,
      count: pending.filter((invitation) => withinDays(invitation.expires_at, EXPIRING_SOON_DAYS)).length,
    },
    {
      kind: "invitations_expired" as const,
      count: (invitations.data ?? []).filter((invitation) => invitation.status === "expired").length,
    },
    {
      kind: "applications_inactive" as const,
      count: (applications.data ?? []).filter((application) => application.is_active === false).length,
    },
    {
      kind: "secrets_expiring" as const,
      count: live.filter((entry) =>
        entry.active.some((secret) => withinDays(secret.expires_at, SECRET_EXPIRING_SOON_DAYS)),
      ).length,
    },
    {kind: "secrets_missing" as const, clients: live.filter((entry) => entry.active.length === 0).map((entry) => entry.clientId)},
  ];

  const attention = candidates.filter((item) =>
    item.kind === "secrets_missing" ? item.clients.length > 0 : item.count > 0,
  );

  return {invitations, applications, secrets, activity, attention, pending};
};
