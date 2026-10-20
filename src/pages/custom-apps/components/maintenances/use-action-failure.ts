import {useTranslation} from "react-i18next";

/**
 * What the service's refusals of a send, a resend or a schedule mean, in words — each one is a
 * different thing to go and fix (the app's state, the client's contacts, a window, the mail).
 */
export const useActionFailure = () => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  return (status: number | null, message: string) => {
    if (status === 409 && /suspended/i.test(message)) return t("custom_apps:maintenances.errors.paused_suspended");
    if (status === 409 && /grace/i.test(message)) return t("custom_apps:maintenances.errors.paused_grace");
    if (status === 409 && /security patch needs no approval/i.test(message)) return t("custom_apps:maintenances.errors.security_send");
    if (status === 409 && /only a security patch/i.test(message)) return t("custom_apps:maintenances.errors.normal_schedule");
    if (status === 409) return t("custom_apps:maintenances.errors.changed", {detail: message});
    if (status === 422 && /no contact|nobody|email address/i.test(message)) return t("custom_apps:maintenances.errors.no_recipients");
    if (status === 422 && /at least one window/i.test(message)) return t("custom_apps:maintenances.errors.no_windows");
    if (status === 422 && /already started|started/i.test(message)) return t("custom_apps:maintenances.errors.window_started");
    if (status === 422 && /fits/i.test(message)) return t("custom_apps:maintenances.errors.no_fit", {detail: message});
    if (status === 422 && /release/i.test(message)) return t("custom_apps:maintenances.errors.release_unusable");
    if (status === 502) return t("custom_apps:maintenances.errors.mail");
    return t(`admin:errors.${message}`, {defaultValue: message});
  };
};
