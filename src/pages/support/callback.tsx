import {useTranslation} from "react-i18next";
import {CallbackPanel} from "@/components/auth/callback-panel.tsx";

/** Where the auth service returns after a sign-in started from the support console. */
export const Callback = () => {
  const {t} = useTranslation("support_agent");

  return <CallbackPanel ns="support_agent" eyebrow={t("app_name")} />;
};
