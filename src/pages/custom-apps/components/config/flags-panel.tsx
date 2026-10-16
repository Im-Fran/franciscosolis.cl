import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Flag as FlagIcon, PencilSimple, Plus, Trash} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {Flag} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {FlagFormModal} from "@/pages/custom-apps/components/config/flag-form-modal.tsx";
import type {FlagDraft} from "@/pages/custom-apps/components/config/flag-form-modal.tsx";
import {FlagValueView} from "@/pages/custom-apps/components/config/flag-value.tsx";
import {installationNames, useAppInstallations} from "@/pages/custom-apps/components/use-app-installations.ts";
import {scopeRank} from "@/pages/custom-apps/components/scope.ts";
import {ScopeLabel} from "@/pages/custom-apps/components/scope-fields.tsx";

/**
 * The app's feature flags, one group per key.
 *
 * A key can be set at three scopes, and for any one device the most specific wins: its own
 * installation, then its channel, then the app. Each group lists its rows in that order, least
 * specific first, so reading down a group is reading the precedence — the app's value, then what
 * overrides it.
 */
export const FlagsPanel = ({appId}: {appId: string}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const [draft, setDraft] = useState<FlagDraft | null>(null);
  const [deleting, setDeleting] = useState<Flag | null>(null);

  const flags = useResource(useCallback((signal: AbortSignal) => customAppsApi.flags.list(appId, signal), [appId]));
  const installations = useAppInstallations(appId);
  const names = useMemo(() => installationNames(installations.data?.data), [installations.data]);
  const remove = useMutation(useCallback((id: string) => customAppsApi.flags.remove(id), []));

  const groups = useMemo(() => {
    const byKey = new Map<string, Flag[]>();
    for (const flag of flags.data?.data ?? []) byKey.set(flag.key, [...(byKey.get(flag.key) ?? []), flag]);
    return [...byKey.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, rows]) => ({key, rows: [...rows].sort((a, b) => scopeRank(a.scope) - scopeRank(b.scope))}));
  }, [flags.data]);

  const confirmDelete = async () => {
    if (!deleting) return;
    const outcome = await remove.run(deleting.id);
    if (!outcome.ok) return;
    setDeleting(null);
    notify(t("admin:common.deleted"));
    flags.reload();
  };

  return (
    <Panel
      title={t("custom_apps:flags.title")}
      description={t("custom_apps:flags.description_panel")}
      action={
        <Button size="sm" onClick={() => setDraft({mode: "create"})}>
          <Plus size={14} /> {t("custom_apps:flags.create")}
        </Button>
      }
    >
      <PanelState loading={flags.loading && !flags.data} error={flags.error} onRetry={flags.reload} ns="admin">
        {groups.length === 0 ? (
          <EmptyState
            icon={<FlagIcon size={28} />}
            title={t("custom_apps:flags.empty")}
            description={t("custom_apps:flags.empty_description")}
          />
        ) : (
          <ul className="flex flex-col gap-3">
            {groups.map(({key, rows}) => {
              const description = rows.find((row) => row.description)?.description;
              return (
                <li key={key} className="rounded-[var(--radius-md)] border border-neutral-800">
                  <div className="flex flex-wrap items-start justify-between gap-3 border-b border-neutral-800 px-4 py-3">
                    <div className="min-w-0">
                      <p className="font-mono text-sm break-all text-text">{key}</p>
                      {description && <p className="mt-0.5 text-[12px] text-neutral-500">{description}</p>}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => setDraft({mode: "create", key})}>
                      <Plus size={14} /> {t("custom_apps:flags.add_override")}
                    </Button>
                  </div>
                  <ul>
                    {rows.map((flag, index) => (
                      <li
                        key={flag.id}
                        className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800/70 px-4 py-2.5 text-[13px] last:border-0"
                      >
                        <span className="w-6 shrink-0 text-center text-[11px] text-neutral-600 tabular-nums" aria-hidden="true">
                          {index + 1}
                        </span>
                        <span className="min-w-[10rem] flex-1 text-neutral-400">
                          <ScopeLabel scope={flag.scope} value={flag.scope_value} names={names} />
                        </span>
                        <FlagValueView value={flag.value} />
                        <span className="hidden text-[12px] text-neutral-600 lg:inline">
                          {formatDateTime(flag.updated_at, i18n.language)}
                          {flag.updated_by && ` · ${flag.updated_by}`}
                        </span>
                        <span className="ml-auto flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDraft({mode: "edit", flag})}
                            aria-label={t("custom_apps:flags.edit_aria", {key})}
                          >
                            <PencilSimple size={14} />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              remove.reset();
                              setDeleting(flag);
                            }}
                            aria-label={t("custom_apps:flags.delete_aria", {key})}
                          >
                            <Trash size={14} />
                          </Button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </li>
              );
            })}
          </ul>
        )}
      </PanelState>

      <FlagFormModal
        appId={appId}
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          notify(draft?.mode === "edit" ? t("admin:common.saved") : t("admin:common.created"));
          setDraft(null);
          flags.reload();
        }}
        installations={installations.data?.data ?? []}
        installationsLoading={installations.loading}
      />

      <ConfirmDialog
        open={deleting !== null}
        title={t("custom_apps:flags.delete_title")}
        body={
          deleting
            ? deleting.scope === "app"
              ? t("custom_apps:flags.delete_body_app", {key: deleting.key})
              : t("custom_apps:flags.delete_body_override", {key: deleting.key})
            : ""
        }
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </Panel>
  );
};
