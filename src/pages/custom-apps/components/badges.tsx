import type {ReactNode} from "react";
import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils.ts";

/*
 * The panel's tones. The same four as the shared `StatusBadge`, plus one cool tone for maintenance,
 * which is planned rather than wrong and should not read as a warning. Every badge carries its word
 * as well as its colour, so no state is told apart by hue alone.
 */
const TONES = {
  good: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  pending: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  planned: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  bad: "border-red-500/40 bg-red-500/10 text-red-300",
  inert: "border-neutral-700 bg-neutral-800/60 text-neutral-400",
} as const;

export type Tone = keyof typeof TONES;

export const Pill = ({tone, children, className}: {tone: Tone; children: ReactNode; className?: string}) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 rounded-[var(--radius-sm)] border px-2 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap",
      TONES[tone],
      className,
    )}
  >
    <span className="size-1.5 rounded-full bg-current opacity-80" aria-hidden="true" />
    {children}
  </span>
);

const STATE_TONES: Record<string, Tone> = {
  active: "good",
  grace: "pending",
  maintenance: "planned",
  suspended: "bad",
};

/**
 * An app's state, or an installation's effective one. An unknown state shows verbatim. `count`
 * prefixes a tally, for "3 active" on the overview.
 */
export const StateBadge = ({state, count, className}: {state: string; count?: number; className?: string}) => {
  const {t} = useTranslation("custom_apps");
  return (
    <Pill tone={STATE_TONES[state] ?? "inert"} className={className}>
      {count !== undefined && <span className="tabular-nums">{count}</span>}
      {t(`states.${state}`, {defaultValue: state})}
    </Pill>
  );
};

/** An app key or an installation: in force, or revoked for good. */
export const LifecycleBadge = ({status}: {status: string}) => {
  const {t} = useTranslation("custom_apps");
  return (
    <Pill tone={status === "active" ? "good" : status === "revoked" ? "bad" : "inert"}>
      {t(`lifecycle.${status}`, {defaultValue: status})}
    </Pill>
  );
};

export const ReviewBadge = () => {
  const {t} = useTranslation("custom_apps");
  return <Pill tone="pending">{t("installations.needs_review")}</Pill>;
};

/**
 * Connected or not, as a dot and a word. The dot pulses while connected — the one thing on these
 * screens that is live, and the one a glance down a table is looking for.
 */
export const ConnectedIndicator = ({connected, compact}: {connected: boolean; compact?: boolean}) => {
  const {t} = useTranslation("custom_apps");
  const label = connected ? t("installations.connected") : t("installations.offline");

  return (
    <span className="inline-flex items-center gap-2 text-[13px]" title={label}>
      <span className="relative flex size-2.5 shrink-0" aria-hidden="true">
        {connected && <span className="absolute inset-0 animate-ping rounded-full bg-emerald-400 opacity-60" />}
        <span className={cn("relative size-2.5 rounded-full", connected ? "bg-emerald-400" : "bg-neutral-600")} />
      </span>
      <span className={cn(compact && "sr-only", connected ? "text-emerald-300" : "text-neutral-500")}>{label}</span>
    </span>
  );
};

export const RoleChips = ({roles}: {roles: string[]}) => {
  const {t} = useTranslation("custom_apps");
  if (roles.length === 0) return <span className="text-[13px] text-neutral-600">{t("roles.none")}</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {roles.map((role) => (
        <span
          key={role}
          className="rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-800/50 px-2 py-0.5 text-[11px] text-neutral-300"
        >
          {t(`roles.${role}`, {defaultValue: role})}
        </span>
      ))}
    </span>
  );
};

/**
 * The live connection a socket-mode device holds, beside the connected dot. It is what lets a
 * command reach the device at once instead of on its next heartbeat.
 */
export const SocketBadge = () => {
  const {t} = useTranslation("custom_apps");
  return (
    <span title={t("installations.socket_title")}>
      <Pill tone="good">{t("installations.socket")}</Pill>
    </span>
  );
};

/**
 * One badge per status vocabulary of phase two. Each maps its words onto the panel's tones and
 * falls back to the word itself, so a status the service adds later still reads.
 */
const VocabularyPill = ({
  prefix,
  tones,
  value,
  className,
}: {
  prefix: string;
  tones: Record<string, Tone>;
  value: string;
  className?: string;
}) => {
  const {t} = useTranslation("custom_apps");
  return (
    <Pill tone={tones[value] ?? "inert"} className={className}>
      {t(`${prefix}.${value}`, {defaultValue: value})}
    </Pill>
  );
};

type VocabularyBadgeProps = {value: string; className?: string};

