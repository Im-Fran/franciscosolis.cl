import type {Maintenance, MaintenanceWindow} from "@/lib/custom-apps/types.ts";
import {MAINTENANCE_CANCELLABLE, MAINTENANCE_EDITABLE} from "@/lib/custom-apps/types.ts";

/**
 * The window a maintenance is read by in a list: the one it runs in once it has one, else the first
 * offered (by the order the client sees them), else none.
 */
export const leadingWindow = (maintenance: Pick<Maintenance, "chosen_window" | "windows">): MaintenanceWindow | null =>
  maintenance.chosen_window ?? [...maintenance.windows].sort((a, b) => a.position - b.position)[0] ?? null;

export const isEditable = (maintenance: Pick<Maintenance, "status">) => MAINTENANCE_EDITABLE.includes(maintenance.status);

export const isCancellable = (maintenance: Pick<Maintenance, "status">) => MAINTENANCE_CANCELLABLE.includes(maintenance.status);

export const isDeletable = (maintenance: Pick<Maintenance, "status">) =>
  maintenance.status === "draft" || maintenance.status === "cancelled";

/** Whole minutes as the two inputs the forms take. */
export const splitMinutes = (minutes: number) => ({hours: String(Math.floor(minutes / 60)), minutes: String(minutes % 60)});

/** The two inputs back to whole minutes; NaN for anything that is not a non-negative whole number. */
export const joinMinutes = (hours: string, minutes: string) => {
  const h = Number(hours || 0);
  const m = Number(minutes || 0);
  if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59) return Number.NaN;
  return h * 60 + m;
};

/**
 * What the overview calls "needs attention", which no single status filter on the service expresses:
 * nobody answered, failed in the last 7 days, or sent back by the client.
 */
export const needsAttention = (maintenance: Maintenance, now = Date.now()) =>
  maintenance.status === "no_response" ||
  (maintenance.status === "draft" && maintenance.rejected) ||
  (maintenance.status === "failed" &&
    maintenance.finished_at !== null &&
    new Date(maintenance.finished_at).getTime() >= now - 7 * 86_400_000);

/** A `YYYY-MM` month moved by `delta` months. */
export const shiftMonth = (month: string, delta: number) => {
  const [year, value] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, value - 1 + delta, 1));
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
};
