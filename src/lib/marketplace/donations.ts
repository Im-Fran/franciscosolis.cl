import {useCallback, useEffect, useRef, useState} from "react";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useResource, type Resource} from "@/lib/auth/useResource.ts";
import {DONATE_ROUTE, GENERAL_FUND_ID, isGeneralFund} from "@/lib/marketplace/config.ts";
import {marketplaceContent} from "@/lib/marketplace/content.ts";
import type {DonationCurrency, DonationOptions, Purchase} from "@/lib/marketplace/types.ts";

/**
 * The donation link: support for the projects in general, rather than for one product.
 *
 * The service decides everything that matters — which currencies are accepted, what each is worth in
 * pesos, and what the donor is finally charged — and this side only does enough arithmetic to show a
 * preview while somebody types. Three facts from the service shape the page:
 *
 * - **There is no minimum and no maximum.** The form checks only what the service would refuse
 *   anyway: an amount above zero, with no more decimals than its currency has.
 * - **The donor picks the currency, MercadoPago charges pesos.** The account settles in CLP, so a
 *   donation in dollars is converted at the day's rate and the checkout shows pesos. The preview
 *   says so before anybody leaves the page, because a checkout in a currency you did not pick reads
 *   like a mistake otherwise.
 * - **A currency with no rate right now is not offered.** The service still lists it, with a null
 *   rate, so a picker built from the list would offer something checkout then refuses.
 */

/** What the donation link accepts, and the rates behind its preview. */
export const useDonationOptions = (): Resource<DonationOptions> =>
  useResource(useCallback((signal: AbortSignal) => marketplaceContent.donationOptions(signal), []));

/** Currencies that can actually be donated in right now: the ones with a rate. Pesos always qualify. */
export const usableCurrencies = (options: DonationOptions | null | undefined): DonationCurrency[] =>
  (options?.currencies ?? []).filter((currency) => currency.clp_per_unit !== null);

/**
 * A few amounts to start from, per currency.
 *
 * Suggestions and nothing more: none of them is a floor, the field beside them takes anything, and
 * they exist because a blank amount box is the hardest part of donating to get past.
 */
export const presetAmounts = (currency: DonationCurrency): number[] => {
  if (currency.code === "CLP") return [2_000, 5_000, 10_000, 20_000];
  if (currency.code === "JPY") return [500, 1_000, 3_000, 5_000];
  if (currency.code === "ARS") return [2_000, 5_000, 10_000, 20_000];
  if (currency.code === "COP") return [10_000, 20_000, 50_000, 100_000];
  if (currency.code === "UYU" || currency.code === "MXN") return [100, 200, 500, 1_000];
  if (currency.code === "BRL" || currency.code === "PEN") return [10, 25, 50, 100];
  return [5, 10, 25, 50];
};

/** Why an amount cannot be donated, as a key the page translates. Null when it can. */
export type AmountProblem = "empty" | "not_positive" | "decimals" | "below_one_peso" | null;

/**
 * Parses what was typed, accepting a comma as the decimal separator — `10,50` is how half the people
 * this page is for write ten and a half.
 */
export const parseAmount = (raw: string): number | null => {
  const normalized = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
};

/** The same rule the service applies: more than zero, written with no more decimals than the currency. */
export const checkAmount = (raw: string, currency: DonationCurrency | undefined): AmountProblem => {
  const value = parseAmount(raw);
  if (value === null || !currency) return "empty";
  if (value <= 0) return "not_positive";

  const factor = 10 ** currency.minor_units;
  if (Math.abs(Math.round(value * factor) / factor - value) > 1e-9 * Math.max(1, value)) return "decimals";

  const charged = estimateCharge(value, currency);
  if (charged !== null && charged < 1) return "below_one_peso";
  return null;
};

/**
 * Roughly what will be charged, in pesos. A preview: the service converts again at checkout, with its
 * own copy of the rate, and the checkout page shows the exact figure.
 */
export const estimateCharge = (value: number, currency: DonationCurrency): number | null =>
  currency.clp_per_unit === null ? null : Math.round(value * currency.clp_per_unit);

