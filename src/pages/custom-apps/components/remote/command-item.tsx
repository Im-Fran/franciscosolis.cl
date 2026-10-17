import {useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {CaretRight, XCircle} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {Command} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {CommandStatusBadge} from "@/pages/custom-apps/components/badges.tsx";
import {isLive} from "@/pages/custom-apps/components/remote/commands.ts";

const hasContent = (value: unknown) =>
  value !== null && value !== undefined && !(typeof value === "object" && Object.keys(value).length === 0);

/** One command in the history: what, its status, its timeline, and what the device answered. */
export const CommandItem = ({
  command,
  onCancel,
  cancelling,
}: {
  command: Command;
  onCancel: (command: Command) => void;
  cancelling: boolean;
}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const language = i18n.language;
  const result = hasContent(command.result)
    ? typeof command.result === "string"
      ? command.result
      : JSON.stringify(command.result, null, 2)
    : null;
  const payload = hasContent(command.payload) ? JSON.stringify(command.payload, null, 2) : null;

  const timeline = [
    t("commands.created", {when: formatDateTime(command.created_at, language), by: command.created_by ?? t("audit.system")}),
    command.delivered_at ? t("commands.delivered", {when: formatDateTime(command.delivered_at, language)}) : null,
    command.completed_at ? t("commands.completed", {when: formatDateTime(command.completed_at, language)}) : null,
    isLive(command) ? t("commands.expires_at", {when: formatLastSeen(command.expires_at, language)}) : null,
    command.cancelled_by ? t("commands.cancelled_by", {by: command.cancelled_by}) : null,
  ].filter((entry): entry is string => Boolean(entry));

  return (
    <li className="border-b border-neutral-800/70 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <p className="flex min-w-0 flex-wrap items-center gap-2 text-sm text-text">
          <span>{t(`commands.types.${command.type}`, {defaultValue: command.type})}</span>
          <CommandStatusBadge value={command.status} />
          {isLive(command) && <Spinner size={12} label={t("commands.live")} />}
        </p>
        {isLive(command) && (
          <Button variant="ghost" size="sm" onClick={() => onCancel(command)} disabled={cancelling}>
            {cancelling ? <Spinner size={14} /> : <XCircle size={14} />}
            {t("commands.cancel")}
          </Button>
        )}
      </div>
      <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12px] text-neutral-500">
        {timeline.map((entry) => (
          <span key={entry}>{entry}</span>
        ))}
      </p>
      {(result || payload) && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={detailsId}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[12px] text-neutral-500 transition-colors hover:text-text"
        >
          <CaretRight size={12} className={cn("transition-transform", open && "rotate-90")} aria-hidden="true" />
          {open ? t("commands.hide_details") : result ? t("commands.show_result") : t("commands.show_payload")}
        </button>
      )}
      {open && (
        <div id={detailsId} className="mt-2 flex flex-col gap-2">
          {payload && (
            <div>
              <p className="mb-1 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("commands.payload")}</p>
              <pre className="max-h-48 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300">
                {payload}
              </pre>
            </div>
          )}
          {result && (
            <div>
              <p className="mb-1 text-[11px] font-medium tracking-wider text-neutral-600 uppercase">{t("commands.result")}</p>
              <pre className="max-h-64 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-neutral-300">
                {result}
              </pre>
            </div>
          )}
        </div>
      )}
    </li>
  );
};
