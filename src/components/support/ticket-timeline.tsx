import {useTranslation} from "react-i18next";
import {Paperclip} from "@phosphor-icons/react";
import {formatDateTime} from "@/lib/auth/format.ts";
import type {TimelineEntry} from "@/lib/support/types.ts";

/**
 * The conversation, in the shape a GitHub issue shows it: messages as cards, everything else as a
 * quiet line between them.
 *
 * Shared by the public thread and the console. The one difference is what the API put in the list —
 * `/tickets/:reference/timeline` never returns an internal note, whoever is asking — so this
 * component does not take a "show notes" flag. There is no client-side filter to get wrong, which
 * is the point: the redaction lives in one function on the service and nowhere else.
 */
export const TicketTimeline = ({entries, locale}: {entries: TimelineEntry[]; locale: string}) => {
  const {t} = useTranslation("support");

  return (
    <ol className="flex flex-col gap-4">
      {entries.map((entry) =>
        entry.type === "message" ? (
          <li
            key={entry.id}
            className={[
              "rounded-[var(--radius-md)] border p-4",
              entry.kind === "note"
                ? /* Internal notes look different on purpose: an agent must never mistake one for
                     something the requester can read. */
                  "border-amber-500/30 bg-amber-500/5"
                : entry.author_type === "agent"
                  ? "border-accent-500/25 bg-accent-500/5"
                  : "border-neutral-800 bg-neutral-900/40",
            ].join(" ")}
          >
            <div className="mb-2 flex flex-wrap items-baseline gap-x-2 gap-y-1 text-xs text-neutral-400">
              <span className="font-medium text-neutral-200">
                {entry.author_name ?? entry.author_email ?? t("ticket.system")}
              </span>
              {entry.kind === "note" ? (
                <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-200">{t("ticket.internal_note")}</span>
              ) : null}
              {entry.source === "email" ? <span aria-hidden>·</span> : null}
              {entry.source === "email" ? <span>email</span> : null}
              <span className="ml-auto">{formatDateTime(entry.created_at, locale)}</span>
            </div>

            {/* `whitespace-pre-wrap` because the body is plain text and its line breaks are meaning:
                a pasted stack trace collapsed into one paragraph is unreadable. */}
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-200">{entry.body}</p>

            {entry.attachments.length > 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-neutral-400">
                <Paperclip size={14} aria-hidden />
                {t("ticket.attachments", {count: entry.attachments.length})}
                <span className="text-neutral-500">
                  — {entry.attachments.map((file) => file.filename).join(", ")}
                </span>
              </p>
            ) : null}
          </li>
        ) : (
          <li key={entry.id} className="flex flex-wrap items-baseline gap-x-2 px-1 text-xs text-neutral-500">
            <span className="text-neutral-400">{entry.actor_email ?? t("ticket.system")}</span>
            <span>{t(`ticket.events.${entry.event}`, {defaultValue: entry.event})}</span>
            <span className="ml-auto">{formatDateTime(entry.created_at, locale)}</span>
          </li>
        ),
      )}
    </ol>
  );
};
