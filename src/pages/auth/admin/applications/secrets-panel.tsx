import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowsClockwise, Copy, Key, Plus, Trash, Warning} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {ApplicationSecret} from "@/lib/auth/types.ts";
import {SectionState} from "@/pages/auth/admin/components/section.tsx";

/** A week, which is also the API's own default grace period when a rotation retires the old ones. */
const DEFAULT_GRACE_DAYS = 7;

const stateOf = (secret: ApplicationSecret): string => {
  if (secret.revoked_at) return "revoked";
  if (!secret.active) return "expired";
  if (secret.expires_at) return "expiring";
  return "active";
};

/**
 * The secrets of a confidential client.
 *
 * Only a hash is stored, so nothing here can be turned back into a usable value: the list shows a
 * hint, a label and — the field that actually matters before revoking one — when it was last used.
 * A new secret is shown exactly once, in the dialog that issued it.
 *
 * Several can be valid at once, which is the point of rotating rather than replacing: the old one
 * gets a deadline instead of dying, so every deployment of the client has a window to pick the new
 * value up. A leak is the case for ending them immediately, and that is what the grace of zero is.
 */
export const SecretsPanel = ({clientId, confidential}: {clientId: string; confidential: boolean}) => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const {notify} = useToast();

  /* A public client can hold no secret, so there is nothing to ask the service for. */
  const secrets = useResource(
    useCallback(
      (signal: AbortSignal) =>
        confidential ? authApi.admin.secrets(clientId, signal) : Promise.resolve([] as ApplicationSecret[]),
      [clientId, confidential],
    ),
  );
  const issue = useMutation(
    useCallback(
      (options: {label: string | null; rotate: boolean; graceDays: number}) =>
        authApi.admin.issueSecret(clientId, {
          label: options.label,
          rotate: options.rotate,
          grace_seconds: options.rotate ? options.graceDays * 86_400 : undefined,
        }),
      [clientId],
    ),
  );
  const revoke = useMutation(
    useCallback((secretId: string) => authApi.admin.revokeSecret(clientId, secretId), [clientId]),
  );

  const [issuing, setIssuing] = useState(false);
  const [draft, setDraft] = useState({label: "", rotate: true, graceDays: String(DEFAULT_GRACE_DAYS)});
  const [issued, setIssued] = useState<string | null>(null);
  const [revoking, setRevoking] = useState<ApplicationSecret | null>(null);
  const [copied, setCopied] = useState(false);

  const rows = secrets.data ?? [];

  if (!confidential) {
    return (
      <Panel title={t("auth_admin:secrets.title")} description={t("auth_admin:secrets.description")}>
        <Alert tone="info" title={t("auth_admin:secrets.public_title")}>{t("auth_admin:secrets.public_body")}</Alert>
      </Panel>
    );
  }

  return (
    <Panel
      title={t("auth_admin:secrets.title")}
      description={t("auth_admin:secrets.description")}
      action={
        can("applications:write") ? (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => {
              issue.reset();
              setIssuing(true);
            }}
            data-fs-hover
          >
            <Plus size={14}/> {t("auth_admin:secrets.issue")}
          </Button>
        ) : undefined
      }
    >
      <SectionState
        resource={secrets}
        isEmpty={rows.length === 0}
        empty={<p className="py-2 text-sm text-neutral-500">{t("auth_admin:secrets.empty")}</p>}
      >
        <ul className="flex flex-col divide-y divide-neutral-800">
          {rows.map((secret) => (
            <li key={secret.id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
              <code className="rounded-[var(--radius-sm)] bg-neutral-800/60 px-2 py-1 text-[12px] text-neutral-300">
                {secret.hint}…
              </code>
              <span className="min-w-0">
                <span className="block truncate text-neutral-300">{secret.label || t("auth_admin:secrets.unlabelled")}</span>
                <span className="block truncate text-[12px] text-neutral-600">
                  {secret.last_used_at
                    ? t("auth_admin:secrets.last_used", {value: formatDateTime(secret.last_used_at, i18n.language)})
                    : t("auth_admin:secrets.never_used")}
                  {secret.expires_at
                    ? ` · ${t("auth_admin:secrets.expires", {value: formatDateTime(secret.expires_at, i18n.language)})}`
                    : ""}
                </span>
              </span>
              <span className="ml-auto flex items-center gap-2">
                <StatusBadge status={stateOf(secret)}/>
                {can("applications:write") && !secret.revoked_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-red-300 fs-ripple-danger"
                    onClick={() => setRevoking(secret)}
                    aria-label={t("auth_admin:secrets.revoke")}
                    data-fs-hover
                  >
                    <Trash size={14}/>
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      </SectionState>

      <Modal
        open={issuing}
        onClose={() => (issue.pending ? undefined : setIssuing(false))}
        title={t("auth_admin:secrets.issue")}
        className="max-w-lg"
      >
        <form
          className="flex flex-col gap-5"
          onSubmit={async (event) => {
            event.preventDefault();
            const result = await issue.run({
              label: draft.label.trim() || null,
              rotate: draft.rotate,
              graceDays: Number(draft.graceDays) || 0,
            });
            if (!result.ok) return;
            setIssued(result.data.client_secret);
            setCopied(false);
            setIssuing(false);
            setDraft({label: "", rotate: true, graceDays: String(DEFAULT_GRACE_DAYS)});
            secrets.reload();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("auth_admin:secrets.label_label")}</span>
            <Input
              value={draft.label}
              onChange={(event) => setDraft((current) => ({...current, label: event.target.value}))}
              placeholder={t("auth_admin:secrets.label_placeholder")}
              maxLength={120}
              autoFocus
            />
            <span className="text-[12px] text-neutral-600">{t("auth_admin:secrets.label_hint")}</span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={draft.rotate}
              onChange={(event) => setDraft((current) => ({...current, rotate: event.target.checked}))}
              className="mt-1"
            />
            <span>
              <span className="block text-[13px] text-neutral-300">{t("auth_admin:secrets.rotate_label")}</span>
              <span className="block text-[12px] leading-relaxed text-neutral-600">
                {t("auth_admin:secrets.rotate_hint")}
              </span>
            </span>
          </label>

          {draft.rotate && (
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] text-neutral-400">{t("auth_admin:secrets.grace_label")}</span>
              <Input
                type="number"
                min={0}
                max={90}
                value={draft.graceDays}
                onChange={(event) => setDraft((current) => ({...current, graceDays: event.target.value}))}
              />
              <span className="text-[12px] text-neutral-600">
                {Number(draft.graceDays) === 0
                  ? t("auth_admin:secrets.grace_zero")
                  : t("auth_admin:secrets.grace_hint")}
              </span>
            </label>
          )}

          {issue.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${issue.error}`, {defaultValue: issue.error})}
            </Alert>
          )}

          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setIssuing(false)} disabled={issue.pending} data-fs-hover>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={issue.pending} data-fs-hover>
              {issue.pending ? <Spinner size={16}/> : draft.rotate ? <ArrowsClockwise size={16}/> : <Key size={16}/>}
              {t("auth_admin:secrets.issue")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* The one time this value is readable. Closing the dialog is the end of it. */}
      <Modal
        open={issued !== null}
        onClose={() => setIssued(null)}
        title={t("auth_admin:secrets.issued_title")}
        className="max-w-lg"
      >
        <div className="flex flex-col gap-5">
          <Alert tone="info" title={t("auth_admin:secrets.issued_once_title")}>
            {t("auth_admin:secrets.issued_once_body")}
          </Alert>

          <code className="block rounded-[var(--radius-md)] border border-neutral-700 bg-neutral-900 px-3 py-2.5 text-[13px] break-all text-neutral-200">
            {issued}
          </code>

          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="secondary"
              onClick={async () => {
                if (!issued) return;
                try {
                  await navigator.clipboard.writeText(issued);
                  setCopied(true);
                  notify(t("admin:common.copied"));
                } catch {
                  /* A denied clipboard is not a failure worth a dialog: the value is on screen. */
                  notify(t("auth_admin:secrets.copy_failed"), "info");
                }
              }}
              data-fs-hover
            >
              <Copy size={16}/> {copied ? t("admin:common.copied") : t("admin:common.copy")}
            </Button>
            <Button onClick={() => setIssued(null)} data-fs-hover>
              {t("auth_admin:secrets.issued_done")}
            </Button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        title={t("auth_admin:secrets.revoke")}
        body={t("auth_admin:secrets.revoke_body", {hint: revoking?.hint ?? ""})}
        confirmLabel={t("auth_admin:secrets.revoke")}
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
            notify(t("auth_admin:secrets.revoked"));
            setRevoking(null);
            secrets.reload();
          }
        }}
      />

      {rows.some((secret) => !secret.revoked_at && secret.active) ? null : (
        <p className="mt-4 flex items-center gap-2 text-[13px] text-amber-300">
          <Warning size={14}/> {t("auth_admin:secrets.none_active")}
        </p>
      )}
    </Panel>
  );
};