/** How long the page keeps asking whether a donation landed after the provider sent the donor back. */
const CONFIRM_ATTEMPTS = 15;
const CONFIRM_INTERVAL_MS = 2_000;

/** Query keys MercadoPago appends to the return URL, cleaned once read. */
const RETURN_KEYS = [
  "collection_status",
  "collection_id",
  "payment_id",
  "preference_id",
  "status",
  "merchant_order_id",
  "external_reference",
  "payment_type",
  "processing_mode",
  "merchant_account_id",
  "site_id",
];

/** The query key the service puts the donation's id under on the way back. */
const DONATION_KEY = "donation";

export {DONATE_ROUTE, GENERAL_FUND_ID, isGeneralFund};

export type DonationReturn = {
  /** The donation being waited for, when the donor has just come back from the provider. */
  purchaseId: string | null;
  /** The latest copy of it, once one could be read. */
  purchase: Purchase | null;
  /** Still asking. */
  confirming: boolean;
  /** The service confirmed the money arrived. */
  approved: boolean;
  /** The provider turned the payment down, or the donor walked away from it. */
  failed: boolean;
  /** Back on the page from MercadoPago, but signed out — the status can only be read with a session. */
  needsSignIn: boolean;
};

const TERMINAL_FAILURES = new Set(["rejected", "cancelled"]);

/**
 * Handles the donor coming back from MercadoPago.
 *
 * The return URL carries `?donation=<purchase id>` — the service puts it there rather than this page
 * keeping it in storage, because the payment may be finished in MercadoPago's app or on another
 * device. Whether it worked is read from our own service (`GET /me/purchases/:id`), never from the
 * status the provider appended: that is the payer's browser talking, and the settlement is the
 * webhook's, on its own schedule. The query string is cleaned either way, so a reload or a shared
 * link does not look like a fresh return.
 */
export const useDonationReturn = (): DonationReturn => {
  const {status} = useAuth();
  const [purchaseId, setPurchaseId] = useState<string | null>(null);
  const [purchase, setPurchase] = useState<Purchase | null>(null);
  const [confirming, setConfirming] = useState(false);
  const attempts = useRef(0);
  const armed = useRef(false);

  useEffect(() => {
    if (armed.current) return;
    armed.current = true;

    const params = new URLSearchParams(window.location.search);
    const id = params.get(DONATION_KEY);
    if (!id) return;

    setPurchaseId(id);
    setConfirming(true);

    params.delete(DONATION_KEY);
    for (const key of RETURN_KEYS) params.delete(key);
    const search = params.toString();
    window.history.replaceState(null, "", `${window.location.pathname}${search ? `?${search}` : ""}`);
  }, []);

  const authenticated = status === "authenticated";
  /* Bumped after every read that settled nothing, which is what schedules the next one. */
  const [tick, setTick] = useState(0);

  useEffect(() => {
    if (!purchaseId || !confirming || !authenticated) return;
    if (attempts.current >= CONFIRM_ATTEMPTS) {
      /* Giving up quietly: the payment may still land, and the receipt will say so when it does. */
      setConfirming(false);
      return;
    }

    const controller = new AbortController();
    const timer = setTimeout(
      () => {
        attempts.current += 1;
        marketplaceContent
          .purchase(purchaseId, controller.signal)
          .then((row) => {
            setPurchase(row);
            if (row.status === "approved" || TERMINAL_FAILURES.has(row.status)) setConfirming(false);
            else setTick((value) => value + 1);
          })
          .catch(() => {
            /* A failed read is one attempt spent, not a verdict. The next tick asks again. */
            if (!controller.signal.aborted) setTick((value) => value + 1);
          });
      },
      attempts.current === 0 ? 0 : CONFIRM_INTERVAL_MS,
    );
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [purchaseId, confirming, authenticated, tick]);

  return {
    purchaseId,
    purchase,
    confirming: confirming && status !== "anonymous",
    approved: purchase?.status === "approved",
    failed: TERMINAL_FAILURES.has(purchase?.status ?? ""),
    needsSignIn: purchaseId !== null && status === "anonymous",
  };
};
