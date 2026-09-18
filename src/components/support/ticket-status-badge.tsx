import {useTranslation} from "react-i18next";
import type {TicketPriority, TicketStatus} from "@/lib/support/types.ts";

/** Colour per status, so a queue reads at a glance rather than word by word. */
const STATUS_TONE: Record<TicketStatus, string> = {
  new: "bg-accent-500/15 text-accent-200 ring-accent-500/30",
  open: "bg-sky-500/15 text-sky-200 ring-sky-500/30",
  pending: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  on_hold: "bg-neutral-500/15 text-neutral-300 ring-neutral-500/30",
  solved: "bg-emerald-500/15 text-emerald-200 ring-emerald-500/30",
  closed: "bg-neutral-700/40 text-neutral-400 ring-neutral-600/40",
  spam: "bg-red-500/15 text-red-200 ring-red-500/30",
};

const PRIORITY_TONE: Record<TicketPriority, string> = {
  low: "bg-neutral-700/40 text-neutral-400 ring-neutral-600/40",
  normal: "bg-neutral-700/40 text-neutral-300 ring-neutral-600/40",
  high: "bg-amber-500/15 text-amber-200 ring-amber-500/30",
  urgent: "bg-red-500/15 text-red-200 ring-red-500/30",
};

const base = "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ring-inset";

export const TicketStatusBadge = ({status}: {status: TicketStatus}) => {
  const {t} = useTranslation("support");
  return <span className={`${base} ${STATUS_TONE[status] ?? STATUS_TONE.open}`}>{t(`ticket.statuses.${status}`)}</span>;
};

export const TicketPriorityBadge = ({priority}: {priority: TicketPriority}) => {
  const {t} = useTranslation("support");
  /* Normal is the default and says nothing; drawing a chip for it is noise in a list of forty. */
  if (priority === "normal" || priority === "low") return null;
  return <span className={`${base} ${PRIORITY_TONE[priority]}`}>{t(`ticket.priorities.${priority}`)}</span>;
};
