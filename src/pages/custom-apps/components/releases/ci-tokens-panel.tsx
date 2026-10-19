import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Plus, Prohibit, Terminal} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {orNull} from "@/lib/admin/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {CiToken, NewCiToken} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {LifecycleBadge} from "@/pages/custom-apps/components/badges.tsx";
import {CopyField} from "@/pages/custom-apps/components/copy-button.tsx";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";

const LABEL_MAX = 120;

/**
 * The tokens CI uploads releases with, one app each.
 *
 * Unlike an app key, a CI token is a secret: the service keeps its hash and the first characters,
 * so the token is shown exactly once — in the dialog that follows creating it — and the list only
 * ever shows its prefix afterwards. Losing one means revoking it and creating another. Revoking
 * stops the next upload; the releases it already uploaded stay as they are.
 */
export const CiTokensPanel = ({appId}: {appId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {notify} = useToast();
  const language = i18n.language;
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [created, setCreated] = useState<NewCiToken | null>(null);
  const [revoking, setRevoking] = useState<CiToken | null>(null);

  const tokens = useResource(useCallback((signal: AbortSignal) => customAppsApi.ciTokens.list(appId, signal), [appId]));
  const create = useMutation(
    useCallback((value: string | null) => customAppsApi.ciTokens.create(appId, {label: value}), [appId]),
  );
  const revoke = useMutation(useCallback((id: string) => customAppsApi.ciTokens.revoke(id), []));

  /* The tokens in force first, newest first within each half. */
  const rows = [...(tokens.data ?? [])].sort(
    (a, b) => Number(!b.revoked_at) - Number(!a.revoked_at) || b.created_at.localeCompare(a.created_at),
  );

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await create.run(orNull(label));
    if (!outcome.ok) return;
    setCreating(false);
    setLabel("");
    setCreated(outcome.data);
    tokens.reload();
  };

  const confirmRevoke = async () => {
    if (!revoking) return;
    const outcome = await revoke.run(revoking.id);
    if (!outcome.ok) return;
    notify(t("custom_apps:ci_tokens.revoked"));
    setRevoking(null);
    tokens.reload();
  };

  return (
    <Panel
      title={t("custom_apps:ci_tokens.title")}
      description={t("custom_apps:ci_tokens.description")}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            create.reset();
            setCreating(true);
          }}
        >
          <Plus size={14} /> {t("custom_apps:ci_tokens.create")}
        </Button>
      }
    >
      <PanelState loading={tokens.loading && !tokens.data} error={tokens.error} onRetry={tokens.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Terminal size={28} />}
            title={t("custom_apps:ci_tokens.empty")}
            description={t("custom_apps:ci_tokens.empty_description")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((token) => (
              <li
                key={token.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3"
              >
                <div className={token.revoked_at ? "min-w-0 opacity-70" : "min-w-0"}>
                  <p className="flex flex-wrap items-center gap-2 text-sm text-text">
                    {token.label || <span className="text-neutral-500">{t("custom_apps:ci_tokens.unlabelled")}</span>}
                    <LifecycleBadge status={token.revoked_at ? "revoked" : "active"} />
                  </p>
                  <p className="mt-1 font-mono text-[12.5px] text-neutral-400">{token.token_prefix}…</p>
                  <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-500">
                    <span>
                      {t("custom_apps:ci_tokens.created_at", {date: formatDateTime(token.created_at, language)})}
                      {token.created_by && ` · ${token.created_by}`}
                    </span>
                    <span>
                      {token.last_used_at
                        ? t("custom_apps:ci_tokens.last_used", {when: formatLastSeen(token.last_used_at, language)})
                        : t("custom_apps:ci_tokens.never_used")}
                    </span>
                    {token.revoked_at && (
                      <span className="text-red-300/80">
                        {t("custom_apps:ci_tokens.revoked_at", {date: formatDateTime(token.revoked_at, language)})}
                        {token.revoked_by && ` · ${token.revoked_by}`}
                      </span>
                    )}
                  </p>
                </div>
                {!token.revoked_at && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-neutral-400 hover:text-red-300"
                    onClick={() => {
                      revoke.reset();
                      setRevoking(token);
                    }}
                  >
                    <Prohibit size={14} /> {t("custom_apps:ci_tokens.revoke")}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        )}
      </PanelState>

      <Modal
        open={creating}
        onClose={create.pending ? () => undefined : () => setCreating(false)}
        title={t("custom_apps:ci_tokens.create_title")}
        className="max-w-md"
        help={help.form("ci_tokens.form_help")}
      >
        <form onSubmit={submitCreate} className="flex flex-col gap-5" noValidate>
          <Field
            label={t("custom_apps:ci_tokens.label")}
            htmlFor="ci-token-label"
            hint={t("custom_apps:ci_tokens.label_hint")}
            help={help.field("ci_tokens.help.label")}
          >
            <Input
              id="ci-token-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={LABEL_MAX}
              placeholder={t("custom_apps:ci_tokens.label_placeholder")}
              autoComplete="off"
            />
          </Field>
          {create.error && (
            <Alert tone="error" title={t("admin:common.failed")}>
              {t(`admin:errors.${create.error}`, {defaultValue: create.error})}
            </Alert>
          )}
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setCreating(false)} disabled={create.pending}>
              {t("admin:common.cancel")}
            </Button>
            <Button type="submit" disabled={create.pending}>
              {create.pending ? <Spinner size={16} /> : <Terminal size={16} />}
              {t("custom_apps:ci_tokens.create")}
            </Button>
          </div>
        </form>
      </Modal>

      {/* Closing this dialog is the last time the token exists anywhere but where it was pasted. */}
      <Modal open={created !== null} onClose={() => setCreated(null)} title={t("custom_apps:ci_tokens.created_title")} className="max-w-lg">
        {created && (
          <div className="flex flex-col gap-5">
            <Alert tone="info" title={t("custom_apps:ci_tokens.once_title")}>
              {t("custom_apps:ci_tokens.once_body")}
            </Alert>
            <CopyField value={created.token} label={created.label || t("custom_apps:ci_tokens.token")} />
            <p className="text-[12px] leading-relaxed text-neutral-500">{t("custom_apps:ci_tokens.created_hint")}</p>
            <div className="flex justify-end">
              <Button onClick={() => setCreated(null)}>{t("custom_apps:ci_tokens.done")}</Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={revoking !== null}
        title={t("custom_apps:ci_tokens.revoke_title")}
        body={t("custom_apps:ci_tokens.revoke_body", {token: revoking?.label || `${revoking?.token_prefix ?? ""}…`})}
        confirmLabel={revoke.pending ? t("custom_apps:ci_tokens.revoking") : t("custom_apps:ci_tokens.revoke")}
        pending={revoke.pending}
        error={revoke.error}
        onClose={() => setRevoking(null)}
        onConfirm={() => void confirmRevoke()}
      />
    </Panel>
  );
};
