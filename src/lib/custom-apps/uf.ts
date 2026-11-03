import {useEffect, useState} from "react";
import {LANDING_BASE_URL} from "@/lib/custom-apps/config.ts";

/**
 * Today's UF value, for the approximate peso equivalent shown beside an amount in UF.
 *
 * It comes from the landing service's public indicator endpoint (`/landing/indicators/uf`, a
 * Banco Central de Chile series answered with `{code, data: {observations: [{date, value}]}}`), whose
 * range ends today in Santiago, so the last observation is the UF in force today. No session is
 * involved: the endpoint is public and the call sends no credentials.
 *
 * It is fetched **once per page load** and shared by every amount on screen. It never blocks
 * rendering and never throws: while it loads, or if it fails, `useUfValue` answers `null` and the
 * amount is shown in UF alone. A failure is remembered for `RETRY_AFTER_MS` so a screen with twenty
 * amounts does not retry twenty times, but a later screen may try again.
 */

export type UfValue = {
  /** Pesos per UF. */
  value: number;
  /** The `YYYY-MM-DD` the value applies to. */
  date: string;
};

const TIMEOUT_MS = 8000;
const RETRY_AFTER_MS = 60_000;

let resolved: UfValue | null = null;
let pending: Promise<UfValue | null> | null = null;
let failedAt = 0;

const parse = (body: unknown): UfValue | null => {
  const observations = (body as {data?: {observations?: unknown}} | null)?.data?.observations;
  if (!Array.isArray(observations)) return null;
  const last = observations.at(-1) as {date?: unknown; value?: unknown} | undefined;
  if (!last || typeof last.date !== "string" || typeof last.value !== "number") return null;
  return Number.isFinite(last.value) && last.value > 0 ? {value: last.value, date: last.date} : null;
};

export const loadUf = (): Promise<UfValue | null> => {
  if (resolved) return Promise.resolve(resolved);
  if (pending) return pending;
  if (failedAt && Date.now() - failedAt < RETRY_AFTER_MS) return Promise.resolve(null);

  pending = fetch(`${LANDING_BASE_URL}/indicators/uf`, {credentials: "omit", signal: AbortSignal.timeout(TIMEOUT_MS)})
    .then((response) => (response.ok ? response.json() : null))
    .then(parse)
    .catch(() => null)
    .then((uf) => {
      resolved = uf;
      failedAt = uf ? 0 : Date.now();
      pending = null;
      return uf;
    });
  return pending;
};

/** Today's UF, or `null` while it loads, when `enabled` is false, or when it could not be read. */
export const useUfValue = (enabled = true): UfValue | null => {
  const [uf, setUf] = useState<UfValue | null>(resolved);

  useEffect(() => {
    if (!enabled) return;
    let live = true;
    void loadUf().then((value) => {
      if (live) setUf(value);
    });
    return () => {
      live = false;
    };
  }, [enabled]);

  return enabled ? uf : null;
};

/** Pesos for an amount in UF at `uf`, whole pesos like every CLP figure. */
export const ufToClp = (amount: number, uf: UfValue) => Math.round(amount * uf.value);

/** Chilean format whatever the interface language: `$474.312`, since a peso amount is read that way. */
export const formatClpEstimate = (pesos: number) =>
  new Intl.NumberFormat("es-CL", {style: "currency", currency: "CLP", maximumFractionDigits: 0}).format(pesos);

/** The UF itself, which Chile quotes with two decimals: `$37.945,00`. */
export const formatUfValue = (value: number) =>
  new Intl.NumberFormat("es-CL", {style: "currency", currency: "CLP", minimumFractionDigits: 2, maximumFractionDigits: 2}).format(value);
