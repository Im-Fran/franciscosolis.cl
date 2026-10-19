import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import {useTranslation} from "react-i18next";
import {Terminal} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatDuration} from "@/lib/custom-apps/format.ts";
import {useAutoRefresh} from "@/lib/custom-apps/use-auto-refresh.ts";
import type {App, Command, CommandStatus, Installation} from "@/lib/custom-apps/types.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {CommandForm} from "@/pages/custom-apps/components/remote/command-form.tsx";
import {CommandItem} from "@/pages/custom-apps/components/remote/command-item.tsx";
import {isLive} from "@/pages/custom-apps/components/remote/commands.ts";
import {useHelp} from "@/pages/custom-apps/components/use-help.ts";
import {FormHelpButton, WithHelp} from "@/components/ui/help.tsx";

const PAGE_SIZE = 20;
/** Fast enough to watch a command land; it only runs while one is on its way. */
const LIVE_REFRESH_MS = 5_000;

/**
 * What this device has been asked to do, and asking it something new.
 *
 * A command waits on the service until the device collects it: on its next heartbeat, or at once
 * when the device holds the live socket. The list therefore polls every five seconds while anything
 * on the page is still pending or delivered, and stops when nothing is — a history of finished
 * commands does not change under its reader.
 *
 * `onScreenshot` fires when a screenshot command is seen finishing, so the gallery beside it can
 * fetch the new image without its own timer.
 */
export const InstallationCommands = ({
  installation,
  app,
  onScreenshot,
}: {
  installation: Installation;
  app: App | null;
  onScreenshot: () => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const help = useHelp();
  const {notify} = useToast();
  const {commandStatuses} = useServiceVocabulary();
  const [status, setStatus] = useState<"" | CommandStatus>("");
  const [offset, setOffset] = useState(0);
  const [cancelling, setCancelling] = useState<string | null>(null);

  const commands = useResource(
    useCallback(
      (signal: AbortSignal) =>
        customAppsApi.commands.list(installation.id, {status: status || undefined, limit: PAGE_SIZE, offset}, signal),
      [installation.id, status, offset],
    ),
  );

  const rows = useMemo(() => commands.data?.data ?? [], [commands.data]);
  const live = rows.some(isLive);
  useAutoRefresh(commands.reload, LIVE_REFRESH_MS, live);

  /* A screenshot that was on its way and has now succeeded is a new image in the gallery. */
  const seen = useRef(new Map<string, CommandStatus>());
  useEffect(() => {
    let landed = false;
    for (const command of rows) {
      const before = seen.current.get(command.id);
      if (command.type === "screenshot" && command.status === "succeeded" && before && before !== "succeeded") landed = true;
      seen.current.set(command.id, command.status);
    }
    if (landed) onScreenshot();
  }, [rows, onScreenshot]);

  const cancel = useMutation(useCallback((id: string) => customAppsApi.commands.cancel(id), []));

  const runCancel = async (command: Command) => {
    setCancelling(command.id);
    const outcome = await cancel.run(command.id);
    setCancelling(null);
    if (!outcome.ok) {
      notify(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}), "error");
      commands.reload();
      return;
    }
    notify(t("custom_apps:commands.cancelled"));
    commands.reload();
  };

  const onSent = (command: Command) => {
    seen.current.set(command.id, command.status);
    if (offset !== 0 || (status && status !== command.status)) {
      setStatus("");
      setOffset(0);
    } else {
      commands.reload();
    }
  };

  return (
    <Panel
      title={t("custom_apps:commands.title")}
      action={<FormHelpButton help={help.form("commands.form_help")} />}
      description={
        installation.socket_connected
          ? t("custom_apps:commands.description_socket")
          : t("custom_apps:commands.description", {
              interval: formatDuration(installation.heartbeat_interval_seconds),
            })
      }
    >
      <div className="flex flex-col gap-6">
        <CommandForm installation={installation} app={app} onSent={onSent} />

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-sm font-medium text-neutral-300">{t("custom_apps:commands.history")}</h3>
            <WithHelp label={t("custom_apps:commands.filter")} help={help.field("commands.filter_help.status")}>
              <Select
                value={status}
                onChange={(event) => {
                  setStatus(event.target.value as "" | CommandStatus);
                  setOffset(0);
                }}
                aria-label={t("custom_apps:commands.filter")}
                className="h-9 w-auto text-[13px]"
              >
                <option value="">{t("custom_apps:commands.any_status")}</option>
                {commandStatuses.map((value) => (
                  <option key={value} value={value}>
                    {t(`custom_apps:command_statuses.${value}`, {defaultValue: value})}
                  </option>
                ))}
              </Select>
            </WithHelp>
          </div>

          {live && (
            <Alert tone="info" className="mb-3">
              {t("custom_apps:commands.live_hint")}
            </Alert>
          )}

          <PanelState loading={commands.loading && !commands.data} error={commands.error} onRetry={commands.reload} ns="admin">
            {rows.length === 0 ? (
              status ? (
                <p className="py-4 text-sm text-neutral-500">{t("custom_apps:commands.no_matches")}</p>
              ) : (
                <EmptyState
                  icon={<Terminal size={28} />}
                  title={t("custom_apps:commands.empty")}
                  description={t("custom_apps:commands.empty_description")}
                />
              )
            ) : (
              <ul>
                {rows.map((command) => (
                  <CommandItem
                    key={command.id}
                    command={command}
                    onCancel={(target) => void runCancel(target)}
                    cancelling={cancelling === command.id}
                  />
                ))}
              </ul>
            )}
            <Pagination
              offset={offset}
              limit={PAGE_SIZE}
              count={rows.length}
              total={commands.data?.pagination.total}
              onChange={setOffset}
              disabled={commands.loading}
            />
          </PanelState>
        </div>
      </div>
    </Panel>
  );
};
