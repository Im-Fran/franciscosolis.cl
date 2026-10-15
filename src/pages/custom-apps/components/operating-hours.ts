import {WEEKDAYS} from "@/lib/custom-apps/types.ts";
import type {OperatingHours, Weekday} from "@/lib/custom-apps/types.ts";

/**
 * Operating hours as the service stores them, and the two questions the panel asks of them: is
 * this schedule well formed, and is a given hour inside it.
 */

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

const minutes = (value: string) => {
  const [hours, mins] = value.split(":").map(Number);
  return hours * 60 + mins;
};

/**
 * The first problem with a schedule, per day, or an empty object when it is fine. A window ends
 * after it starts — `[start, end)` within one day, so overnight shifts are two windows — and two
 * windows on one day may not overlap, because "is this hour inside" would answer twice.
 */
export const validateHours = (hours: OperatingHours | null) => {
  const problems: Partial<Record<Weekday, "format" | "order" | "overlap">> = {};
  if (!hours) return problems;

  for (const day of WEEKDAYS) {
    const windows = hours.days[day] ?? [];
    if (windows.some((window) => !TIME.test(window.start) || !TIME.test(window.end))) {
      problems[day] = "format";
      continue;
    }
    if (windows.some((window) => minutes(window.end) <= minutes(window.start))) {
      problems[day] = "order";
      continue;
    }
    const sorted = [...windows].sort((a, b) => minutes(a.start) - minutes(b.start));
    if (sorted.some((window, index) => index > 0 && minutes(window.start) < minutes(sorted[index - 1].end))) {
      problems[day] = "overlap";
    }
  }
  return problems;
};

/** Drops the days with no windows and sorts the rest, so an unchanged schedule compares equal. */
export const tidyHours = (hours: OperatingHours | null): OperatingHours | null => {
  if (!hours) return null;
  const days: OperatingHours["days"] = {};
  for (const day of WEEKDAYS) {
    const windows = hours.days[day] ?? [];
    if (windows.length > 0) days[day] = [...windows].sort((a, b) => minutes(a.start) - minutes(b.start));
  }
  return {timezone: hours.timezone.trim() || "America/Santiago", days};
};

/**
 * Whether any part of `hour` (0–23) on `day` falls inside the schedule. Used to outline the
 * heatmap: the hours a client said they work are the ones a maintenance window should avoid.
 */
export const isWithinHours = (hours: OperatingHours | null, day: Weekday, hour: number) => {
  if (!hours) return false;
  const start = hour * 60;
  const end = start + 60;
  return (hours.days[day] ?? []).some((window) => minutes(window.start) < end && minutes(window.end) > start);
};
