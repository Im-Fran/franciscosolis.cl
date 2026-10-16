import {useCallback, useEffect, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowCounterClockwise, ClockCounterClockwise, Eye} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {ConfigDocument, ConfigVersion} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {Pill} from "@/pages/custom-apps/components/badges.tsx";

const PAGE_SIZE = 10;

/**
 * Every version of the configuration, newest first. Restoring one does not rewind anything: it
 * saves that document again as the newest version, so the history only ever grows and the version
 * it replaced is still one click away.
 */
export const ConfigHistory = ({
  appId,
  currentVersion,
  onRestored,
}: {
  appId: string;
  currentVersion: number;
  onRestored: (config: ConfigDocument) => void;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const language = i18n.language;
  const [offset, setOffset] = useState(0);
  const [viewing, setViewing] = useState<ConfigVersion | null>(null);
  const [restoring, setRestoring] = useState<ConfigVersion | null>(null);

  const history = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.config.history(appId, {limit: PAGE_SIZE, offset}, signal),
      [appId, offset],
    ),
  );
  const restore = useMutation(useCallback((version: number) => customAppsApi.config.restore(appId, version), [appId]));

  /* A new version, from anywhere on this screen, is a new first row. */
  const {reload} = history;
  const shown = useRef(currentVersion);
  useEffect(() => {
    if (shown.current === currentVersion) return;
    shown.current = currentVersion;
    reload();
  }, [currentVersion, reload]);

  const rows = history.data?.data ?? [];

  const confirmRestore = async () => {
    if (!restoring) return;
    const outcome = await restore.run(restoring.version);
    if (!outcome.ok) return;
    setRestoring(null);
    setViewing(null);
    setOffset(0);
    notify(t("custom_apps:config.restored", {from: restoring.version, version: outcome.data.version}));
    onRestored(outcome.data);
  };

  return (
    <Panel title={t("custom_apps:config.history_title")} description={t("custom_apps:config.history_description")}>
      <PanelState loading={history.loading && !history.data} error={history.error} onRetry={history.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState icon={<ClockCounterClockwise size={28} />} title={t("custom_apps:config.history_empty")} />
        ) : (
          <ul className={history.loading ? "opacity-60 transition-opacity" : undefined}>
            {rows.map((entry) => (
              <li
                key={entry.version}
                className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-neutral-800/70 py-3 last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-2 text-sm text-text">
                    {t("custom_apps:config.version", {version: entry.version})}
                    {entry.version === currentVersion && <Pill tone="good">{t("custom_apps:config.current_badge")}</Pill>}
                  </p>
                  <p className="mt-0.5 text-[12px] text-neutral-500">
                    {[formatDateTime(entry.created_at, language), entry.created_by, entry.note].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" onClick={() => setViewing(entry)}>
                    <Eye size={14} /> {t("custom_apps:config.view")}
                  </Button>
                  {entry.version !== currentVersion && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        restore.reset();
                        setRestoring(entry);
                      }}
                    >
                      <ArrowCounterClockwise size={14} /> {t("custom_apps:config.restore")}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={history.data?.pagination.total}
          onChange={setOffset}
          disabled={history.loading}
        />
      </PanelState>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? t("custom_apps:config.version", {version: viewing.version}) : undefined}
        className="max-w-2xl"
      >
        {viewing && (
          <div className="flex flex-col gap-4">
            <p className="text-[13px] text-neutral-500">
              {[formatDateTime(viewing.created_at, language), viewing.created_by, viewing.note].filter(Boolean).join(" · ")}
            </p>
            <pre className="max-h-[55vh] overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300">
              {JSON.stringify(viewing.document, null, 2)}
            </pre>
            {viewing.version !== currentVersion && (
              <div className="flex justify-end">
                <Button
                  variant="secondary"
                  onClick={() => {
                    restore.reset();
                    setRestoring(viewing);
                  }}
                >
                  <ArrowCounterClockwise size={16} /> {t("custom_apps:config.restore")}
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={restoring !== null}
        title={t("custom_apps:config.restore_title", {version: restoring?.version ?? ""})}
        body={t("custom_apps:config.restore_body", {version: restoring?.version ?? ""})}
        confirmLabel={t("custom_apps:config.restore")}
        onConfirm={() => void confirmRestore()}
        onClose={() => setRestoring(null)}
        pending={restore.pending}
        error={restore.error}
      />
    </Panel>
  );
};
