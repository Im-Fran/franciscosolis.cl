import {useCallback, useRef, useState} from "react";
import type {ChangeEvent, FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useParams} from "react-router-dom";
import {Check, Trash, UserCircle, X} from "@phosphor-icons/react";
import {ConfirmDialog} from "@/components/admin/confirm-dialog.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {TicketPriorityBadge, TicketStatusBadge} from "@/components/support/ticket-status-badge.tsx";
import {TicketTimeline} from "@/components/support/ticket-timeline.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import {supportRoute} from "@/lib/support/config.ts";
import {useSupport} from "@/lib/support/support-context.ts";
import type {MessageKind, ParticipantTag, TicketPriority, TicketStatus} from "@/lib/support/types.ts";
import {AssistPanel} from "@/pages/support/components/assist-panel.tsx";

/**
 * Whether the cursor sits right after an in-progress `@mention`, and what has been typed of it.
 *
 * Only a mention that starts a "word" counts — `foo@bar` is an email a support agent might well be
 * pasting, not a mention of `bar` — and the query itself must be whitespace-free, since a mention
 * is one token.
 */
const detectMention = (value: string, cursor: number): {start: number; query: string} | null => {
  const upToCursor = value.slice(0, cursor);
  const at = upToCursor.lastIndexOf("@");
  if (at === -1) return null;
  const before = upToCursor[at - 1];
  if (before !== undefined && /\S/.test(before)) return null;
  const query = upToCursor.slice(at + 1);
  if (/\s/.test(query)) return null;
  return {start: at, query};
};

/**
 * One ticket, as the team works it: the whole thread including internal notes, the composer, and
 * everything about the ticket that is editable.
 *
 * The composer's two modes are visually distinct on purpose. A reply goes to everybody on the ticket
 * and starts the thirty-minute clock; a note never leaves the team and sends nothing. Getting that
 * wrong is not a glitch — it is telling a customer what you thought of their email.
 */
