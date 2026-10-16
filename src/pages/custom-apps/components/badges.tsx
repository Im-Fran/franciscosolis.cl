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
