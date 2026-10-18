import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowRight} from "@phosphor-icons/react";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {formatLastSeen} from "@/lib/custom-apps/format.ts";
import type {Ticket} from "@/lib/custom-apps/types.ts";
import {TicketStatusBadge} from "@/pages/custom-apps/components/badges.tsx";

/**
 * The requester's messages nobody in the panel has opened yet, as a small count — or nothing. It is
 * the figure an inbox is scanned for, so it carries its word for a screen reader as well as a colour.
 */
export const UnreadCount = ({count}: {count: number}) => {
  const {t} = useTranslation("custom_apps");
  if (count <= 0) return null;
  return (
    <span
      className="shrink-0 rounded-full bg-amber-500/20 px-1.5 text-[11px] text-amber-300 tabular-nums"
      title={t("tickets.unread", {count})}
      aria-label={t("tickets.unread", {count})}
    >
      {count}
    </span>
  );
};

/**
 * One ticket as a line in a short list — an installation's tickets, where a table would be more
 * furniture than a handful of rows deserve. The whole line is the link.
 */
export const TicketRow = ({ticket}: {ticket: Ticket}) => {
  const {t, i18n} = useTranslation("custom_apps");
  const when = ticket.last_message_at ?? ticket.created_at;

  return (
    <li>
      <Link
        to={customAppsRoute.ticket(ticket.id)}
        className="flex items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-3 transition-colors hover:border-neutral-700 hover:bg-neutral-800/30"
      >
        <span className="shrink-0 font-mono text-[13px] text-neutral-500">#{ticket.number}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm text-text">{ticket.subject}</span>
          <span className="block truncate text-[12px] text-neutral-500">
            {[ticket.requester_name, ticket.requester_email].filter(Boolean).join(" · ") || t("tickets.anonymous")}
          </span>
        </span>
        <UnreadCount count={ticket.unread} />
        <TicketStatusBadge value={ticket.status} />
        <span className="hidden shrink-0 text-[12px] text-neutral-500 sm:block">{formatLastSeen(when, i18n.language)}</span>
        <ArrowRight size={14} className="shrink-0 text-neutral-600" aria-hidden="true" />
      </Link>
    </li>
  );
};
