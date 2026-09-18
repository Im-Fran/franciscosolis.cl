import {useCallback, useEffect, useLayoutEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link, useParams} from "react-router-dom";
import {ArrowLeft} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {TicketStatusBadge} from "@/components/support/ticket-status-badge.tsx";
import {TicketTimeline} from "@/components/support/ticket-timeline.tsx";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {supportContent} from "@/lib/support/content.ts";
import {captureTicketToken} from "@/lib/support/ticket-token.ts";

/**
 * One ticket, as the person who opened it sees it.
 *
 * The first thing this screen does is take the secret out of the URL fragment. That has to happen in
 * a layout effect, before the first paint: the fragment is safe only while it is *in* the fragment,
 * and a third-party script or an outbound link with a `Referer` only has to see it once.
 */
export const TicketThread = () => {
  const {t, i18n} = useTranslation("support");
  const {reference = ""} = useParams();
  const locale = i18n.resolvedLanguage ?? "en";
  const [ready, setReady] = useState(false);
  const [resendEmail, setResendEmail] = useState("");
  const [resent, setResent] = useState(false);
  const [draft, setDraft] = useState("");

  useLayoutEffect(() => {
    captureTicketToken(reference);
    setReady(true);
  }, [reference]);

  const ticket = useResource(
    useCallback(
      (signal: AbortSignal) =>
        ready ? supportContent.ticket(reference, signal) : new Promise<never>(() => undefined),
      [reference, ready],
    ),
  );
  const timeline = useResource(
    useCallback(
      (signal: AbortSignal) =>
        ready && ticket.data ? supportContent.timeline(reference, signal) : Promise.resolve([]),
      [reference, ready, ticket.data],
    ),
  );

  const reply = useMutation(useCallback((body: string) => supportContent.reply(reference, body), [reference]));
  const resend = useMutation(
    useCallback((email: string) => supportContent.resendLink(reference, email), [reference]),
  );

  const reloadTimeline = timeline.reload;
  const reloadTicket = ticket.reload;

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body.length === 0) return;
    const outcome = await reply.run(body);
    if (outcome.ok) {
      setDraft("");
      reloadTimeline();
      reloadTicket();
    }
  };

  useEffect(() => {
    if (resend.status !== null) setResent(true);
  }, [resend.status]);

  if (!ready) return null;

  /*
   * A ticket the caller is not entitled to and a ticket that does not exist answer identically —
   * ticket numbers are short and sequential, so anything else would be an oracle over every request
   * ever filed. So this screen cannot tell them apart either, and offers the one thing that helps in
   * both cases: a fresh link to the address the ticket was opened with.
   */
  if (ticket.status === 404) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16">
        <h1 className="font-display text-xl text-text">{t("ticket.no_access_title")}</h1>
        <p className="mt-3 text-sm text-neutral-400">{t("ticket.no_access_lead")}</p>

        {resent ? (
          <Alert tone="info" className="mt-6">
            {t("ticket.resent")}
          </Alert>
        ) : (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void resend.run(resendEmail.trim());
            }}
            className="mt-6 flex flex-col gap-3"
            noValidate
          >
            <label className="flex flex-col gap-1.5">
              <span className="text-sm text-neutral-300">{t("ticket.resend_email")}</span>
              <Input type="email" value={resendEmail} onChange={(event) => setResendEmail(event.target.value)} required />
            </label>
            <Button type="submit" disabled={resend.pending}>
              {t("ticket.resend")}
            </Button>
          </form>
        )}

        <Link to={helpRoute.home} className="mt-8 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-text">
          <ArrowLeft size={14} aria-hidden />
          {t("help.back_to_help")}
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-12">
      <Link to={helpRoute.home} className="mb-6 inline-flex items-center gap-1.5 text-sm text-neutral-400 hover:text-text">
        <ArrowLeft size={14} aria-hidden />
        {t("help.back_to_help")}
      </Link>

      {ticket.loading && !ticket.data ? (
        <div className="flex justify-center py-8">
          <Spinner />
        </div>
      ) : null}

      {/* Anything that is not a 404 — the service unreachable, a 500, a truncated body — used to
          render as an empty page under the back link, because the only branches here were
          "loading" and "have a ticket". This is the screen somebody lands on from a support
          email, and one that says nothing at all is indistinguishable from a broken one. */}
      {!ticket.loading && !ticket.data && ticket.error ? (
        <Alert tone="error" title={t("ticket.unavailable_title")} className="mt-2">
          <div className="flex flex-col items-start gap-3">
            <span>{t("ticket.unavailable_lead")}</span>
            <Button variant="secondary" size="sm" onClick={ticket.reload}>
              {t("ticket.retry")}
            </Button>
          </div>
        </Alert>
      ) : null}

      {ticket.data ? (
        <>
          <header className="mb-8 border-b border-neutral-800 pb-6">
            <p className="font-mono text-xs text-neutral-500">{ticket.data.reference}</p>
            <h1 className="mt-1 font-display text-2xl text-text">{ticket.data.subject}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-neutral-500">
              <TicketStatusBadge status={ticket.data.status} />
              <span>
                {t("ticket.opened")}: {formatDateTime(ticket.data.created_at, locale)}
              </span>
              <span>
                {t("ticket.updated")}: {formatDateTime(ticket.data.updated_at, locale)}
              </span>
            </div>
            {ticket.data.labels.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {ticket.data.labels.map((label) => (
                  <li
                    key={label.id}
                    className="rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset"
                    style={{
                      color: label.color ?? undefined,
                      borderColor: label.color ?? undefined,
                    }}
                  >
                    {label.name}
                  </li>
                ))}
              </ul>
            ) : null}
          </header>

          <TicketTimeline entries={timeline.data ?? []} locale={locale} />

          {ticket.data.status !== "closed" ? (
            <form onSubmit={send} className="mt-8 flex flex-col gap-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder={t("ticket.reply_placeholder")}
                rows={5}
                className="w-full rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-text placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none"
              />
              {reply.error ? <Alert tone="error">{reply.error}</Alert> : null}
              <Button type="submit" disabled={reply.pending || draft.trim().length === 0} className="self-end">
                {reply.pending ? t("ticket.replying") : t("ticket.reply_action")}
              </Button>
            </form>
          ) : null}
        </>
      ) : null}
    </div>
  );
};
