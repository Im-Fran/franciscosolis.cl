import {useTranslation} from "react-i18next";
import {CallbackPanel} from "@/components/auth/callback-panel.tsx";

/** Where the auth service returns after a sign-in started from the custom-apps panel. */
export const Callback = () => {
  const {t} = useTranslation("custom_apps");

  return <CallbackPanel ns="custom_apps" eyebrow={t("app_name")} />;
};
