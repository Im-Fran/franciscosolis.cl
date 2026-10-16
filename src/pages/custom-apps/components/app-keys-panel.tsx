import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {ArrowsClockwise, Key, Plus, Prohibit} from "@phosphor-icons/react";
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
import type {AppKey} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {LifecycleBadge} from "@/pages/custom-apps/components/badges.tsx";
import {CopyField} from "@/pages/custom-apps/components/copy-button.tsx";

const LABEL_MAX = 80;

type PendingAction = {kind: "rotate" | "revoke"; key: AppKey};

/**
 * The keys a client app enrolls with.
 *
 * Unlike a client secret these are public by design — they ship inside the app — so every one is
 * shown in full and can be copied at any time. What matters is the lifecycle: revoking a key stops
 * *new* enrollments with it and nothing else, because each installation already enrolled holds its
 * own token. Rotating is the same thing with the replacement minted in the same step, which is what
 * a leaked build calls for.
 */
export const AppKeysPanel = ({appId}: {appId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const [creating, setCreating] = useState(false);
  const [label, setLabel] = useState("");
  const [pending, setPending] = useState<PendingAction | null>(null);

  const keys = useResource(useCallback((signal: AbortSignal) => customAppsApi.keys.list(appId, signal), [appId]));
  const create = useMutation(
    useCallback((value: string | null) => customAppsApi.keys.create(appId, {label: value}), [appId]),
  );
  const act = useMutation(
    useCallback(
      async (action: PendingAction) => {
        /* Both answer with the keys they touched; the list is reloaded either way, so neither is kept. */
        if (action.kind === "rotate") await customAppsApi.keys.rotate(appId, action.key.id);
        else await customAppsApi.keys.revoke(appId, action.key.id);
      },
      [appId],
    ),
  );

  /* Newest first, with the keys in force ahead of the revoked ones. */
  const rows = [...(keys.data ?? [])].sort(
    (a, b) =>
      Number(b.status === "active") - Number(a.status === "active") || b.created_at.localeCompare(a.created_at),
  );
  const activeCount = rows.filter((row) => row.status === "active").length;

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await create.run(orNull(label));
    if (!outcome.ok) return;
    notify(t("custom_apps:keys.created"));
    setCreating(false);
    setLabel("");
    keys.reload();
  };

  const confirm = async () => {
    if (!pending) return;
    const outcome = await act.run(pending);
    if (!outcome.ok) return;
    notify(pending.kind === "rotate" ? t("custom_apps:keys.rotated") : t("custom_apps:keys.revoked"));
    setPending(null);
    keys.reload();
  };

  return (
    <Panel
      title={t("custom_apps:keys.title")}
      description={t("custom_apps:keys.description")}
      action={
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            create.reset();
            setCreating(true);
          }}
        >
          <Plus size={14} /> {t("custom_apps:keys.create")}
        </Button>
      }
    >
      <PanelState loading={keys.loading && !keys.data} error={keys.error} onRetry={keys.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={<Key size={28} />} title={t("custom_apps:keys.empty")} />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((key) => (
              <li
                key={key.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-sm text-text">
                    {key.label || <span className="text-neutral-500">{t("custom_apps:keys.unlabelled")}</span>}
                    <LifecycleBadge status={key.status} />
                  </span>
                  {key.status === "active" && (
                    <span className="flex gap-1">
                      <Button variant="ghost" size="sm" onClick={() => setPending({kind: "rotate", key})}>
                        <ArrowsClockwise size={14} /> {t("custom_apps:keys.rotate")}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-neutral-400 hover:text-red-300"
                        onClick={() => setPending({kind: "revoke", key})}
                      >
                        <Prohibit size={14} /> {t("custom_apps:keys.revoke")}
                      </Button>
                    </span>
                  )}
                </div>

                <div className={key.status === "active" ? undefined : "opacity-60"}>
                  <CopyField value={key.key} label={key.label || t("custom_apps:keys.key")} />
                </div>

                <p className="flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-neutral-500">
                  <span>{t("custom_apps:keys.created_at", {date: formatDateTime(key.created_at, i18n.language)})}</span>
                  <span>
                    {key.last_used_at
                      ? t("custom_apps:keys.last_used", {when: formatLastSeen(key.last_used_at, i18n.language)})
                      : t("custom_apps:keys.never_used")}
                  </span>
                  {key.revoked_at && (
                    <span className="text-red-300/80">
                      {t("custom_apps:keys.revoked_at", {date: formatDateTime(key.revoked_at, i18n.language)})}
                    </span>
                  )}
                  {key.replaced_by && <span>{t("custom_apps:keys.replaced")}</span>}
                </p>
              </li>
            ))}
          </ul>
        )}

        {keys.data && activeCount === 0 && (
          <Alert tone="info" title={t("custom_apps:keys.none_active_title")} className="mt-4">
            {t("custom_apps:keys.none_active_body")}
          </Alert>
        )}
      </PanelState>

      <Modal
        open={creating}
        onClose={create.pending ? () => undefined : () => setCreating(false)}
        title={t("custom_apps:keys.create_title")}
        className="max-w-md"
      >
        <form onSubmit={submitCreate} className="flex flex-col gap-5" noValidate>
          <Field label={t("custom_apps:keys.label")} htmlFor="key-label" hint={t("custom_apps:keys.label_hint")}>
            <Input
              id="key-label"
              value={label}
              onChange={(event) => setLabel(event.target.value)}
              maxLength={LABEL_MAX}
              placeholder={t("custom_apps:keys.label_placeholder")}
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
              {create.pending ? <Spinner size={16} /> : <Key size={16} />}
              {t("custom_apps:keys.create")}
            </Button>
          </div>
        </form>
      </Modal>

      <ConfirmDialog
        open={pending !== null}
        title={pending?.kind === "rotate" ? t("custom_apps:keys.rotate_title") : t("custom_apps:keys.revoke_title")}
        body={
          pending?.kind === "rotate"
            ? t("custom_apps:keys.rotate_body", {key: pending.key.label || pending.key.key})
            : t("custom_apps:keys.revoke_body", {key: pending?.key.label || pending?.key.key || ""})
        }
        confirmLabel={pending?.kind === "rotate" ? t("custom_apps:keys.rotate") : t("custom_apps:keys.revoke")}
        pending={act.pending}
        error={act.error}
        onClose={() => {
          act.reset();
          setPending(null);
        }}
        onConfirm={() => void confirm()}
      />
    </Panel>
  );
};
