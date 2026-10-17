import {useCallback, useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Camera, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {formatBytes} from "@/lib/custom-apps/format.ts";
import type {Installation, Screenshot} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {ScreenshotImage} from "@/pages/custom-apps/components/remote/screenshot-image.tsx";

const PAGE_SIZE = 12;

/**
 * What the device's screen showed, each time somebody asked.
 *
 * Screenshots are off by default — for the app and for each device — because they can show the
 * client's own customers, which makes them personal data (ley 21.719). The gallery says which of
 * the two switches is off rather than just staying empty, and deleting one asks first.
 *
 * `version` is bumped by the commands panel when a screenshot lands, which is how a new image shows
 * up here without a timer of its own.
 */
export const InstallationScreenshots = ({
  installation,
  appAllows,
  version,
}: {
  installation: Installation;
  /** Null while the app is loading. */
  appAllows: boolean | null;
  version: number;
}) => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const language = i18n.language;
  const [offset, setOffset] = useState(0);
  const [viewing, setViewing] = useState<Screenshot | null>(null);
  const [deleting, setDeleting] = useState<Screenshot | null>(null);

  const screenshots = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.screenshots.list(installation.id, {limit: PAGE_SIZE, offset}, signal),
      [installation.id, offset],
    ),
  );

  /* A screenshot just landed: ask again. The first render's version is not news. */
  const {reload} = screenshots;
  useEffect(() => {
    if (version > 0) reload();
  }, [version, reload]);
  const remove = useMutation(useCallback((id: string) => customAppsApi.screenshots.remove(id), []));

  const rows = screenshots.data?.data ?? [];
  const describe = (shot: Screenshot) =>
    t("custom_apps:screenshots.alt", {date: formatDateTime(shot.created_at, language) ?? shot.created_at});

  const confirmDelete = async () => {
    if (!deleting) return;
    const outcome = await remove.run(deleting.id);
    if (!outcome.ok) return;
    if (viewing?.id === deleting.id) setViewing(null);
    setDeleting(null);
    notify(t("custom_apps:screenshots.deleted"));
    screenshots.reload();
  };

  const off = !installation.screenshots_allowed;

  return (
    <Panel title={t("custom_apps:screenshots.title")} description={t("custom_apps:screenshots.description")}>
      <div className="flex flex-col gap-4">
        {off && (
          <Alert tone="info" title={t("custom_apps:screenshots.off_title")}>
            {appAllows === false
              ? t("custom_apps:screenshots.off_app")
              : !installation.screenshots_enabled
                ? t("custom_apps:screenshots.off_device")
                : t("custom_apps:screenshots.off_generic")}
          </Alert>
        )}

        <PanelState loading={screenshots.loading && !screenshots.data} error={screenshots.error} onRetry={screenshots.reload} ns="admin">
          {rows.length === 0 ? (
            <EmptyState
              icon={<Camera size={28} />}
              title={t("custom_apps:screenshots.empty")}
              description={off ? undefined : t("custom_apps:screenshots.empty_description")}
            />
          ) : (
            <ul className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
              {rows.map((shot) => (
                <li key={shot.id} className="flex flex-col gap-1.5">
                  <button
                    type="button"
                    onClick={() => setViewing(shot)}
                    className="block cursor-zoom-in overflow-hidden rounded-[var(--radius-md)] border border-neutral-800 transition-colors hover:border-neutral-600"
                    aria-label={t("custom_apps:screenshots.open", {date: formatDateTime(shot.created_at, language)})}
                  >
                    <ScreenshotImage path={shot.image_path} alt={describe(shot)} className="aspect-video w-full" />
                  </button>
                  <div className="flex items-center justify-between gap-2 text-[12px] text-neutral-500">
                    <span className="truncate">
                      <time dateTime={shot.created_at}>{formatDateTime(shot.created_at, language)}</time>
                      {" · "}
                      {formatBytes(shot.size_bytes, language)}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        remove.reset();
                        setDeleting(shot);
                      }}
                      className="cursor-pointer rounded-[var(--radius-sm)] p-1 text-neutral-500 transition-colors hover:text-red-300"
                      aria-label={t("custom_apps:screenshots.delete_aria", {date: formatDateTime(shot.created_at, language)})}
                    >
                      <Trash size={14} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={screenshots.data?.pagination.total}
            onChange={setOffset}
            disabled={screenshots.loading}
          />
        </PanelState>
      </div>

      <Modal
        open={viewing !== null}
        onClose={() => setViewing(null)}
        title={viewing ? formatDateTime(viewing.created_at, language) ?? undefined : undefined}
        className="max-w-5xl"
      >
        {viewing && (
          <div className="flex flex-col gap-4">
            <ScreenshotImage path={viewing.image_path} alt={describe(viewing)} className="max-h-[70vh] w-full rounded-[var(--radius-md)]" />
            <div className="flex flex-wrap items-center justify-between gap-3 text-[13px] text-neutral-500">
              <span>
                {viewing.content_type} · {formatBytes(viewing.size_bytes, language)}
              </span>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => {
                  remove.reset();
                  setDeleting(viewing);
                }}
                className="border-red-500/50 text-red-300 fs-ripple-danger"
              >
                <Trash size={14} /> {t("custom_apps:screenshots.delete")}
              </Button>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        open={deleting !== null}
        title={t("custom_apps:screenshots.delete_title")}
        body={t("custom_apps:screenshots.delete_body")}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("custom_apps:screenshots.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </Panel>
  );
};
