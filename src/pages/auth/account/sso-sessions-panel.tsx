import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, Browser, Trash} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {authApi} from "@/lib/auth/api.ts";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {SsoSession} from "@/lib/auth/types.ts";
import {Panel, PanelState} from "@/pages/auth/components/panel.tsx";

/**
 * The browsers this account is signed in to the *issuer* from, beside the sessions each application
 * holds.
 *
 * The distinction is the whole reason this list exists: one of these is a browser that can authorize
 * a new application without signing in again, so closing it is not the same as signing out of an
 * application, and neither list implies the other. Closing one here leaves every application that
 * browser already opened signed in — those are the rows above — and signing out of an application
 * leaves this one alone.
 *
 * No row can be flagged as the browser doing the looking: the service decides that from a cookie,
 * and this list is read with a bearer token, which no cookie rides along with. So the confirmation
 * says what closing costs rather than singling one row out.
 */
export const SsoSessionsPanel = () => {
  const {t, i18n} = useTranslation();
  const {notify} = useToast();
  const browsers = useResource(useCallback((signal: AbortSignal) => authApi.ssoSessions(signal), []));
  const revoke = useMutation(useCallback((id: string) => authApi.revokeSsoSession(id), []));
  const [revoking, setRevoking] = useState<SsoSession | null>(null);

  const rows = browsers.data ?? [];

  const confirm = async () => {
    if (!revoking) return;
    const result = await revoke.run(revoking.id);
    if (!result.ok) return;

    setRevoking(null);
    notify(t("auth:account.browsers.revoked"));
    browsers.reload();
  };

  return (
    <Panel
      title={t("auth:account.browsers.title")}
      description={t("auth:account.browsers.description")}
      action={
        <Button variant="ghost" size="sm" onClick={browsers.reload}>
          <ArrowClockwise size={14}/> {t("auth:common.refresh")}
        </Button>
      }
    >
      <PanelState
        loading={browsers.loading}
        error={browsers.error}
        empty={rows.length === 0}
        emptyLabel={t("auth:account.browsers.empty")}
        onRetry={browsers.reload}
      >
        <ul className="flex flex-col divide-y divide-neutral-800">
          {rows.map((browser) => (
            <li key={browser.id} className="flex flex-wrap items-center gap-4 py-4 first:pt-0 last:pb-0">
              <Browser size={20} className="shrink-0 text-neutral-500"/>

              <div className="min-w-0 flex-1">
                <p className="text-sm text-text">
                  {describeUserAgent(browser.user_agent) ?? t("auth:account.unknown_device")}
                </p>
                <p className="mt-1 text-[13px] text-neutral-500">
                  {[
                    t(`auth:providers.${browser.provider}`, {defaultValue: browser.provider}),
                    browser.ip,
                    [browser.city, browser.country].filter(Boolean).join(", "),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
                <p className="mt-0.5 text-xs text-neutral-600">
                  {[
                    t("auth:account.browsers.signed_in_at", {
                      value: formatDateTime(browser.authenticated_at, i18n.language),
                    }),
                    /* Absolute, so it is a date the person can plan around rather than a moving one. */
                    t("auth:account.browsers.expires_at", {
                      value: formatDateTime(browser.expires_at, i18n.language),
                    }),
                  ].join(" · ")}
                </p>
              </div>

              <Button variant="ghost" size="sm" onClick={() => setRevoking(browser)}>
                <Trash size={14}/> {t("auth:account.browsers.revoke")}
              </Button>
            </li>
          ))}
        </ul>
      </PanelState>

      <ConfirmDialog
        open={revoking !== null}
        title={t("auth:account.browsers.revoke")}
        body={t("auth:account.browsers.revoke_body", {
          device: describeUserAgent(revoking?.user_agent) ?? t("auth:account.unknown_device"),
        })}
        confirmLabel={t("auth:account.browsers.revoke")}
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
