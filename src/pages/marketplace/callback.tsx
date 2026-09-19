import {useTranslation} from "react-i18next";
import {CallbackPanel} from "@/components/auth/callback-panel.tsx";

/** Where the auth service returns after a sign-in started from the marketplace console. */
export const Callback = () => {
  const {t} = useTranslation("marketplace_admin");

  return <CallbackPanel ns="marketplace_admin" eyebrow={t("app_name")} />;
};
