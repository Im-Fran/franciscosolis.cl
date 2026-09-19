import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, LockKey, LockKeyOpen} from "@phosphor-icons/react";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

/**
 * The authentication settings, which today is one switch: whether registration is open.
 *
 * The checkbox writes straight through rather than sitting behind a "Save" button, because there is
 * nothing here to compose: one box, one `PATCH`, and the service answers with the whole resulting
 * set — which is what the screen then shows, so what is ticked is always what the service holds
 * rather than what this browser last clicked. A refused write reverts to the answer, not to an
 * optimistic guess.
 *
 * What the copy has to be honest about is the blast radius, because it is easy to read this as
 * bigger than it is: opening registration only changes what happens to an address that has *no*
 * account here. Nobody's existing account is touched, invitations keep working either way, and
 * closing it again refuses the next sign-up — including a magic link that was emailed while it was
 * open, since the service reads the setting again when the link is used.
 */
export const SettingsPanel = () => {
  const {t} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const {notify} = useToast();

  const settings = useResource(useCallback((signal: AbortSignal) => authApi.admin.settings(signal), []));
  const save = useMutation(useCallback((open: boolean) => authApi.admin.updateSettings({registration_open: open}), []));

  /* What the service last confirmed, so the box never shows a value nothing agreed to. */
  const [confirmed, setConfirmed] = useState<boolean | null>(null);
  const open = confirmed ?? settings.data?.registration_open ?? false;
  const mayWrite = can("settings:write");

  const toggle = async (next: boolean) => {
    const result = await save.run(next);
    if (!result.ok) {
      notify(t(`admin:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    setConfirmed(result.data.registration_open);
    notify(result.data.registration_open ? t("auth_admin:settings.opened") : t("auth_admin:settings.closed"));
  };

  return (
    <>
      <PageHeader
        title={t("auth_admin:settings.title")}
        description={t("auth_admin:settings.description")}
        actions={
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setConfirmed(null);
              settings.reload();
            }}
          >
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <SectionState resource={settings}>
        <Surface>
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={open}
              disabled={!mayWrite || save.pending}
              onChange={(event) => void toggle(event.target.checked)}
              className="mt-1"
            />
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-sm text-text">
                {open ? <LockKeyOpen size={16} className="text-emerald-400"/> : <LockKey size={16}/>}
                {t("auth_admin:settings.registration_label")}
                {save.pending && <Spinner size={14}/>}
              </span>
              <span className="mt-1 block text-[13px] leading-relaxed text-neutral-400">
                {open ? t("auth_admin:settings.registration_open") : t("auth_admin:settings.registration_closed")}
              </span>
              <span className="mt-2 block text-[12px] leading-relaxed text-neutral-600">
                {t("auth_admin:settings.registration_hint")}
              </span>
            </span>
          </label>
        </Surface>

        {!mayWrite && (
          <div className="mt-5">
            <Alert tone="info">{t("auth_admin:settings.read_only")}</Alert>
          </div>
        )}

        <p className="mt-5 text-[13px] leading-relaxed text-neutral-500">{t("auth_admin:settings.turnstile_note")}</p>
      </SectionState>
    </>
  );
};
