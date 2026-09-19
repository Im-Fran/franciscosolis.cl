import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Input, Select, Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {fromDateTimeLocal, toDateTimeLocal} from "@/lib/admin/format.ts";
import type {Mutation} from "@/lib/admin/useMutation.ts";
import {MANUAL_SALE_SOURCES} from "@/lib/marketplace/types.ts";
import type {Sale, Voucher} from "@/lib/marketplace/types.ts";

export type RecordSalePayload = {
  email: string;
  source: string;
  kind: "purchase" | "donation";
  amount: number;
  note?: string;
  reference?: string;
  occurred_at?: string | null;
  locale?: string;
  issue_voucher?: boolean;
  notify?: boolean;
};

type RecordSaleDialogProps = {
  open: boolean;
  onClose: () => void;
  onSubmit: (payload: RecordSalePayload) => void;
  mutation: Mutation<[RecordSalePayload], {sale: Sale; voucher: Voucher | null}>;
};

/**
 * Recording a sale that happened somewhere this service cannot see: cash at a stand, a transfer, a
 * copy given to somebody.
 *
 * Two things about the form are deliberate rather than incidental:
 *
 * - **MercadoPago is not in the source list.** The service refuses it, and the form does not offer
 *   it: a row claiming the provider took money it has no record of would be indistinguishable from
 *   a real payment and would grant the same download.
 * - **The date is asked for, not assumed.** A sale entered a week late whose statutory ten days ran
 *   from the day it was typed in would give the buyer three days too many, and one entered early
 *   would take days off them.
 *
 * A gift is the amount left at zero — there is no separate switch for it, because "gift" is already
 * one of the sources and a gift with a price is not a thing.
 */
