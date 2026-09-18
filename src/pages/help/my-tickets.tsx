import {useCallback, useEffect} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Spinner} from "@/components/ui/spinner.tsx";
import {TicketStatusBadge} from "@/components/support/ticket-status-badge.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {supportContent} from "@/lib/support/content.ts";

/**
 * The signed-in half of the hybrid identity: tickets under this account, without a link.
 *
 * It claims first and lists second, and the order matters. The support service cannot ask the auth
 * database whether an address has an account — it has no binding into it and must never get one — so
 * a verified token arriving on a request is the only moment a ticket opened anonymously can be
 * linked to its owner at all. Claiming is idempotent, so doing it on every visit costs one statement
 * and means somebody who opened a ticket before signing up still finds it here.
 */
export const MyTickets = () => {
  const {t, i18n} = useTranslation("support");
  const locale = i18n.resolvedLanguage ?? "en";

  const tickets = useResource(useCallback((signal: AbortSignal) => supportContent.myTickets(signal), []));
  const reload = tickets.reload;

  useEffect(() => {
    let cancelled = false;
    supportContent
      .claimTickets()
      .then((result) => {
        /* Only re-read when something actually changed; otherwise this is a pointless second call. */
        if (!cancelled && result.claimed > 0) reload();
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [reload]);

  return (
    <section className="flex flex-col gap-6">
      <h1 className="font-display text-xl text-text">{t("ticket.mine_title")}</h1>

      {tickets.loading ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : null}

      {!tickets.loading && (tickets.data?.length ?? 0) === 0 ? (
        <div className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-6 text-center">
          <p className="text-sm text-neutral-400">{t("ticket.mine_empty")}</p>
          <Link
            to={helpRoute.newTicket}
            className="mt-4 inline-block rounded-[var(--radius-sm)] bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
          >
            {t("help.open_ticket")}
          </Link>
        </div>
      ) : null}

      <ul className="flex flex-col gap-2">
        {tickets.data?.map((ticket) => (
          <li key={ticket.reference}>
            <Link
              to={helpRoute.ticket(ticket.reference)}
              className="flex flex-wrap items-center gap-3 rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-4 transition-colors hover:border-accent-500/40"
            >
              <span className="font-mono text-xs text-neutral-500">{ticket.reference}</span>
              <span className="flex-1 text-sm text-text">{ticket.subject}</span>
              <TicketStatusBadge status={ticket.status} />
              <span className="text-xs text-neutral-500">{formatDateTime(ticket.updated_at, locale)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
};
