import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, Desktop, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {authApi} from "@/lib/auth/api.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {Session} from "@/lib/auth/types.ts";
import {Panel, PanelState} from "@/pages/auth/components/panel.tsx";

/**
 * Every live session of the account, with the one in use flagged and each revocable on its own.
 *
 * Revoking is confirmed rather than immediate, because one of these rows is the browser doing the
 * revoking: ending that one is a sign-out, and a misplaced click should not be the way it happens.
 */
export const SessionsPanel = () => {
  const {t, i18n} = useTranslation();
  const {signOut} = useAuth();
  const {notify} = useToast();
  const sessions = useResource(useCallback((signal: AbortSignal) => authApi.sessions(signal), []));
  const revoke = useMutation(useCallback((id: string) => authApi.revokeSession(id), []));
  const [revoking, setRevoking] = useState<Session | null>(null);

  const active = sessions.data?.filter((session) => !session.revoked_at) ?? [];

  const confirm = async () => {
    if (!revoking) return;
    const result = await revoke.run(revoking.id);
    if (!result.ok) return;

    setRevoking(null);
    /* Revoking the session in use is a sign-out — the tokens on this device are dead either way. */
    if (revoking.current) {
      await signOut();
      return;
    }
    notify(t("auth:account.revoked"));
    sessions.reload();
  };

  return (
    <Panel
      title={t("auth:account.sessions_title")}
      description={t("auth:account.sessions_description")}
      action={
        <Button variant="ghost" size="sm" onClick={sessions.reload} data-fs-hover>
          <ArrowClockwise size={14}/> {t("auth:common.refresh")}
        </Button>
      }
    >
      <PanelState
        loading={sessions.loading}
        error={sessions.error}
        empty={active.length === 0}
        emptyLabel={t("auth:account.sessions_empty")}
        onRetry={sessions.reload}
      >
        <ul className="flex flex-col divide-y divide-neutral-800">
          {active.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
              <Desktop size={20} className="shrink-0 text-neutral-500"/>

              <div className="min-w-0 flex-1">
                <p className="flex flex-wrap items-center gap-2 text-sm text-text">
                  {describeUserAgent(session.user_agent) ?? t("auth:account.unknown_device")}
                  {session.current && <Badge variant="accent" size="sm">{t("auth:account.current_session")}</Badge>}
                </p>
                <p className="mt-1 text-[13px] text-neutral-500">
                  {[
                    session.application_id,
                    t(`auth:providers.${session.provider}`, {defaultValue: session.provider}),
                    session.ip,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {t("auth:account.last_seen", {value: formatDateTime(session.last_seen_at, i18n.language)})}
                </p>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setRevoking(session)} data-fs-hover>
                <Trash size={14}/>
                {session.current ? t("auth:account.sign_out_here") : t("auth:account.revoke")}
              </Button>
            </li>
          ))}
        </ul>
      </PanelState>

      <ConfirmDialog
        open={revoking !== null}
        title={revoking?.current ? t("auth:account.sign_out_here") : t("auth:account.revoke")}
        body={
          revoking?.current
            ? t("auth:account.revoke_current_body")
            : t("auth:account.revoke_body", {
                device: describeUserAgent(revoking?.user_agent) ?? t("auth:account.unknown_device"),
              })
        }
        confirmLabel={revoking?.current ? t("auth:account.sign_out_here") : t("auth:account.revoke")}
        pending={revoke.pending}
        error={revoke.error}
        onClose={() => {
          revoke.reset();
          setRevoking(null);
        }}
        onConfirm={confirm}
      />
    </Panel>
  );
};
