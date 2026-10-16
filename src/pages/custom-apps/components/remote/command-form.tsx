import {useCallback, useState} from "react";
import type {FormEvent} from "react";
import {useTranslation} from "react-i18next";
import {CaretRight, PaperPlaneTilt} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Field, Select} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useToast} from "@/lib/admin/toast-context.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {useServiceVocabulary} from "@/lib/custom-apps/custom-apps-context.ts";
import {formatDuration} from "@/lib/custom-apps/format.ts";
import type {App, Command, CommandType, Installation, NewCommand} from "@/lib/custom-apps/types.ts";
import {cn} from "@/lib/utils.ts";
import {parseJsonObject} from "@/lib/cms/json.ts";
import {JsonField} from "@/pages/custom-apps/components/json-field.tsx";
import {commandUnavailable} from "@/pages/custom-apps/components/remote/commands.ts";

/** How long a command may wait for the device, in seconds. The service takes 60 to 604 800. */
const EXPIRY_OPTIONS = [300, 900, 3600, 21_600, 86_400, 604_800] as const;
const DEFAULT_EXPIRY = 3600;

/** The catalogue, one command at a time: what it does, how long it may wait, and an optional payload. */
export const CommandForm = ({
  installation,
  app,
  onSent,
}: {
  installation: Installation;
  app: App | null;
  onSent: (command: Command) => void;
}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const {notify} = useToast();
  const {commandTypes} = useServiceVocabulary();
  const revoked = installation.status === "revoked";

  const firstAvailable = commandTypes.find((type) => !commandUnavailable(type, app, installation)) ?? commandTypes[0];
  const [type, setType] = useState<CommandType>(firstAvailable);
  const [expires, setExpires] = useState<number>(DEFAULT_EXPIRY);
  const [withPayload, setWithPayload] = useState(false);
  const [payload, setPayload] = useState("");

  const send = useMutation(
    useCallback((body: NewCommand) => customAppsApi.commands.create(installation.id, body), [installation.id]),
  );

  const unavailable = commandUnavailable(type, app, installation);
  const parsed = parseJsonObject(withPayload ? payload : "");
  const blocked = revoked || Boolean(unavailable) || !parsed.ok;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (blocked || !parsed.ok) return;
    const outcome = await send.run({
      type,
      expires_in_seconds: expires,
      ...(parsed.value ? {payload: parsed.value} : {}),
    });
    if (!outcome.ok) return;
    notify(t("custom_apps:commands.sent", {type: t(`custom_apps:commands.types.${type}`, {defaultValue: type})}));
    setPayload("");
    setWithPayload(false);
    onSent(outcome.data);
  };

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-col gap-4 rounded-[var(--radius-md)] border border-neutral-800 px-4 py-4"
    >
      {revoked && (
        <Alert tone="info" title={t("custom_apps:commands.revoked_title")}>
          {t("custom_apps:commands.revoked_body")}
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <Field
          label={t("custom_apps:commands.type")}
          htmlFor="command-type"
          hint={
            unavailable
              ? undefined
              : t(`custom_apps:commands.types_hint.${type}`, {defaultValue: ""}) || undefined
          }
          error={unavailable ? t(`custom_apps:commands.unavailable.${unavailable}`) : undefined}
        >
          <Select
            id="command-type"
            value={type}
            disabled={revoked || send.pending}
            onChange={(event) => {
              setType(event.target.value as CommandType);
              send.reset();
            }}
          >
            {commandTypes.map((option) => (
              <option key={option} value={option} disabled={Boolean(commandUnavailable(option, app, installation))}>
                {t(`custom_apps:commands.types.${option}`, {defaultValue: option})}
              </option>
            ))}
          </Select>
        </Field>

        <Field label={t("custom_apps:commands.expires")} htmlFor="command-expires" hint={t("custom_apps:commands.expires_hint")}>
          <Select
            id="command-expires"
            value={expires}
            disabled={revoked || send.pending}
            onChange={(event) => setExpires(Number(event.target.value))}
          >
            {EXPIRY_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {formatDuration(seconds)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={() => setWithPayload((value) => !value)}
          aria-expanded={withPayload}
          disabled={revoked}
          className="inline-flex w-fit cursor-pointer items-center gap-1 text-[13px] text-neutral-400 transition-colors hover:text-text disabled:cursor-not-allowed disabled:opacity-50"
        >
          <CaretRight size={12} className={cn("transition-transform", withPayload && "rotate-90")} aria-hidden="true" />
          {t("custom_apps:commands.payload_toggle")}
        </button>
        {withPayload && (
          <>
            <label htmlFor="command-payload" className="sr-only">
              {t("custom_apps:commands.payload")}
            </label>
            <JsonField id="command-payload" value={payload} onChange={setPayload} rows={4} disabled={send.pending} />
            <p className="text-xs text-neutral-500">{t("custom_apps:commands.payload_hint")}</p>
          </>
        )}
      </div>

      {send.error && (
        <Alert tone="error" title={t("admin:common.failed")}>
          {t(`admin:errors.${send.error}`, {defaultValue: send.error})}
        </Alert>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={blocked || send.pending}>
          {send.pending ? <Spinner size={16} /> : <PaperPlaneTilt size={16} />}
          {send.pending ? t("custom_apps:commands.sending") : t("custom_apps:commands.send")}
        </Button>
      </div>
    </form>
  );
};
