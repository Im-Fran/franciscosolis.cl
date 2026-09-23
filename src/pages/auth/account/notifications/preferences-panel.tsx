import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, Info} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {CHANNELS, EMAIL_FREQUENCIES, NOTIFICATION_CATEGORIES} from "@/lib/notifications/config.ts";
import {notificationsApi} from "@/lib/notifications/client.ts";
import type {NotificationPreferences, PreferencesPatch} from "@/lib/notifications/types.ts";
import {Panel, PanelState} from "@/pages/auth/components/panel.tsx";

/**
 * How the account wants to be reached outside the site: one email frequency, and a push/email
 * switch per category.
 *
 * Every control writes straight through, the way the console's settings do: one change, one `PUT`
 * carrying only that change, and the service answers with the whole resulting set — which is what
 * the screen shows next. So what is ticked is always what the service holds, and a refused write
 * falls back to the last answer rather than to an optimistic guess.
 *
 * Two things the copy has to be honest about, because both are easy to misread: the in-site list is
 * not a channel you can switch off (it is the record every other channel points at), and a handful
 * of emails — the ones that *are* the thing you asked for, or a receipt you need — keep arriving
 * whatever is chosen here, since their producers send them directly.
 */
export const PreferencesPanel = () => {
  const {t} = useTranslation(["notifications", "auth"]);
  const {notify} = useToast();
  const preferences = useResource(useCallback((signal: AbortSignal) => notificationsApi.preferences(signal), []));
  const save = useMutation(useCallback((patch: PreferencesPatch) => notificationsApi.updatePreferences(patch), []));

  /* What the service last confirmed, so a control never shows a value nothing agreed to. */
  const [confirmed, setConfirmed] = useState<NotificationPreferences | null>(null);
  const current = confirmed ?? preferences.data;

  const write = async (patch: PreferencesPatch) => {
    const result = await save.run(patch);
    if (!result.ok) {
      notify(t(`auth:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    setConfirmed(result.data);
    notify(t("notifications:preferences.saved"));
  };

  return (
    <Panel
      title={t("notifications:preferences.title")}
      description={t("notifications:preferences.description")}
      action={
        <span className="flex items-center gap-2">
          {save.pending && <Spinner size={14}/>}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirmed(null);
              preferences.reload();
            }}
          >
            <ArrowClockwise size={14}/> {t("auth:common.refresh")}
          </Button>
        </span>
      }
    >
      <PanelState loading={preferences.loading && !current} error={current ? null : preferences.error} onRetry={preferences.reload}>
        {current && (
          <div className="flex flex-col gap-7">
            <fieldset className="flex flex-col gap-2" disabled={save.pending}>
              <legend className="mb-2 text-sm font-medium text-neutral-300">
                {t("notifications:preferences.frequency_label")}
              </legend>
              {EMAIL_FREQUENCIES.map((frequency) => (
                <label
                  key={frequency}
                  className="flex cursor-pointer items-start gap-3 rounded-[var(--radius-md)] px-3 py-2.5 transition-colors hover:bg-neutral-800/40 has-[:checked]:bg-accent-900/30"
                >
                  <input
                    type="radio"
                    name="email-frequency"
                    value={frequency}
                    checked={current.email_frequency === frequency}
                    onChange={() => void write({email_frequency: frequency})}
                    className="mt-1"
                  />
                  <span className="min-w-0">
                    <span className="block text-sm text-text">{t(`notifications:preferences.frequency.${frequency}`)}</span>
                    <span className="mt-0.5 block text-[13px] leading-relaxed text-neutral-500">
                      {t(`notifications:preferences.frequency.${frequency}_hint`)}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            <fieldset disabled={save.pending}>
              <legend className="mb-3 text-sm font-medium text-neutral-300">
                {t("notifications:preferences.matrix_label")}
              </legend>
              <table className="w-full max-w-md text-sm">
                <thead>
                  <tr className="text-left text-[12px] tracking-wide text-neutral-500 uppercase">
                    <th scope="col" className="pb-2 font-medium">{t("notifications:preferences.category")}</th>
                    {CHANNELS.map((channel) => (
                      <th key={channel} scope="col" className="w-20 pb-2 text-center font-medium">
                        {t(`notifications:preferences.channel.${channel}`)}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-800">
                  {NOTIFICATION_CATEGORIES.map((category) => (
                    <tr key={category}>
                      <th scope="row" className="py-3 text-left font-normal text-text">
                        {t(`notifications:categories.${category}`)}
                      </th>
                      {CHANNELS.map((channel) => (
                        <td key={channel} className="py-3 text-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 cursor-pointer"
                            checked={current.categories[category]?.[channel] ?? true}
                            aria-label={t("notifications:preferences.toggle", {
                              channel: t(`notifications:preferences.channel.${channel}`),
                              category: t(`notifications:categories.${category}`),
                            })}
                            onChange={(event) =>
                              void write({categories: {[category]: {[channel]: event.target.checked}}})
                            }
                          />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </fieldset>

            <div className="flex flex-col gap-2 text-[13px] leading-relaxed text-neutral-500">
              <p className="flex gap-2">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden/>
                {t("notifications:preferences.in_site_note")}
              </p>
              <p className="flex gap-2">
                <Info size={16} className="mt-0.5 shrink-0" aria-hidden/>
                {t("notifications:preferences.always_sent_note")}
              </p>
            </div>
          </div>
        )}
      </PanelState>
    </Panel>
  );
};
