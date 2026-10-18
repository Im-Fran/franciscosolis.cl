import {formatDuration, formatNumber, formatPercent} from "@/lib/custom-apps/format.ts";
import type {AlertKind} from "@/lib/custom-apps/types.ts";

/**
 * What an alert rule's threshold means, kind by kind. The service validates the same bounds; they
 * are restated here so the form can say what a number means before it is sent, not after.
 */

export type ThresholdUnit = "minutes" | "percent" | "count" | "days";

export const thresholdUnit = (kind: AlertKind | string): ThresholdUnit => {
  switch (kind) {
    case "installation_offline":
      return "minutes";
    case "cpu_high":
    case "memory_high":
    case "cycle_hours_low":
      return "percent";
    case "contract_expiring":
      return "days";
    default:
      return "count";
  }
};

/** Inclusive bounds of a threshold, as the service enforces them per kind. */
export const thresholdBounds = (kind: AlertKind | string) => {
  if (kind === "error_log_spike") return {min: 1, max: 1_000_000};
  /* "Percent of the cycle's hours left": 0 % fires once they are all spent. */
  if (kind === "cycle_hours_low") return {min: 0, max: 100};
  switch (thresholdUnit(kind)) {
    case "minutes":
      return {min: 1, max: 10_080};
    case "days":
      return {min: 1, max: 365};
    case "percent":
      return {min: 1, max: 100};
    default:
      return {min: 1, max: 100_000};
  }
};

/** A sensible starting threshold for a new rule of this kind. */
export const defaultThreshold = (kind: AlertKind | string) => {
  switch (kind) {
    case "installation_offline":
      return 30;
    case "cpu_high":
    case "memory_high":
      return 90;
    case "enrollment_spike":
      return 10;
    case "release_rollbacks":
      return 3;
    case "contract_expiring":
      return 30;
    case "cycle_hours_low":
      return 20;
    default:
      return 5;
  }
};

/**
 * Whether the rule reads a window at all. "Offline for 30 minutes" is a duration on its own, and the
 * contract kinds read a date and a balance; the others are "over N in the last W minutes", or an
 * average over W.
 */
export const usesWindow = (kind: AlertKind | string) =>
  kind !== "installation_offline" && kind !== "contract_expiring" && kind !== "cycle_hours_low";

/** The kinds that watch a contract rather than a device: their alerts link to the contract. */
export const isContractKind = (kind: AlertKind | string) => kind === "contract_expiring" || kind === "cycle_hours_low";

export const WINDOW_BOUNDS = {min: 5, max: 1440, default: 15} as const;

/** A measured value or a threshold, in the unit its kind is read in. */
export const formatAlertValue = (kind: AlertKind | string, value: number | null | undefined, language: string) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  switch (thresholdUnit(kind)) {
    case "minutes":
      return formatDuration(value * 60);
    case "percent":
      return formatPercent(value, language, 1);
    case "days":
      return `${formatNumber(value, language)} d`;
    default:
      return formatNumber(value, language);
  }
};
