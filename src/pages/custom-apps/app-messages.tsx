import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {ChatCenteredText, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import type {AppMessage} from "@/lib/custom-apps/types.ts";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {useApp} from "@/pages/custom-apps/components/app-context.ts";
import {installationNames, useAppInstallations} from "@/pages/custom-apps/components/use-app-installations.ts";
import {MessageFormModal} from "@/pages/custom-apps/components/messages/message-form-modal.tsx";
import type {MessageDraft} from "@/pages/custom-apps/components/messages/message-form-modal.tsx";
import {MessageItem} from "@/pages/custom-apps/components/messages/message-item.tsx";
import {ReceiptsModal} from "@/pages/custom-apps/components/messages/receipts-modal.tsx";
import {ModuleGate} from "@/pages/custom-apps/components/module-gate.tsx";

const PAGE_SIZE = 20;
const FILTERS = ["all", "active", "scheduled", "ended"] as const;
type Filter = (typeof FILTERS)[number];

/**
 * Messages shown inside the app — a banner or a modal — to everybody, one channel, or one device,
 * for a window of time. Ending one sets its end to now rather than deleting it, so its read
 * receipts survive it.
 */
export const AppMessages = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {app} = useApp();
  const {notify} = useToast();
  const [filter, setFilter] = useState<Filter>("all");
  const [offset, setOffset] = useState(0);
  const [draft, setDraft] = useState<MessageDraft | null>(null);
  const [deleting, setDeleting] = useState<AppMessage | null>(null);
  const [receipts, setReceipts] = useState<AppMessage | null>(null);
  const [ending, setEnding] = useState<string | null>(null);

  const messages = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.messages.list(app.id, {status: filter, limit: PAGE_SIZE, offset}, signal),
      [app.id, filter, offset],
    ),
  );
  const installations = useAppInstallations(app.id);
  const names = useMemo(() => installationNames(installations.data?.data), [installations.data]);

  const end = useMutation(
    useCallback((id: string) => customAppsApi.messages.update(id, {ends_at: new Date().toISOString()}), []),
  );
  const remove = useMutation(useCallback((id: string) => customAppsApi.messages.remove(id), []));

  const rows = messages.data?.data ?? [];

  const endNow = async (message: AppMessage) => {
    setEnding(message.id);
    const outcome = await end.run(message.id);
    setEnding(null);
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      return;
    }
    notify(t("custom_apps:messages.ended"));
    messages.reload();
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    const outcome = await remove.run(deleting.id);
    if (!outcome.ok) return;
    setDeleting(null);
    notify(t("admin:common.deleted"));
    messages.reload();
  };

  return (
    <ModuleGate modules={["messages"]}>
      <Panel
        title={t("custom_apps:messages.title")}
        description={t("custom_apps:messages.description")}
        action={
          <>
            <Select
              value={filter}
              onChange={(event) => {
                setFilter(event.target.value as Filter);
                setOffset(0);
              }}
              aria-label={t("custom_apps:messages.filter")}
              className="h-9 w-auto text-[13px]"
            >
              {FILTERS.map((value) => (
                <option key={value} value={value}>
                  {t(`custom_apps:messages.filters.${value}`)}
                </option>
              ))}
            </Select>
            <Button size="sm" onClick={() => setDraft({mode: "create"})}>
              <Plus size={14} /> {t("custom_apps:messages.create")}
            </Button>
          </>
        }
      >
        <PanelState loading={messages.loading && !messages.data} error={messages.error} onRetry={messages.reload} ns="admin">
          {rows.length === 0 ? (
            filter !== "all" ? (
              <p className="py-4 text-sm text-neutral-500">{t(`custom_apps:messages.empty_filtered.${filter}`)}</p>
            ) : (
              <EmptyState
                icon={<ChatCenteredText size={28} />}
                title={t("custom_apps:messages.empty")}
                description={t("custom_apps:messages.empty_description")}
              />
            )
          ) : (
            <ul className={messages.loading ? "flex flex-col gap-3 opacity-60 transition-opacity" : "flex flex-col gap-3"}>
              {rows.map((message) => (
                <MessageItem
                  key={message.id}
                  message={message}
                  names={names}
                  onEdit={() => setDraft({mode: "edit", message})}
                  onEnd={() => void endNow(message)}
                  onDelete={() => {
                    remove.reset();
                    setDeleting(message);
                  }}
                  onReceipts={() => setReceipts(message)}
                  ending={ending === message.id}
                />
              ))}
            </ul>
          )}
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={messages.data?.pagination.total}
            onChange={setOffset}
            disabled={messages.loading}
          />
        </PanelState>
      </Panel>

      <MessageFormModal
        appId={app.id}
        draft={draft}
        onClose={() => setDraft(null)}
        onSaved={() => {
          notify(draft?.mode === "edit" ? t("admin:common.saved") : t("custom_apps:messages.published"));
          setDraft(null);
          messages.reload();
        }}
        installations={installations.data?.data ?? []}
        installationsLoading={installations.loading}
      />

      <ReceiptsModal message={receipts} onClose={() => setReceipts(null)} />

      <ConfirmDialog
        open={deleting !== null}
        title={t("custom_apps:messages.delete_title")}
        body={t("custom_apps:messages.delete_body", {title: deleting?.title ?? ""})}
        confirmLabel={remove.pending ? t("admin:common.deleting") : t("admin:common.delete")}
        onConfirm={() => void confirmDelete()}
        onClose={() => setDeleting(null)}
        pending={remove.pending}
        error={remove.error}
      />
    </ModuleGate>
  );
};
