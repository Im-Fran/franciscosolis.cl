import {useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowLeft, ArrowSquareOut, GlobeSimple, HandHeart, Heart, SignIn} from "@phosphor-icons/react";
import {BrandLockup} from "@/components/brand";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useLanguageToggle} from "@/hooks/useLanguageToggle.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeError} from "@/lib/auth/useResource.ts";
import {marketplaceContent} from "@/lib/marketplace/content.ts";
import {
  checkAmount,
  DONATE_ROUTE,
  estimateCharge,
  parseAmount,
  presetAmounts,
  usableCurrencies,
  useDonationOptions,
  useDonationReturn,
} from "@/lib/marketplace/donations.ts";
import {formatAmount} from "@/lib/marketplace/money.ts";
import type {DonationCurrency} from "@/lib/marketplace/types.ts";
import {cn} from "@/lib/utils.ts";

/**
 * The donation link: `/donate`, for supporting the projects in general rather than one product.
 *
 * It is shareable with an amount already in it — `/donate?amount=10&currency=USD` — which is also how
 * the form survives the sign-in a donation needs: the page sends the visitor through the site's own
 * sign-in with what they typed in the return address, and they land back on the same form.
 *
 * What it asks is deliberately small: a currency, an amount, a button. There is no minimum and no
 * maximum, the currency is the donor's choice, and the one thing the page has to say out loud is
 * that MercadoPago charges in Chilean pesos — so a donation in dollars shows the pesos it becomes
 * before anybody leaves for the checkout.
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currencies = usableCurrencies(options.data);
  const settlement = options.data?.settlement_currency ?? "CLP";
  /* A currency with no rate right now falls back to pesos, which never needs one. */
  const currency: DonationCurrency | undefined =
    currencies.find((entry) => entry.code === currencyCode) ?? currencies.find((entry) => entry.code === settlement);
  const unavailable = (options.data?.currencies.length ?? 0) - currencies.length;

  const problem = checkAmount(amount, currency);
  const value = parseAmount(amount);
  const charge = value !== null && currency && problem === null ? estimateCharge(value, currency) : null;
  const converted = currency !== undefined && currency.code !== settlement;

  const donate = async () => {
    if (!currency || value === null || problem !== null) return;
    setError(null);

    /* No account yet: the donation has nowhere to live. Sign in and come back to this same form. */
    if (status !== "authenticated") {
      const prefill = new URLSearchParams({amount, currency: currency.code});
      await client.flow.startAuthorization(`${DONATE_ROUTE}?${prefill}`);
      return;
    }

    setBusy(true);
    try {
      const checkout = await marketplaceContent.donate({
        amount: value,
        currency: currency.code,
        locale: language,
        return_path: DONATE_ROUTE,
      });
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
              {(["free", "currency", "receipt"] as const).map((key) => (
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
                      : t("donate:no_limits")}
                  </span>
                </div>

                {currency && (
                  <div className="flex flex-wrap gap-2" role="group" aria-label={t("donate:presets_label")}>
                    {presetAmounts(currency).map((preset) => (
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

                {charge !== null && currency && (
                  <p className="rounded-[var(--radius-md)] bg-bg/50 px-4 py-3 text-[13px] leading-relaxed text-neutral-300">
                    {converted
                      ? t("donate:preview_converted", {
                          charge: formatAmount(charge, settlement, locale),
                          rate: formatAmount(currency.clp_per_unit ?? 0, settlement, locale),
                          code: currency.code,
                        })
                      : t("donate:preview", {charge: formatAmount(charge, settlement, locale)})}
                  </p>
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
