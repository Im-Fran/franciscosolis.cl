import {useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {CaretRight} from "@phosphor-icons/react";
import {formatDateTime} from "@/lib/auth/format.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {LogEntry} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {LogLevelBadge} from "@/pages/custom-apps/components/badges.tsx";
import {installationLabel} from "@/pages/custom-apps/components/installation-label.ts";

/** One log entry: its level, when, the line itself, and its context one click away. */
export const LogItem = ({entry, showInstallation}: {entry: LogEntry; showInstallation: boolean}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const [open, setOpen] = useState(false);
  const contextId = useId();
  const language = i18n.language;
  const context = entry.context && Object.keys(entry.context).length > 0 ? JSON.stringify(entry.context, null, 2) : null;
  const device = installationLabel({
    alias: entry.installation_alias,
    hostname: entry.installation_hostname,
    device_id: entry.installation_id,
  });

  return (
    <li className="border-b border-neutral-800/70 py-3 last:border-0">
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <LogLevelBadge value={entry.level} />
          {entry.target && <span className="truncate font-mono text-[12px] text-neutral-500">{entry.target}</span>}
          {showInstallation && (
            <Link
              to={customAppsRoute.installation(entry.installation_id)}
              className="truncate text-[12px] text-neutral-400 hover:text-text hover:underline"
            >
              {device}
            </Link>
          )}
        </span>
        <time dateTime={entry.occurred_at} title={entry.occurred_at} className="shrink-0 text-xs text-neutral-500">
          {formatDateTime(entry.occurred_at, language)}
          <span className="text-neutral-600"> · {formatLastSeen(entry.occurred_at, language)}</span>
        </time>
      </div>
      <p className="mt-1.5 font-mono text-[12.5px] leading-relaxed break-words whitespace-pre-wrap text-neutral-200">
        {entry.message}
      </p>
      {context && (
        <button
          type="button"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
          aria-controls={contextId}
          className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[12px] text-neutral-500 transition-colors hover:text-text"
        >
          <CaretRight size={12} className={cn("transition-transform", open && "rotate-90")} aria-hidden="true" />
          {open ? t("logs.hide_context") : t("logs.show_context")}
        </button>
      )}
      {open && context && (
        <pre
          id={contextId}
          className="mt-2 max-h-64 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300"
        >
          {context}
        </pre>
      )}
    </li>
  );
};
