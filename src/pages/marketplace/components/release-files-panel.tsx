import {useCallback, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, CloudArrowUp, Trash, WarningCircle} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {formatBytes} from "@/lib/marketplace/store.ts";
import {CONTENT_STATUSES, RELEASE_FILE_PLATFORMS} from "@/lib/marketplace/types.ts";
import type {ContentStatus, ReleaseFile} from "@/lib/marketplace/types.ts";

/**
 * The downloadable builds attached to one release.
 *
 * Only offered once the release exists: a build hangs off a release note, so there is nothing to
 * attach it to while the note is still being written. That is also why this is a panel on the
 * release screen rather than a section of the product — the archive of old versions *is* the
 * changelog, and a second list of files would be a second thing to keep in step with it.
 *
 * Registering a build and uploading its bytes are two steps, because the service takes them as two.
 * A row with no upload yet is shown as unfinished rather than hidden: it is the normal state between
 * the two calls, and it cannot be published — the public page would show a download that 404s.
 */
export const ReleaseFilesPanel = ({productId, releaseId}: {productId: string; releaseId: string}) => {
  const {t, i18n} = useTranslation(["marketplace_admin", "cms", "admin"]);
  const locale = i18n.resolvedLanguage ?? "en";
  const {notify} = useToast();
  const picker = useRef<HTMLInputElement>(null);

  const files = useResource(
    useCallback(
      (signal: AbortSignal) => marketplaceApi.files.list(productId, releaseId, signal),
      [productId, releaseId],
    ),
  );

  const add = useMutation(
    useCallback(
      async (file: File) => {
        /*
         * The row first, then the bytes, and the row is named after the file the editor picked —
         * so the name a visitor saves is the name the build already had. The two calls are not a
         * transaction: an upload that fails leaves the row behind, unfinished and unpublishable,
         * which is recoverable by retrying the upload. The other order is not.
         */
        const created = await marketplaceApi.files.create(productId, releaseId, {
          filename: file.name,
          content_type: file.type || "product/octet-stream",
        });
        return marketplaceApi.files.upload(productId, releaseId, created.id, file);
      },
      [productId, releaseId],
    ),
  );

  const patch = useMutation(
    useCallback(
      ({id, ...body}: {id: string; status?: ContentStatus; platform?: string; label?: string | null}) =>
        marketplaceApi.files.update(productId, releaseId, id, body),
      [productId, releaseId],
    ),
  );

  const remove = useMutation(
    useCallback((id: string) => marketplaceApi.files.remove(productId, releaseId, id), [productId, releaseId]),
  );

  const [deleting, setDeleting] = useState<ReleaseFile | null>(null);

  const upload = async (file: File | undefined) => {
    if (!file) return;
    const outcome = await add.run(file);
    if (!outcome.ok) return;
    notify(t("marketplace_admin:files.uploaded", {filename: file.name}));
    files.reload();
  };

  const apply = async (id: string, body: {status?: ContentStatus; platform?: string}) => {
    const outcome = await patch.run({id, ...body});
    if (outcome.ok) files.reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const outcome = await remove.run(deleting.id);
    if (!outcome.ok) return;
    setDeleting(null);
    notify(t("marketplace_admin:files.deleted"));
    files.reload();
  };

  const rows = files.data ?? [];

  return (
    <>
      <Panel
        title={t("marketplace_admin:files.title")}
        description={t("marketplace_admin:files.hint")}
        action={
          /*
           * Every button in here is `type="button"`, and that is load-bearing rather than tidy: the
           * panel is rendered inside the release editor's form, where a button with no type is a
           * submit button. Picking a file used to save the release on the way to the file dialog.
           */
          <span className="flex flex-wrap gap-1">
            <Button type="button" variant="ghost" size="sm" onClick={files.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            <Button type="button" size="sm" onClick={() => picker.current?.click()} disabled={add.pending}>
              <CloudArrowUp size={14}/>
              {add.pending ? t("marketplace_admin:files.uploading") : t("marketplace_admin:files.add")}
            </Button>
          </span>
        }
      >
        <input
          ref={picker}
          type="file"
          className="hidden"
          onChange={(event) => {
            void upload(event.target.files?.[0]);
            /* Cleared so picking the same file twice in a row still fires a change. */
            event.target.value = "";
          }}
        />

        {add.error && (
          <p className="mb-3 flex items-center gap-2 text-xs text-red-400">
            <WarningCircle size={14}/> {add.error}
          </p>
        )}

        <PanelState
          loading={files.loading && !files.data}
          error={files.error}
          empty={rows.length === 0}
          emptyLabel={t("marketplace_admin:files.empty")}
          onRetry={files.reload}
          ns="cms"
        >
          <ul className="flex flex-col gap-3">
            {rows.map((file) => (
              <li key={file.id} className="rounded-[var(--radius-md)] bg-bg/40 px-4 py-3">
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-text">{file.filename}</span>
                    <span className="block text-[12px] text-neutral-500">
                      {file.has_content
                        ? `${formatBytes(file.size, locale)} · ${t("marketplace_admin:files.downloads", {count: file.download_count ?? 0})}`
                        : t("marketplace_admin:files.no_content")}
                    </span>
                  </span>

                  {!file.has_content && <Badge variant="outline" size="sm">{t("marketplace_admin:files.unfinished")}</Badge>}

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleting(file)}
                    aria-label={t("marketplace_admin:files.delete_label", {filename: file.filename})}
                  >
                    <Trash size={14}/>
                  </Button>
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label={t("marketplace_admin:files.platform")} htmlFor={`file-platform-${file.id}`}>
                    <Select
                      id={`file-platform-${file.id}`}
                      value={file.platform}
                      onChange={(event) => void apply(file.id, {platform: event.target.value})}
                      disabled={patch.pending}
                    >
                      {RELEASE_FILE_PLATFORMS.map((platform) => (
                        <option key={platform} value={platform}>
                          {t(`marketplace_admin:files.platforms.${platform}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field
                    label={t("marketplace_admin:files.status")}
                    htmlFor={`file-status-${file.id}`}
                    /* The service refuses to publish a row with no bytes; saying so beats a 422. */
                    hint={file.has_content ? undefined : t("marketplace_admin:files.publish_blocked")}
                  >
                    <Select
                      id={`file-status-${file.id}`}
                      value={file.status ?? "draft"}
                      onChange={(event) => void apply(file.id, {status: event.target.value as ContentStatus})}
                      disabled={patch.pending || !file.has_content}
                    >
                      {CONTENT_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {t(`admin:status.${status}`)}
                        </option>
                      ))}
                    </Select>
                  </Field>
                </div>
              </li>
            ))}
          </ul>
        </PanelState>

        {/* A label rather than a hint: what the visitor sees is this filename, and it cannot be
            changed here without renaming what they save — so renaming lives on the file itself. */}
        <p className="mt-4 text-[12px] leading-relaxed text-neutral-500">{t("marketplace_admin:files.naming")}</p>
      </Panel>

      <ConfirmDialog
        open={Boolean(deleting)}
        title={t("marketplace_admin:files.delete_title")}
        body={t("marketplace_admin:files.delete_body", {filename: deleting?.filename ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("marketplace_admin:files.delete_confirm")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </>
  );
};
