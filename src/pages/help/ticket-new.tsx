import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {CheckCircle} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {helpRoute} from "@/lib/support/config.ts";
import {supportContent} from "@/lib/support/content.ts";
import type {CreatedTicket, SupportLocale} from "@/lib/support/types.ts";

const SUPPORT_ADDRESS = "soporte@franciscosolis.cl";

/**
 * The ticket form.
 *
 * Public and unauthenticated by design: somebody who cannot sign in is exactly the person most
 * likely to need support, so requiring an account here would lock out the hardest cases. If they
 * *do* happen to have a session, the client sends its token and the ticket is linked to the account
 * on the way in.
 */
export const TicketNew = () => {
  const {t, i18n} = useTranslation("support");
  const [created, setCreated] = useState<CreatedTicket | null>(null);
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  /* The honeypot. Never shown, never filled by a person, and a filled one is answered normally. */
  const [website, setWebsite] = useState("");

  const submit = useMutation(
    useCallback(
      (payload: Parameters<typeof supportContent.openTicket>[0]) => supportContent.openTicket(payload),
      [],
    ),
  );

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const outcome = await submit.run({
      subject: subject.trim(),
      body: body.trim(),
      email: email.trim(),
      name: name.trim() || undefined,
      locale: (i18n.resolvedLanguage as SupportLocale) ?? "en",
      website: website || undefined,
    });
    if (outcome.ok) setCreated(outcome.data);
  };

  if (created) {
    return (
      <div className="mx-auto w-full max-w-lg px-4 py-16 text-center">
        <CheckCircle size={40} className="mx-auto mb-4 text-emerald-400" aria-hidden />
        <h1 className="font-display text-2xl text-text">{t("ticket.created_title")}</h1>
        <p className="mt-3 text-sm text-neutral-400">
          {t("ticket.created_lead", {reference: created.reference})}
        </p>

        {/*
          The link is shown as well as emailed, because this is the one moment the secret exists in
          the open: only its hash is stored, and nothing afterwards can rebuild it.
        */}
        <a
          href={created.url}
          className="mt-6 inline-block rounded-[var(--radius-sm)] bg-accent-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-accent-400"
        >
          {t("ticket.created_open")}
        </a>

        <p className="mt-6 text-xs text-neutral-500">{t("ticket.or_email", {address: SUPPORT_ADDRESS})}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-lg px-4 py-12">
      <h1 className="font-display text-2xl text-text">{t("ticket.new_title")}</h1>
      <p className="mt-2 text-sm text-neutral-400">{t("ticket.new_lead")}</p>

      <form onSubmit={onSubmit} className="mt-8 flex flex-col gap-5" noValidate>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-300">{t("ticket.subject")}</span>
          <Input value={subject} onChange={(event) => setSubject(event.target.value)} placeholder={t("ticket.subject_placeholder")} required />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-300">{t("ticket.body")}</span>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            placeholder={t("ticket.body_placeholder")}
            rows={7}
            required
            className="w-full rounded-[var(--radius-sm)] border border-neutral-700 bg-neutral-900/60 px-3 py-2 text-sm text-text placeholder:text-neutral-600 focus:border-accent-500 focus:outline-none"
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-300">{t("ticket.email")}</span>
          <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-sm text-neutral-300">
            {t("ticket.name")} <span className="text-neutral-600">({t("ticket.name_optional")})</span>
          </span>
          <Input value={name} onChange={(event) => setName(event.target.value)} />
        </label>

        {/* Off-screen rather than `display: none`: a bot reading the DOM fills it either way, and a
            password manager is less likely to autofill something it cannot see as a real field. */}
        <div aria-hidden className="absolute left-[-9999px] h-px w-px overflow-hidden">
          <label>
            Website
            <input value={website} onChange={(event) => setWebsite(event.target.value)} tabIndex={-1} autoComplete="off" />
          </label>
        </div>

        {submit.error ? <Alert tone="error">{submit.error}</Alert> : null}

        <Button type="submit" disabled={submit.pending}>
          {submit.pending ? t("ticket.sending") : t("ticket.submit")}
        </Button>
      </form>

      <p className="mt-8 text-center text-xs text-neutral-500">
        {t("ticket.or_email", {address: SUPPORT_ADDRESS})}{" "}
        <Link to={helpRoute.home} className="text-accent-300 underline underline-offset-4">
          {t("help.back_to_help")}
        </Link>
      </p>
    </div>
  );
};
