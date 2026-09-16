import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils.ts";

/**
 * Every lifecycle value an administration panel shows — a content status, an email's delivery state,
 * an invitation, a client secret — rendered the same way, so a colour means one thing everywhere.
 *
 * The API types these as plain strings, so an unknown value is shown verbatim in the neutral tone
 * rather than dropped: a state the service adds later still reads correctly here.
 */
const GOOD = "border-emerald-500/40 bg-emerald-500/10 text-emerald-300";
const PENDING = "border-amber-500/40 bg-amber-500/10 text-amber-300";
const BAD = "border-red-500/40 bg-red-500/10 text-red-300";
const INERT = "border-neutral-700 bg-neutral-800/60 text-neutral-400";

const tones: Record<string, string> = {
  /* CMS: content, legal documents and the delivery state of an email. */
  published: GOOD,
  sent: GOOD,
  draft: PENDING,
  queued: PENDING,
  failed: BAD,
  archived: INERT,
  /* Auth: accounts, invitations, client applications and their secrets. */
  active: GOOD,
  accepted: GOOD,
  pending: PENDING,
  expiring: PENDING,
  disabled: INERT,
  inactive: INERT,
  expired: INERT,
  revoked: BAD,
};

export const StatusBadge = ({status, className}: {status: string; className?: string}) => {
  const {t} = useTranslation();
  const key = status?.toLowerCase() ?? "";

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium tracking-wide",
        tones[key] ?? "border-neutral-700 bg-neutral-800/60 text-neutral-300",
        className,
      )}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true"/>
      {t(`admin:status.${key}`, {defaultValue: status})}
    </span>
  );
};
