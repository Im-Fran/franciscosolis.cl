import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import type {TFunction} from "i18next";
import {Link} from "react-router-dom";
import {ArrowLeft, ArrowSquareOut, Bank, GlobeSimple, HandHeart, Heart, LockKey, SignIn} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeError} from "@/lib/auth/useResource.ts";
import {marketplaceContent} from "@/lib/marketplace/content.ts";
import {
  checkAmount,
  DONATE_ROUTE,
  type DonationBounds,
  estimateCharge,
  parseAmount,
  presetAmounts,
  usableCurrencies,
  useDonationOptions,
  useDonationReturn,
} from "@/lib/marketplace/donations.ts";
import {formatAmount, formatAmountWithCode} from "@/lib/marketplace/money.ts";
import type {DonationCurrency} from "@/lib/marketplace/types.ts";
import {cn} from "@/lib/utils.ts";

/**
 * The donation link: `/donate`, for supporting the projects in general rather than one product.
 *
 * It is shareable with an amount already in it — `/donate?amount=10&currency=USD` — which is also how
 * the form survives the sign-in a donation needs: the page sends the visitor through the site's own
 * sign-in with what they typed in the return address, and they land back on the same form.
 *
 * What it asks is deliberately small: a currency, an amount, a button — and a message, when the
 * console has turned messages on. Three things it has to say out loud, because each is the kind of
 * thing somebody finds out too late otherwise:
 *
 * - **It is voluntary and entitles to nothing.** A donation here is not a purchase of anything.
 * - **It is charged in Chilean pesos.** MercadoPago settles this account in CLP, so a donation in
 *   dollars is converted with the Banco Central de Chile's rate, and the page shows that rate, its date
 *   and the pesos it becomes before anybody leaves for the checkout.
 * - **The bounds, when there are any.** The console may set a minimum and a maximum, in pesos, which
 *   the service checks against the converted charge; the page applies the same rule so the button
 *   is never pressed for something the service will refuse.
 *
 * When the console closes the link the page says so instead of showing a form.
 */