export const RecordSaleDialog = ({open, onClose, onSubmit, mutation}: RecordSaleDialogProps) => {
  const {t} = useTranslation(["cms_marketplace", "admin"]);

  const [email, setEmail] = useState("");
  const [source, setSource] = useState<string>("cash");
  const [kind, setKind] = useState<"purchase" | "donation">("purchase");
  const [amount, setAmount] = useState("0");
  const [note, setNote] = useState("");
  const [reference, setReference] = useState("");
  const [occurredAt, setOccurredAt] = useState("");
  const [locale, setLocale] = useState("es");
  const [issueVoucher, setIssueVoucher] = useState(true);
  const [notify, setNotify] = useState(true);

  /* Reopened for a second sale, the form starts empty rather than holding the previous buyer. */
  useEffect(() => {
    if (!open) return;
    setEmail("");
    setSource("cash");
    setKind("purchase");
    setAmount("0");
    setNote("");
    setReference("");
    setOccurredAt(toDateTimeLocal(new Date().toISOString()));
    setLocale("es");
    setIssueVoucher(true);
    setNotify(true);
    mutation.reset();
    // `mutation` is recreated on every render of the parent; only `open` should reset the form.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const parsedAmount = Number.parseInt(amount === "" ? "0" : amount, 10);
  const invalid = !email.includes("@") || Number.isNaN(parsedAmount) || parsedAmount < 0;

  const submit = () => {
    if (invalid) return;
    onSubmit({
      email: email.trim(),
      source,
      kind,
      amount: parsedAmount,
      note: note.trim() || undefined,
      reference: reference.trim() || undefined,
      occurred_at: fromDateTimeLocal(occurredAt),
      locale,
      issue_voucher: issueVoucher,
      notify: issueVoucher && notify,
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t("cms_marketplace:sales.record.title")}>
      <p className="mb-5 text-[13px] leading-relaxed text-neutral-400">{t("cms_marketplace:sales.record.body")}</p>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label={t("cms_marketplace:sales.record.email")} htmlFor="sale-email" hint={t("cms_marketplace:sales.record.email_hint")}>
          <Input
            id="sale-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="persona@example.com"
            autoComplete="off"
          />
        </Field>

        <Field label={t("cms_marketplace:sales.record.source")} htmlFor="sale-source" hint={t("cms_marketplace:sales.record.source_hint")}>
          <Select id="sale-source" value={source} onChange={(event) => setSource(event.target.value)}>
            {MANUAL_SALE_SOURCES.map((entry) => (
              <option key={entry} value={entry}>
                {t(`cms_marketplace:sales.sources.${entry}`)}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("cms_marketplace:sales.record.amount")} htmlFor="sale-amount" hint={t("cms_marketplace:sales.record.amount_hint")}>
          <Input
            id="sale-amount"
            type="number"
            min={0}
            step={1}
            value={amount}
            onChange={(event) => setAmount(event.target.value)}
          />
        </Field>

        <Field label={t("cms_marketplace:sales.record.kind")} htmlFor="sale-kind" hint={t("cms_marketplace:sales.record.kind_hint")}>
          <Select
            id="sale-kind"
            value={kind}
            onChange={(event) => setKind(event.target.value === "donation" ? "donation" : "purchase")}
          >
            <option value="purchase">{t("cms_marketplace:sales.kinds.purchase")}</option>
            <option value="donation">{t("cms_marketplace:sales.kinds.donation")}</option>
          </Select>
        </Field>

        <Field label={t("cms_marketplace:sales.record.occurred_at")} htmlFor="sale-date" hint={t("cms_marketplace:sales.record.occurred_at_hint")}>
          <Input
            id="sale-date"
            type="datetime-local"
            value={occurredAt}
            onChange={(event) => setOccurredAt(event.target.value)}
          />
        </Field>

        <Field label={t("cms_marketplace:sales.record.reference")} htmlFor="sale-reference" hint={t("cms_marketplace:sales.record.reference_hint")}>
          <Input id="sale-reference" value={reference} onChange={(event) => setReference(event.target.value)}/>
        </Field>

        <Field
          label={t("cms_marketplace:sales.record.note")}
          htmlFor="sale-note"
          hint={t("cms_marketplace:sales.record.note_hint")}
          className="sm:col-span-2"
        >
          <Textarea id="sale-note" rows={2} value={note} onChange={(event) => setNote(event.target.value)}/>
        </Field>

        <Field label={t("cms_marketplace:sales.record.locale")} htmlFor="sale-locale" hint={t("cms_marketplace:sales.record.locale_hint")}>
          <Select id="sale-locale" value={locale} onChange={(event) => setLocale(event.target.value)}>
            <option value="es">{t("cms_marketplace:sales.locales.es")}</option>
            <option value="en">{t("cms_marketplace:sales.locales.en")}</option>
          </Select>
        </Field>

        <div className="flex flex-col justify-end gap-2 text-[13px] text-neutral-300">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={issueVoucher}
              onChange={(event) => setIssueVoucher(event.target.checked)}
              className="size-4 accent-accent-500"
            />
            {t("cms_marketplace:sales.record.issue_voucher")}
          </label>
          <label className="flex items-center gap-2 text-neutral-400">
            <input
              type="checkbox"
              checked={notify}
              disabled={!issueVoucher}
              onChange={(event) => setNotify(event.target.checked)}
              className="size-4 accent-accent-500"
            />
            {t("cms_marketplace:sales.record.notify")}
          </label>
        </div>
      </div>

      {mutation.error && (
        <p className="mt-4 text-[13px] text-red-400">
          {/*
            * A 502 means the sale and its receipt are both written and only the email failed, which
            * is a different sentence from "nothing happened" — the list is reloaded either way and
            * "Resend" is on the sale itself.
            */}
          {mutation.status === 502 ? t("cms_marketplace:sales.record.sent_failed") : mutation.error}
        </p>
      )}

      <div className="mt-6 flex flex-wrap justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          {t("admin:common.cancel")}
        </Button>
        <Button onClick={submit} disabled={invalid || mutation.pending}>
          {mutation.pending ? t("admin:common.creating") : t("cms_marketplace:sales.record.submit")}
        </Button>
      </div>
    </Modal>
  );
};
