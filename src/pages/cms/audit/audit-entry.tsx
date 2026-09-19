import {useId, useState} from "react";
import {useTranslation} from "react-i18next";
import {CaretRight} from "@phosphor-icons/react";
import {describeUserAgent, formatDateTime} from "@/lib/auth/format.ts";
import {stringifyJson} from "@/lib/cms/json.ts";
import type {AuditEntry} from "@/lib/cms/types.ts";
import {cn} from "@/lib/utils.ts";
import {styleOf} from "@/pages/cms/audit/audit-events.ts";
import {formatRelativeTime} from "@/pages/cms/audit/relative-time.ts";

export type AuditEntryItemProps = {
  entry: AuditEntry;
  /** The rail is drawn between markers, so the last entry does not trail a line into nothing. */
  last: boolean;
};

const Separator = () => <span className="text-neutral-700" aria-hidden="true">·</span>;

/**
 * One line of the log.
 *
 * The service only promises `id`, `event` and `created_at`, so this renders as a complete thought
 * with just those three: the marker, the event and the moment carry the entry on their own, and
 * actor, target, address, client and metadata each attach themselves only when they arrive. Nothing
 * below reserves space for a field that is absent, and nothing has to change the day the service
 * starts sending one.
 */
export const AuditEntryItem = ({entry, last}: AuditEntryItemProps) => {
  const {t, i18n} = useTranslation(["cms_audit", "cms"]);
  const [open, setOpen] = useState(false);
  const detailsId = useId();

  const style = styleOf(entry.event);
  const Icon = style.icon;

  /*
   * A known slug reads as a sentence, an unknown one shows verbatim — never a blank line where an
   * event should be. The nesting in the translation files mirrors the dots in the slug because
   * i18next splits keys on `.`, so `content.created` resolves to `events.content.created`.
   *
   * That seeded list is a best guess, not a contract: the API documents no vocabulary for `event`,
   * so the keys were inferred from the write endpoints it exposes — content create/update/delete/
   * reorder, legal create/update/delete, email-template create/update/delete and email send. An
   * event outside it is not an error, it is just an event we have no sentence for yet.
   */
  const label = t(`cms_audit:events.${entry.event}`, {defaultValue: entry.event});

  const absolute = formatDateTime(entry.created_at, i18n.language);
  const relative = formatRelativeTime(entry.created_at, i18n.language);

  const actor = entry.actor_email || entry.actor_id;
  const target = [entry.target_type, entry.target_id].filter(Boolean).join(" ");
  const client = describeUserAgent(entry.user_agent);
  const metadata = stringifyJson(entry.metadata);

  return (
    <li className="relative flex gap-3 pb-5 last:pb-0">
      {!last && <span className="absolute top-9 bottom-0 left-4 w-px bg-neutral-800" aria-hidden="true"/>}

      <span
        className={cn(
          "relative flex size-8 shrink-0 items-center justify-center rounded-full border bg-surface",
          style.marker,
        )}
        aria-hidden="true"
      >
        <Icon size={15}/>
      </span>

      <div className="min-w-0 flex-1 pt-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
          <p className={cn("text-sm break-words", style.label)}>{label}</p>
          {/* The raw ISO value stays one hover away: a log is evidence, and "3 hours ago" is not. */}
          <time
            dateTime={entry.created_at}
            title={entry.created_at}
            className="shrink-0 text-xs text-neutral-500"
          >
            {absolute ?? entry.created_at}
            {relative && <span className="text-neutral-600"> · {relative}</span>}
          </time>
        </div>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[13px] text-neutral-500">
          {actor ? (
            <span className="break-all text-neutral-400">{actor}</span>
          ) : (
            <span className="text-neutral-600 italic">{t("cms_audit:entry.actor_unknown")}</span>
          )}
          {target && (
            <>
              <Separator/>
              <span className="max-w-full truncate font-mono text-[12px]" title={target}>
                {target}
              </span>
            </>
          )}
          {entry.ip && (
            <>
              <Separator/>
              <span className="font-mono text-[12px]">{entry.ip}</span>
            </>
          )}
          {client && (
            <>
              <Separator/>
              <span title={entry.user_agent ?? undefined}>{client}</span>
            </>
          )}
        </p>

        {metadata && (
          <>
            <button
              type="button"
              onClick={() => setOpen((value) => !value)}
              aria-expanded={open}
              aria-controls={detailsId}
              className="mt-2 inline-flex cursor-pointer items-center gap-1 rounded-[var(--radius-sm)] text-[12px] text-neutral-500 transition-colors hover:text-text"
            >
              <CaretRight size={12} className={cn("transition-transform", open && "rotate-90")} aria-hidden="true"/>
              {open ? t("cms_audit:entry.hide_metadata") : t("cms_audit:entry.show_metadata")}
            </button>
            {open && (
              <pre
                id={detailsId}
                aria-label={t("cms_audit:entry.metadata_label")}
                className="mt-2 max-h-72 overflow-auto rounded-[var(--radius-md)] border border-neutral-800 bg-bg px-3 py-2.5 font-mono text-[12px] leading-relaxed text-neutral-300"
              >
                {metadata}
              </pre>
            )}
          </>
        )}
      </div>
    </li>
  );
};