export const Donate = () => {
  const {t, i18n} = useTranslation(["donate", "common"]);
  const {language, toggleLanguage} = useLanguageToggle();
  const {status, client} = useAuth();
  /*
   * Money is written the way the receipt writes it: Chilean Spanish or US English. The bare `es`
   * locale leaves four-digit amounts ungrouped (`2000 CLP` beside `10.000 CLP`), which on a page made
   * of amounts reads like two different conventions.
   */
  const locale = (i18n.resolvedLanguage ?? language) === "es" ? "es-CL" : "en-US";

  const options = useDonationOptions();
  const back = useDonationReturn();

  /* Read once, before the return handler cleans the address: a shared or post-sign-in link prefills. */
  const initial = useMemo(() => new URLSearchParams(window.location.search), []);
  const [currencyCode, setCurrencyCode] = useState(
    () => initial.get("currency")?.toUpperCase() ?? (language === "es" ? "CLP" : "USD"),
  );
  const [amount, setAmount] = useState(() => initial.get("amount") ?? "");
  /*
   * The message survives the sign-in round trip in this tab's storage rather than in the address, where
   * a paragraph of somebody's words has no business being. Storage can be unavailable; then it is
   * simply not kept.
   */
  const [message, setMessage] = useState(() => {
    try {
      return sessionStorage.getItem(MESSAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = usableCurrencies(options.data);
  const settlement = options.data?.settlement_currency ?? "CLP";
  /* A currency with no rate right now falls back to pesos, which never needs one. */
  const currency: DonationCurrency | undefined =
    currencies.find((entry) => entry.code === currencyCode) ?? currencies.find((entry) => entry.code === settlement);
  const unavailable = (options.data?.currencies.length ?? 0) - currencies.length;

  const enabled = options.data?.enabled ?? true;
  const bounds = {minimum: options.data?.minimum_amount ?? null, maximum: options.data?.maximum_amount ?? null};
  const messagesEnabled = options.data?.messages_enabled ?? false;
  const messageMax = options.data?.message_max_length ?? 500;
  const problem = checkAmount(amount, currency, bounds);
  const value = parseAmount(amount);
  const charge = value !== null && currency && problem === null ? estimateCharge(value, currency) : null;
  const converted = currency !== undefined && currency.code !== settlement;

  const donate = async () => {
    if (!currency || value === null || problem !== null) return;
    setError(null);

    /* No account yet: the donation has nowhere to live. Sign in and come back to this same form. */
    if (status !== "authenticated") {
      try {
        if (message.trim()) sessionStorage.setItem(MESSAGE_KEY, message);
      } catch {
        /* Not kept, then. The amount and the currency still ride on the return address. */
      }
      const prefill = new URLSearchParams({amount, currency: currency.code});
      await client.flow.startAuthorization(`${DONATE_ROUTE}?${prefill}`);
      return;
    }

    setBusy(true);
    try {
      const checkout = await marketplaceContent.donate({
        amount: value,
        currency: currency.code,
        ...(messagesEnabled && message.trim() ? {message: message.trim()} : {}),
        locale: language,
        return_path: DONATE_ROUTE,
      });
      try {
        sessionStorage.removeItem(MESSAGE_KEY);
      } catch {
        /* Nothing was kept. */
      }
      /* Off to the provider. Nothing after this line runs — the tab is theirs now. */
      window.location.assign(checkout.checkout_url);
    } catch (cause) {
      setBusy(false);
      setError(describeError(cause).message);
    }
  };

  return (
    <div className="flex flex-1 flex-col pb-24">
      <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-4 py-5">
        <Link to="/" className="inline-flex items-center gap-2 text-neutral-400 hover:text-text">
          <BrandLockup size={24} tone="auto"/>
          <span className="sr-only">{t("donate:back_home")}</span>
        </Link>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft size={15}/>
              <span className="hidden sm:inline">{t("donate:back_home")}</span>
            </Link>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={toggleLanguage}
            aria-label={t("common:toggle_lang", {lang: language === "es" ? "EN" : "ES"})}
          >
            <GlobeSimple size={15}/> {language === "es" ? "EN" : "ES"}
          </Button>
        </div>
      </div>

      <section className="mx-auto w-full max-w-5xl px-4 pt-10">
        <div className="grid gap-10 md:grid-cols-[1fr_minmax(0,420px)] md:items-start">
          <div className="flex flex-col gap-5">
            <p className="inline-flex items-center gap-2 text-[13px] uppercase tracking-[0.08em] text-accent-300">
              <HandHeart size={16}/> {t("donate:eyebrow")}
            </p>
            <h1 className="text-[clamp(36px,6vw,64px)] leading-[1.02] text-text">{t("donate:title")}</h1>
            <p className="max-w-xl text-[16px] leading-[1.6] text-neutral-300">{t("donate:body")}</p>
            <ul className="flex max-w-xl flex-col gap-2 text-[14px] text-neutral-400">
              {(["voluntary", "free", "pesos", "receipt"] as const).map((key) => (
                <li key={key} className="flex items-start gap-2">
                  <Heart size={14} weight="fill" className="mt-1 shrink-0 text-accent-400"/>
                  <span>{t(`donate:points.${key}`)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-5 rounded-[var(--radius-md)] border border-neutral-800 bg-surface p-6 shadow-[var(--shadow-sm)]">
            <ReturnNotice back={back} locale={locale} onSignIn={() => void client.flow.startAuthorization(DONATE_ROUTE)}/>

            {options.loading && !options.data ? (
              <div className="flex justify-center py-10">
                <Spinner size={24} label={t("common:loading")}/>
              </div>
            ) : options.error && !options.data ? (
              <Alert tone="error">
                {options.error === "network" ? t("common:content_unreachable") : t("common:content_failed")}
                <Button variant="ghost" size="sm" className="mt-3" onClick={options.reload}>
                  {t("common:retry")}
                </Button>
              </Alert>
            ) : !enabled ? (
              <Alert tone="info" title={t("donate:closed_title")}>
                {t("donate:closed_body")}
              </Alert>
            ) : (
              <form
                className="flex flex-col gap-5"
                onSubmit={(event) => {
                  event.preventDefault();
                  void donate();
                }}
              >
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="donation-currency" className="text-sm font-medium text-neutral-300">
                    {t("donate:currency_label")}
                  </label>
                  <Select
                    id="donation-currency"
                    value={currency?.code ?? ""}
                    onChange={(event) => setCurrencyCode(event.target.value)}
                  >
                    {currencies.map((entry) => (
                      <option key={entry.code} value={entry.code}>
                        {entry.code} — {currencyName(entry, locale)}
                      </option>
                    ))}
                  </Select>
                  {unavailable > 0 && (
                    <span className="text-[12px] text-neutral-500">{t("donate:currencies_unavailable")}</span>
                  )}
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="donation-amount" className="text-sm font-medium text-neutral-300">
                    {t("donate:amount_label", {currency: currency?.code ?? settlement})}
                  </label>
                  <Input
                    id="donation-amount"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder={t("donate:amount_placeholder")}
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    aria-invalid={amount !== "" && problem !== null}
                    aria-describedby="donation-amount-hint"
                  />
                  <span id="donation-amount-hint" className="text-[12px] text-neutral-500">
                    {amount !== "" && problem !== null && problem !== "empty"
                      ? t(
                          problem === "decimals" && currency?.minor_units === 0
                            ? "donate:problems.decimals_zero"
                            : `donate:problems.${problem}`,
                          {decimals: currency?.minor_units ?? 0},
                        )
                      : boundsHint(t, bounds, settlement, locale)}
                  </span>
                </div>

                {currency && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("donate:presets_label")}>
                    {presetAmounts(currency)
                      .filter((preset) => withinBounds(estimateCharge(preset, currency), bounds))
                      .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => setAmount(String(preset))}
                        className={cn(
                          "rounded-full border px-3 py-1.5 text-[13px] transition-colors",
                          value === preset
                            ? "border-accent bg-accent-900/40 text-accent-200"
                            : "border-neutral-800 text-neutral-300 hover:border-neutral-700 hover:text-text",
                        )}
                      >
                        {formatAmount(preset, currency.code, locale)}
                      </button>
                    ))}
                  </div>
                )}

                {/*
                  * The charge, said before anybody leaves for the checkout: always pesos, and for another
                  * currency the Banco Central de Chile rate it was converted with and the day it is for.
                  */}
                {currency && (
                  <div className="flex flex-col gap-2 rounded-[var(--radius-md)] bg-bg/50 px-4 py-3 text-[13px] leading-relaxed text-neutral-300">
                    <p className="flex items-start gap-2">
                      <Bank size={16} className="mt-0.5 shrink-0 text-accent-300"/>
                      <span>
                        {converted
                          ? t("donate:clp_notice_converted", {
                              code: currency.code,
                              source: options.data?.rate_source ?? "Banco Central de Chile",
                            })
                          : t("donate:clp_notice")}
                      </span>
                    </p>
                    {converted && currency.clp_per_unit !== null && (
                      <p className="text-neutral-400">
                        {t("donate:rate_line", {
                          code: currency.code,
                          rate: formatRate(currency.clp_per_unit, locale),
                          date: formatRateDate(currency.rate_date, locale),
                        })}
                      </p>
                    )}
                    {charge !== null && (
                      <p className="flex items-baseline justify-between gap-3 border-t border-neutral-800 pt-2">
                        <span className="text-neutral-400">{t("donate:charge_label")}</span>
                        <span className="font-display text-xl text-text">
                          {formatAmountWithCode(charge, settlement, locale)}
                        </span>
                      </p>
                    )}
                  </div>
                )}

                {messagesEnabled && (
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="donation-message" className="text-sm font-medium text-neutral-300">
                      {t("donate:message_label")}
                    </label>
                    <Textarea
                      id="donation-message"
                      rows={3}
                      maxLength={messageMax}
                      placeholder={t("donate:message_placeholder")}
                      value={message}
                      onChange={(event) => setMessage(event.target.value)}
                      aria-describedby="donation-message-hint"
                    />
                    <span id="donation-message-hint" className="flex justify-between gap-3 text-[12px] text-neutral-500">
                      <span>{t("donate:message_hint")}</span>
                      <span>{message.length}/{messageMax}</span>
                    </span>
                  </div>
                )}

                {error && (
                  <Alert tone="error">
                    {error === "network"
                      ? t("common:content_unreachable")
                      : error === "unexpected"
                        ? t("common:content_failed")
                        : t("donate:checkout_failed", {reason: error})}
                  </Alert>
                )}

                <Button type="submit" disabled={busy || !currency || problem !== null}>
                  {busy ? <Spinner size={16}/> : status === "authenticated" ? <ArrowSquareOut size={16}/> : <SignIn size={16}/>}
                  {status === "authenticated" ? t("donate:donate") : t("donate:sign_in_and_donate")}
                </Button>

                <p className="flex items-start gap-2 text-[12px] leading-relaxed text-neutral-400">
                  <LockKey size={14} className="mt-0.5 shrink-0"/> {t("donate:voluntary_notice")}
                </p>
                <p className="text-[12px] leading-relaxed text-neutral-500">
                  {status === "authenticated" ? t("donate:account_hint") : t("donate:sign_in_hint")}
                </p>
                <p className="text-center text-[12px] text-neutral-600">{t("donate:provider")}</p>
              </form>
            )}
          </div>
        </div>
      </section>
    </div>
  );
};

/** Where the message waits while the donor signs in. Per tab, and removed once the checkout opens. */
const MESSAGE_KEY = "fs.donate.message";

/** Whether a charge in pesos sits inside the console's bounds. An unknown charge is not filtered out. */
const withinBounds = (charge: number | null, bounds: DonationBounds) =>
  charge === null ||
  ((bounds.minimum === null || charge >= bounds.minimum) && (bounds.maximum === null || charge <= bounds.maximum));

/** The line under the amount: the bounds in pesos, or that there are none. */
const boundsHint = (t: TFunction, bounds: DonationBounds, settlement: string, locale: string) => {
  const money = (value: number) => formatAmountWithCode(value, settlement, locale);
  if (bounds.minimum !== null && bounds.maximum !== null) {
    return t("donate:bounds.between", {minimum: money(bounds.minimum), maximum: money(bounds.maximum)});
  }
  if (bounds.minimum !== null) return t("donate:bounds.from", {minimum: money(bounds.minimum)});
  if (bounds.maximum !== null) return t("donate:bounds.up_to", {maximum: money(bounds.maximum)});
  return t("donate:no_limits");
};

/** A rate as the bank publishes it: pesos with two decimals, `$978,61`. */
const formatRate = (rate: number, locale: string) =>
  new Intl.NumberFormat(locale, {style: "currency", currency: "CLP", minimumFractionDigits: 2, maximumFractionDigits: 2}).format(rate);

/** The day a rate is for. Formatted in UTC because it is a calendar day, not a moment. */
const formatRateDate = (date: string | null, locale: string) => {
  if (!date) return "—";
  try {
    return new Intl.DateTimeFormat(locale, {dateStyle: "long", timeZone: "UTC"}).format(new Date(`${date}T00:00:00Z`));
  } catch {
    return date;
  }
};

/** The currency's name in the reader's language, from `Intl` rather than from a list of our own. */
const currencyName = (currency: DonationCurrency, locale: string): string => {
  try {
    return new Intl.DisplayNames([locale], {type: "currency"}).of(currency.code) ?? currency.name;
  } catch {
    return currency.name;
  }
};

/**
 * What happened to the donation the visitor just came back from, read from our own service.
 *
 * Absent on an ordinary visit. After MercadoPago it says "confirming" until the webhook has settled
 * the payment, then thanks them — or says plainly that the payment did not go through, so nobody is
 * left wondering whether they were charged.
 */
const ReturnNotice = ({
  back,
  locale,
  onSignIn,
}: {
  back: ReturnType<typeof useDonationReturn>;
  locale: string;
  onSignIn: () => void;
}) => {
  const {t} = useTranslation(["donate"]);
  if (!back.purchaseId) return null;

  if (back.needsSignIn) {
    return (
      <Alert tone="info" title={t("donate:return.signed_out_title")}>
        {t("donate:return.signed_out_body")}
        <Button variant="ghost" size="sm" className="mt-3" onClick={onSignIn}>
          <SignIn size={14}/> {t("donate:return.sign_in")}
        </Button>
      </Alert>
    );
  }

  if (back.approved && back.purchase) {
    const pledged = back.purchase.pledged;
    return (
      <Alert tone="success" title={t("donate:return.thanks_title")}>
        {t("donate:return.thanks_body", {
          amount: pledged
            ? formatAmount(pledged.amount, pledged.currency, locale)
            : formatAmount(back.purchase.amount, back.purchase.currency, locale),
        })}
      </Alert>
    );
  }

  if (back.failed) {
    return (
      <Alert tone="error" title={t("donate:return.failed_title")}>
        {t("donate:return.failed_body")}
      </Alert>
    );
  }

  if (back.confirming) {
    return (
      <Alert tone="info">
        <span className="inline-flex items-center gap-2">
          <Spinner size={14}/> {t("donate:return.confirming")}
        </span>
      </Alert>
    );
  }

  return <Alert tone="info">{t("donate:return.pending")}</Alert>;
};