export const TicketDetail = () => {
  const {t, i18n} = useTranslation(["support_agent", "support"]);
  const {id = ""} = useParams();
  const navigate = useNavigate();
  const {notify} = useToast();
  const {status: service, labels, agent, canAdminister} = useSupport();
  const locale = i18n.resolvedLanguage ?? "en";

  const [draft, setDraft] = useState("");
  const [kind, setKind] = useState<MessageKind>("reply");
  const [renaming, setRenaming] = useState<string | null>(null);
  const [participantEmail, setParticipantEmail] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [mention, setMention] = useState<{start: number; query: string} | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const ticket = useResource(useCallback((signal: AbortSignal) => supportApi.tickets.get(id, signal), [id]));
  const timeline = useResource(useCallback((signal: AbortSignal) => supportApi.tickets.timeline(id, signal), [id]));

  const reloadAll = () => {
    ticket.reload();
    timeline.reload();
  };

  const post = useMutation(
    useCallback((body: string, messageKind: MessageKind) => supportApi.tickets.reply(id, body, messageKind), [id]),
  );
  const patch = useMutation(
    useCallback(
      (payload: Partial<{subject: string; status: TicketStatus; priority: TicketPriority}>) =>
        supportApi.tickets.update(id, payload),
      [id],
    ),
  );
  const assign = useMutation(useCallback((email: string | null) => supportApi.tickets.assign(id, email), [id]));
  const toggleLabel = useMutation(
    useCallback(
      (labelId: string, on: boolean) =>
        on ? supportApi.tickets.addLabel(id, labelId) : supportApi.tickets.removeLabel(id, labelId),
      [id],
    ),
  );
  const addParticipant = useMutation(
    useCallback((email: string) => supportApi.tickets.addParticipant(id, email), [id]),
  );
  const removeParticipant = useMutation(
    useCallback((participantId: string) => supportApi.tickets.removeParticipant(id, participantId), [id]),
  );
  const setParticipantTag = useMutation(
    useCallback(
      (participantId: string, tag: ParticipantTag | null) => supportApi.tickets.setParticipantTag(id, participantId, tag),
      [id],
    ),
  );
  const remove = useMutation(useCallback(() => supportApi.tickets.remove(id), [id]));

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const body = draft.trim();
    if (body.length === 0) return;
    const outcome = await post.run(body, kind);
    if (outcome.ok) {
      setDraft("");
      reloadAll();
    }
  };

  const applied = new Set((ticket.data?.labels ?? []).map((label) => label.id));

  /*
   * Only the very first load — no data on screen yet — earns the full-panel spinner. Every action
   * here (assign, status, priority, a label, a reply) calls `reloadAll()`, which flips `loading`
   * back to `true`; gating on that alone replaced the whole panel with a spinner on every click,
   * which read as the page reloading rather than as one field updating. Once there is data, a
   * background reload keeps it on screen and swaps it in when the fetch resolves.
   */
  if (ticket.loading && !ticket.data) {
    return (
      <div className="flex justify-center py-12">
        <Spinner />
      </div>
    );
  }

  if (!ticket.data) {
    return <Alert tone="error">{ticket.error ?? t("errors.generic")}</Alert>;
  }

  const data = ticket.data;

  const mentionCandidates =
    mention === null
      ? []
      : data.participants
          .filter(
            (participant) =>
              participant.email.toLowerCase().includes(mention.query.toLowerCase()) ||
              (participant.name ?? "").toLowerCase().includes(mention.query.toLowerCase()),
          )
          .slice(0, 6);

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setDraft(event.target.value);
    setMention(detectMention(event.target.value, event.target.selectionStart ?? event.target.value.length));
  };

  const insertMention = (email: string) => {
    if (mention === null) return;
    const before = draft.slice(0, mention.start);
    const after = draft.slice(mention.start + 1 + mention.query.length);
    const next = `${before}@${email} ${after}`;
    setDraft(next);
    setMention(null);
    requestAnimationFrame(() => {
      const cursor = before.length + email.length + 2;
      textareaRef.current?.focus();
      textareaRef.current?.setSelectionRange(cursor, cursor);
    });
  };

  return (
    <section className="flex flex-col gap-6">
      <PageHeader
        title={data.subject}
        description={`${data.reference} · ${data.requester_email}`}
        back={{to: supportRoute.inbox, label: t("nav.inbox")}}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setRenaming(data.subject)}
          >
            {t("ticket.rename")}
          </Button>
        }
      />

      {renaming !== null ? (
        <form
          onSubmit={async (event) => {
            event.preventDefault();
            const outcome = await patch.run({subject: renaming.trim()});
            if (outcome.ok) {
              setRenaming(null);
              notify(t("ticket.saved"));
              reloadAll();
            }
          }}
          className="flex gap-2"
        >
          <Input value={renaming} onChange={(event) => setRenaming(event.target.value)} className="flex-1" />
          <Button type="submit" size="sm" disabled={patch.pending}>
            <Check size={15} />
          </Button>
          <Button type="button" variant="ghost" size="sm" onClick={() => setRenaming(null)}>
            <X size={15} />
          </Button>
        </form>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-6">
          {data.ai_summary ? (
            <aside className="rounded-[var(--radius-md)] border border-neutral-800 bg-neutral-900/40 p-4">
              <p className="text-xs font-medium tracking-wide text-neutral-500 uppercase">{t("ticket.summary")}</p>
              <p className="mt-1.5 text-sm text-neutral-300">{data.ai_summary}</p>
              <p className="mt-2 text-xs text-neutral-600">{t("ticket.summary_hint")}</p>
            </aside>
          ) : null}

          <TicketTimeline entries={timeline.data ?? []} locale={locale} />

          <form onSubmit={send} className="flex flex-col gap-3">
            <div className="flex gap-2" role="group">
              {(["reply", "note"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setKind(value)}
                  className={[
                    "rounded-[var(--radius-sm)] px-3 py-1.5 text-sm transition-colors",
                    kind === value
                      ? value === "note"
                        ? "bg-amber-500/15 text-amber-200 ring-1 ring-amber-500/30 ring-inset"
                        : "bg-accent-900/50 text-accent-200 ring-1 ring-accent-500/30 ring-inset"
                      : "text-neutral-400 hover:text-text",
                  ].join(" ")}
                >
                  {t(`ticket.${value}`)}
                </button>
              ))}
            </div>

            <p className="text-xs text-neutral-500">{kind === "note" ? t("ticket.note_hint") : t("ticket.reply_hint")}</p>

            <div className="relative">
              <textarea
                ref={textareaRef}
                value={draft}
                onChange={handleDraftChange}
                onBlur={() => setMention(null)}
                rows={6}
                className={[
                  "w-full rounded-[var(--radius-sm)] border bg-neutral-900/60 px-3 py-2 text-sm text-text focus:outline-none",
                  kind === "note"
                    ? "border-amber-500/40 focus:border-amber-400"
                    : "border-neutral-700 focus:border-accent-500",
                ].join(" ")}
              />

              {mention !== null && mentionCandidates.length > 0 ? (
                <ul className="absolute z-10 mt-1 w-64 max-w-full overflow-hidden rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-900 shadow-lg">
                  {mentionCandidates.map((participant) => (
                    <li key={participant.id}>
                      {/* `onMouseDown` rather than `onClick`: a click fires after the textarea's own
                          `blur`, which would already have cleared `mention` and hidden this list. */}
                      <button
                        type="button"
                        onMouseDown={(event) => {
                          event.preventDefault();
                          insertMention(participant.email);
                        }}
                        className="block w-full truncate px-3 py-1.5 text-left text-xs text-neutral-300 hover:bg-neutral-800"
                      >
                        {participant.name ? `${participant.name} · ${participant.email}` : participant.email}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            {post.error ? <Alert tone="error">{post.error}</Alert> : null}

            <Button type="submit" disabled={post.pending || draft.trim().length === 0} className="self-end">
              {post.pending ? t("ticket.sending") : t("ticket.send")}
            </Button>
          </form>

          {canAdminister ? (
            <AssistPanel
              ticketId={data.id}
              locale={data.locale}
              /* Appends rather than replaces: an agent who already started typing must not lose it. */
              onInsert={(text) => setDraft((current) => (current.trim().length > 0 ? `${current}\n\n${text}` : text))}
            />
          ) : null}
        </div>

        <aside className="flex flex-col gap-5 text-sm">
          <div className="flex flex-col gap-1.5">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("ticket.status")}</span>
            <Select
              value={data.status}
              onChange={async (event) => {
                const outcome = await patch.run({status: event.target.value as TicketStatus});
                if (outcome.ok) reloadAll();
              }}
            >
              {(service?.ticket_statuses ?? []).map((value) => (
                <option key={value} value={value}>
                  {t(`support:ticket.statuses.${value}`)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("ticket.priority")}</span>
            <Select
              value={data.priority}
              onChange={async (event) => {
                const outcome = await patch.run({priority: event.target.value as TicketPriority});
                if (outcome.ok) reloadAll();
              }}
            >
              {(service?.ticket_priorities ?? []).map((value) => (
                <option key={value} value={value}>
                  {t(`support:ticket.priorities.${value}`)}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("ticket.assignee")}</span>
            <p className="text-neutral-300">{data.assignee_email ?? <span className="text-neutral-600">{t("ticket.unassigned")}</span>}</p>
            {data.assignee_email === agent?.email ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const outcome = await assign.run(null);
                  if (outcome.ok) reloadAll();
                }}
              >
                <X size={14} /> {t("ticket.unassign")}
              </Button>
            ) : (
              <Button
                variant="ghost"
                size="sm"
                onClick={async () => {
                  const outcome = await assign.run(agent?.email ?? null);
                  if (outcome.ok) reloadAll();
                }}
              >
                <UserCircle size={14} /> {t("ticket.assign_me")}
              </Button>
            )}
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("ticket.labels")}</span>
            <ul className="flex flex-wrap gap-1.5">
              {labels.map((label) => {
                const on = applied.has(label.id);
                return (
                  <li key={label.id}>
                    <button
                      type="button"
                      onClick={async () => {
                        const outcome = await toggleLabel.run(label.id, !on);
                        if (outcome.ok) reloadAll();
                      }}
                      className={[
                        "rounded-full px-2.5 py-0.5 text-xs ring-1 ring-inset transition-colors",
                        on ? "bg-accent-500/15 text-accent-200 ring-accent-500/30" : "text-neutral-500 ring-neutral-700",
                      ].join(" ")}
                    >
                      {label.name}
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-xs tracking-wide text-neutral-500 uppercase">{t("ticket.participants")}</span>
            <ul className="flex flex-col gap-1">
              {data.participants.map((participant) => (
                <li key={participant.id} className="flex items-center gap-2 text-xs text-neutral-400">
                  <span className="flex-1 truncate">{participant.email}</span>
                  {participant.role === "requester" ? (
                    <span className="text-neutral-600">{t("ticket.requester")}</span>
                  ) : (
                    <>
                      <Select
                        value={participant.tag ?? ""}
                        onChange={async (event) => {
                          const value = event.target.value as ParticipantTag | "";
                          const outcome = await setParticipantTag.run(participant.id, value === "" ? null : value);
                          if (outcome.ok) reloadAll();
                        }}
                        className="h-7 w-auto px-2 py-0 text-[11px]"
                        aria-label={t("ticket.participants")}
                      >
                        <option value="">{t("ticket.participant_tag_none")}</option>
                        <option value="guest">{t("ticket.participant_tag_guest")}</option>
                        <option value="interest">{t("ticket.participant_tag_interest")}</option>
                      </Select>
                      <button
                        type="button"
                        onClick={async () => {
                          const outcome = await removeParticipant.run(participant.id);
                          if (outcome.ok) reloadAll();
                        }}
                        className="text-neutral-600 hover:text-red-300"
                        aria-label={t("ticket.remove")}
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </li>
              ))}
            </ul>

            <form
              onSubmit={async (event) => {
                event.preventDefault();
                const outcome = await addParticipant.run(participantEmail.trim());
                if (outcome.ok) {
                  setParticipantEmail("");
                  reloadAll();
                }
              }}
              className="flex gap-1.5"
            >
              <Input
                type="email"
                value={participantEmail}
                onChange={(event) => setParticipantEmail(event.target.value)}
                placeholder={t("ticket.participant_email")}
                className="flex-1 text-xs"
              />
              <Button type="submit" size="sm" disabled={addParticipant.pending}>
                <Check size={14} />
              </Button>
            </form>
            {addParticipant.error ? <p className="text-xs text-red-300">{addParticipant.error}</p> : null}
          </div>

          <div className="flex flex-col gap-1 border-t border-neutral-800 pt-4 text-xs text-neutral-500">
            <span>
              {t("ticket.opened")}: {formatDateTime(data.created_at, locale)}
            </span>
            <span className="flex items-center gap-1.5">
              <TicketStatusBadge status={data.status} />
              <TicketPriorityBadge priority={data.priority} />
            </span>
          </div>

          {canAdminister ? (
            <Button variant="ghost" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash size={14} /> {t("ticket.delete")}
            </Button>
          ) : null}
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        title={t("ticket.delete")}
        body={t("ticket.delete_confirm")}
        confirmLabel={t("ticket.delete")}
        pending={remove.pending}
        error={remove.error}
        onClose={() => setConfirmDelete(false)}
        onConfirm={async () => {
          const outcome = await remove.run();
          if (outcome.ok) {
            notify(t("ticket.deleted"));
            navigate(supportRoute.inbox);
          }
        }}
      />
    </section>
  );
};
