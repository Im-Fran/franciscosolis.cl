import type {TFunction} from "i18next";
import {addDays, formatDay} from "@/lib/custom-apps/format.ts";
import type {CompanyRef, Contract, Cycle} from "@/lib/custom-apps/types.ts";

/**
 * Presentation helpers for contracts and cycles, which share two traps worth writing down once:
 * a contract's `ends_on` is the **last day covered**, while a cycle's `ends_on` is the **first day
 * of the next one**. Every date here is a `YYYY-MM-DD` calendar day in the service's zone, never an
 * instant, so none of them goes through `new Date(day)`.
 */

/** A cycle as people read it: `1 mar 2026 – 31 mar 2026`, its exclusive end pulled back a day. */
export const cycleRange = (cycle: Pick<Cycle, "starts_on" | "ends_on">, language: string) =>
  `${formatDay(cycle.starts_on, language)} – ${formatDay(addDays(cycle.ends_on, -1), language)}`;

/** A cycle's last day, inclusive. */
export const cycleLastDay = (cycle: Pick<Cycle, "ends_on">) => addDays(cycle.ends_on, -1);

/** Whether a cycle's period is over on `today`, which is when it may be closed by hand. */
export const cycleEnded = (cycle: Pick<Cycle, "ends_on">, today: string) => cycle.ends_on <= today;

/** A contract's dates: `1 mar 2026 – 28 feb 2027`, or open-ended. */
export const contractPeriod = (contract: Pick<Contract, "starts_on" | "ends_on">, t: TFunction, language: string) =>
  `${formatDay(contract.starts_on, language)} – ${contract.ends_on ? formatDay(contract.ends_on, language) : t("custom_apps:contracts.open_ended")}`;

/**
 * Whether a contract covers `day`, as the service decides it: started, not past its last day, and
 * not cancelled before it. Used to offer only the contracts the service would accept for a work log
 * entry; the service checks again.
 */
export const coversDay = (contract: Pick<Contract, "starts_on" | "ends_on" | "cancelled_at">, day: string, timeZone: string) => {
  if (contract.starts_on > day) return false;
  if (contract.ends_on && day > contract.ends_on) return false;
  if (contract.cancelled_at) {
    try {
      const cancelledOn = new Intl.DateTimeFormat("en-CA", {timeZone, year: "numeric", month: "2-digit", day: "2-digit"}).format(
        new Date(contract.cancelled_at),
      );
      if (day > cancelledOn) return false;
    } catch {
      return false;
    }
  }
  return true;
};

export const companyName = (company: CompanyRef | null | undefined) => company?.trade_name || company?.legal_name || null;

/** Hours typed as a decimal (`12,5` or `12.5`) into whole minutes; null for an empty or invalid field. */
export const hoursToMinutes = (value: string) => {
  const trimmed = value.trim().replace(",", ".");
  if (!trimmed) return null;
  const hours = Number(trimmed);
  return Number.isFinite(hours) && hours >= 0 ? Math.round(hours * 60) : Number.NaN;
};

/** Minutes back into the hours field, without a trailing `.0`. */
export const minutesToHours = (minutes: number | null | undefined) =>
  minutes === null || minutes === undefined ? "" : String(Math.round((minutes / 60) * 100) / 100);