const COMMAND_TONES: Record<string, Tone> = {
  pending: "pending",
  delivered: "planned",
  succeeded: "good",
  failed: "bad",
  expired: "inert",
  cancelled: "inert",
};
const LOG_TONES: Record<string, Tone> = {debug: "inert", info: "planned", warning: "pending", error: "bad", fatal: "bad"};
const SEVERITY_TONES: Record<string, Tone> = {info: "planned", warning: "pending", critical: "bad"};
const MESSAGE_TONES: Record<string, Tone> = {active: "good", scheduled: "planned", ended: "inert"};
const CRASH_TONES: Record<string, Tone> = {open: "bad", resolved: "good", ignored: "inert"};
const ALERT_TONES: Record<string, Tone> = {open: "bad", acknowledged: "pending", resolved: "good"};
const RELEASE_TONES: Record<string, Tone> = {draft: "inert", published: "good", paused: "pending", withdrawn: "bad"};
const UPDATE_REPORT_TONES: Record<string, Tone> = {
  downloaded: "planned",
  installed: "planned",
  health_ok: "good",
  rolled_back: "bad",
  failed: "bad",
};

export const CommandStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="command_statuses" tones={COMMAND_TONES} {...props} />
);

export const LogLevelBadge = (props: VocabularyBadgeProps) => <VocabularyPill prefix="log_levels" tones={LOG_TONES} {...props} />;

export const SeverityBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="severities" tones={SEVERITY_TONES} {...props} />
);

export const MessageStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="message_statuses" tones={MESSAGE_TONES} {...props} />
);

export const CrashStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="crash_statuses" tones={CRASH_TONES} {...props} />
);

export const AlertStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="alert_statuses" tones={ALERT_TONES} {...props} />
);

export const ReleaseStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="release_statuses" tones={RELEASE_TONES} {...props} />
);

export const UpdateReportStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="update_report_statuses" tones={UPDATE_REPORT_TONES} {...props} />
);

const CONTRACT_TONES: Record<string, Tone> = {
  scheduled: "planned",
  active: "good",
  grace: "pending",
  ended: "inert",
  cancelled: "bad",
};
/* An open cycle is running, a closed one waits to be billed, a billed one is done. */
const CYCLE_TONES: Record<string, Tone> = {open: "planned", closed: "pending", billed: "good"};

export const ContractStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="contract_statuses" tones={CONTRACT_TONES} {...props} />
);

export const CycleStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="cycle_statuses" tones={CYCLE_TONES} {...props} />
);

/*
 * A ticket waiting on us is the one that needs somebody; waiting on the client is planned rather than
 * wrong; resolved is done, and closed is done for good.
 */
const TICKET_TONES: Record<string, Tone> = {open: "pending", pending: "planned", resolved: "good", closed: "inert"};

export const TicketStatusBadge = (props: VocabularyBadgeProps) => (
  <VocabularyPill prefix="ticket_statuses" tones={TICKET_TONES} {...props} />
);

/**
 * A contract ending within its notice period without renewing itself, with the days it has left —
 * the one thing about a contract worth catching at a glance down a list.
 */
export const ExpiringBadge = ({daysLeft}: {daysLeft: number | null}) => {
  const {t} = useTranslation("custom_apps");
  return (
    <Pill tone="pending">
      {daysLeft === null ? t("contracts.expiring") : t("contracts.expiring_days", {count: daysLeft})}
    </Pill>
  );
};

/*
 * A maintenance waiting on the client or on nobody-answered is the one that needs somebody; scheduled
 * and running are planned rather than wrong; completed is done, failed is bad, cancelled is inert.
 */
const MAINTENANCE_TONES: Record<string, Tone> = {
  draft: "inert",
  pending_approval: "pending",
  scheduled: "planned",
  in_progress: "planned",
  completed: "good",
  failed: "bad",
  no_response: "pending",
  cancelled: "inert",
};

/** A maintenance's status — and, for a draft the client sent back, that it was rejected. */
export const MaintenanceStatusBadge = ({value, rejected, className}: VocabularyBadgeProps & {rejected?: boolean}) => {
  const {t} = useTranslation("custom_apps");
  if (rejected && value === "draft") {
    return (
      <Pill tone="bad" className={className}>
        {t("maintenances.rejected_badge")}
      </Pill>
    );
  }
  return <VocabularyPill prefix="maintenance_statuses" tones={MAINTENANCE_TONES} value={value} className={className} />;
};

/** Normal or security: a security patch is applied without approval, so it is the one painted. */
export const MaintenanceKindBadge = ({value, className}: VocabularyBadgeProps) => (
  <VocabularyPill prefix="maintenance_kinds" tones={{normal: "inert", security: "bad"}} value={value} className={className} />
);
