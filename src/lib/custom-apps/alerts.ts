import {formatDuration, formatNumber, formatPercent} from "@/lib/custom-apps/format.ts";
import type {AlertKind} from "@/lib/custom-apps/types.ts";

/**
 * What an alert rule's threshold means, kind by kind. The service validates the same bounds; they
 * are restated here so the form can say what a number means before it is sent, not after.
 */

export type ThresholdUnit = "minutes" | "percent" | "count";

export const thresholdUnit = (kind: AlertKind | string): ThresholdUnit => {
  switch (kind) {
    case "installation_offline":
      return "minutes";
    case "cpu_high":
    case "memory_high":
      return "percent";
    default:
      return "count";
  }
};

/** Inclusive bounds of a threshold, as the service enforces them per kind. */
export const thresholdBounds = (kind: AlertKind | string) => {
  if (kind === "error_log_spike") return {min: 1, max: 1_000_000};
  switch (thresholdUnit(kind)) {
    case "minutes":
      return {min: 1, max: 10_080};
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
    default:
      return 5;
  }
};

/**
 * Whether the rule reads a window at all. "Offline for 30 minutes" is a duration on its own; the
 * others are "over N in the last W minutes", or an average over W.
 */
export const usesWindow = (kind: AlertKind | string) => kind !== "installation_offline";

export const WINDOW_BOUNDS = {min: 5, max: 1440, default: 15} as const;

/** A measured value or a threshold, in the unit its kind is read in. */
export const formatAlertValue = (kind: AlertKind | string, value: number | null | undefined, language: string) => {
  if (value === null || value === undefined || !Number.isFinite(value)) return null;
  switch (thresholdUnit(kind)) {
    case "minutes":
      return formatDuration(value * 60);
    case "percent":
      return formatPercent(value, language, 1);
    default:
      return formatNumber(value, language);
  }
};
