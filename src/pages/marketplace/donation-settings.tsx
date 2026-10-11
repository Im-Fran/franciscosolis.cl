import {useCallback, useEffect, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {ArrowClockwise, ArrowSquareOut, FloppyDisk} from "@phosphor-icons/react";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {DONATE_ROUTE, GENERAL_FUND_ID, marketplaceRoute} from "@/lib/marketplace/config.ts";
import {formatAmountWithCode} from "@/lib/marketplace/money.ts";
import type {DonationSettings} from "@/lib/marketplace/types.ts";
import {ProductNav} from "@/pages/marketplace/components/product-nav.tsx";

/** The form's own copy of the settings: amounts as typed, so an empty box means "none". */
type Draft = {
  enabled: boolean;
  minimum: string;
  maximumEnabled: boolean;
  maximum: string;
  messagesEnabled: boolean;
};

const toDraft = (settings: DonationSettings): Draft => ({
  enabled: settings.enabled,
  minimum: settings.minimum_amount === null ? "" : String(settings.minimum_amount),
  maximumEnabled: settings.maximum_enabled,
  maximum: settings.maximum_amount === null ? "" : String(settings.maximum_amount),
  messagesEnabled: settings.messages_enabled,
});

/** Whole pesos as typed, with the thousands dots a Chilean writes, or null for an empty box. */
const parsePesos = (raw: string): number | null | "invalid" => {
  const digits = raw.trim().replace(/[.\s]/g, "");
  if (digits === "") return null;
  if (!/^\d+$/.test(digits)) return "invalid";
  const value = Number(digits);
  return Number.isSafeInteger(value) && value >= 1 ? value : "invalid";
};

/**
 * The donation link's own switches, at `/marketplace/donations`: whether it is open, the smallest and
 * the largest donation it takes, and whether a donor may leave a message.
 *
 * Unlike the authentication settings this is a form with a Save button rather than boxes that write
 * through, because the fields depend on each other — a maximum needs an amount, a minimum cannot sit
 * above the maximum — and the service checks them together. What the screen shows after saving is the
 * service's answer, not this browser's guess.
 *
 * Every amount is in **whole Chilean pesos** and is compared with the *converted* charge, which is
 * what the copy keeps saying: a donor giving ten dollars is held to the same floor as one giving ten
 * thousand pesos. The maximum keeps its figure while it is switched off, so turning it back on does not
 * mean typing it again.
 *
 * The takings are the next tab, Sales: the donation link files its payments under the `general` fund,
 * which the console reaches like a product with only its money sections.
 */
export const DonationSettingsScreen = () => {
  const {t, i18n} = useTranslation(["marketplace_admin", "admin"]);
  const {notify} = useToast();
  const locale = i18n.language;

  const settings = useResource(useCallback((signal: AbortSignal) => marketplaceApi.donations.settings(signal), []));
  const save = useMutation(
    useCallback(
      (body: Parameters<typeof marketplaceApi.donations.updateSettings>[0]) => marketplaceApi.donations.updateSettings(body),
      [],
    ),
  );

  const [draft, setDraft] = useState<Draft | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  /* The service's answer is what the form starts from, and what it returns to after a save. */
  useEffect(() => {
    if (settings.data) setDraft(toDraft(settings.data));
  }, [settings.data]);

  const update = (changes: Partial<Draft>) => setDraft((current) => (current ? {...current, ...changes} : current));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    setProblem(null);

    const minimum = parsePesos(draft.minimum);
    const maximum = parsePesos(draft.maximum);
    if (minimum === "invalid" || maximum === "invalid") {
      setProblem(t("marketplace_admin:donations.invalid_amount"));
      return;
    }
    if (draft.maximumEnabled && maximum === null) {
      setProblem(t("marketplace_admin:donations.maximum_needed"));
      return;
    }
    if (draft.maximumEnabled && minimum !== null && maximum !== null && minimum > maximum) {
      setProblem(t("marketplace_admin:donations.minimum_above_maximum"));
      return;
    }

    const outcome = await save.run({
      enabled: draft.enabled,
      minimum_amount: minimum,
      maximum_enabled: draft.maximumEnabled,
      maximum_amount: maximum,
      messages_enabled: draft.messagesEnabled,
    });
    if (!outcome.ok) {
      setProblem(t(`admin:errors.${outcome.error}`, {defaultValue: outcome.error}));
      return;
    }
    setDraft(toDraft(outcome.data));
    notify(t("marketplace_admin:donations.saved"));
  };

  const pesos = (value: number) => formatAmountWithCode(value, "CLP", locale);
  const minimumPreview = draft ? parsePesos(draft.minimum) : null;
  const maximumPreview = draft ? parsePesos(draft.maximum) : null;

  return (
    <>
      <PageHeader
        title={t("marketplace_admin:donations.title")}
        description={t("marketplace_admin:donations.description")}
        back={{to: marketplaceRoute.list, label: t("marketplace_admin:editor.back")}}
        actions={
          <>
            <Button variant="ghost" size="sm" onClick={settings.reload}>
              <ArrowClockwise size={14}/> {t("admin:common.refresh")}
            </Button>
            <Button variant="secondary" size="sm" asChild>
              <Link to={DONATE_ROUTE} target="_blank" rel="noopener">
                <ArrowSquareOut size={14}/> {t("marketplace_admin:donations.open_page")}
              </Link>
            </Button>
          </>
        }
      />

      <ProductNav id={GENERAL_FUND_ID}/>

      <Panel
        title={t("marketplace_admin:donations.panel_title")}
        description={
          settings.data?.updated_at
            ? t("marketplace_admin:donations.updated", {
                when: formatDateTime(settings.data.updated_at, locale),
                who: settings.data.updated_by ?? "—",
              })
            : t("marketplace_admin:donations.never_updated")
        }
      >
        <PanelState loading={settings.loading && !settings.data} error={settings.error} onRetry={settings.reload}>
          {draft && (
            <form className="flex max-w-xl flex-col gap-6" onSubmit={(event) => void submit(event)}>
              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.enabled}
                  onChange={(event) => update({enabled: event.target.checked})}
                />
                <span>
                  <span className="block text-sm text-text">{t("marketplace_admin:donations.enabled_label")}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-neutral-400">
                    {draft.enabled
                      ? t("marketplace_admin:donations.enabled_on")
                      : t("marketplace_admin:donations.enabled_off")}
                  </span>
                </span>
              </label>

              <Field
                label={t("marketplace_admin:donations.minimum_label")}
                htmlFor="donation-minimum"
                hint={
                  typeof minimumPreview === "number"
                    ? t("marketplace_admin:donations.minimum_hint_set", {amount: pesos(minimumPreview)})
                    : t("marketplace_admin:donations.minimum_hint_none")
                }
              >
                <Input
                  id="donation-minimum"
                  inputMode="numeric"
                  placeholder={t("marketplace_admin:donations.no_minimum")}
                  value={draft.minimum}
                  onChange={(event) => update({minimum: event.target.value})}
                />
              </Field>

              <div className="flex flex-col gap-3">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1"
                    checked={draft.maximumEnabled}
                    onChange={(event) => update({maximumEnabled: event.target.checked})}
                  />
                  <span>
                    <span className="block text-sm text-text">{t("marketplace_admin:donations.maximum_enabled_label")}</span>
                    <span className="mt-1 block text-[13px] leading-relaxed text-neutral-400">
                      {t("marketplace_admin:donations.maximum_enabled_hint")}
                    </span>
                  </span>
                </label>
                <Field
                  label={t("marketplace_admin:donations.maximum_label")}
                  htmlFor="donation-maximum"
                  hint={
                    draft.maximumEnabled && typeof maximumPreview === "number"
                      ? t("marketplace_admin:donations.maximum_hint_set", {amount: pesos(maximumPreview)})
                      : t("marketplace_admin:donations.maximum_hint_off")
                  }
                >
                  <Input
                    id="donation-maximum"
                    inputMode="numeric"
                    disabled={!draft.maximumEnabled}
                    value={draft.maximum}
                    onChange={(event) => update({maximum: event.target.value})}
                  />
                </Field>
              </div>

              <label className="flex items-start gap-3">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={draft.messagesEnabled}
                  onChange={(event) => update({messagesEnabled: event.target.checked})}
                />
                <span>
                  <span className="block text-sm text-text">{t("marketplace_admin:donations.messages_label")}</span>
                  <span className="mt-1 block text-[13px] leading-relaxed text-neutral-400">
                    {t("marketplace_admin:donations.messages_hint", {count: settings.data?.message_max_length ?? 500})}
                  </span>
                </span>
              </label>

              {problem && <Alert tone="error">{problem}</Alert>}

              <div className="flex items-center gap-3">
                <Button type="submit" disabled={save.pending}>
                  {save.pending ? <Spinner size={16}/> : <FloppyDisk size={16}/>}
                  {t("marketplace_admin:donations.save")}
                </Button>
                <span className="text-[12px] text-neutral-500">{t("marketplace_admin:donations.cache_note")}</span>
              </div>
            </form>
          )}
        </PanelState>
      </Panel>
    </>
  );
};
