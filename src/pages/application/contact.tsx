import {useTranslation} from "react-i18next";
import {useApplicationPage} from "@/pages/application/application-context.ts";
import {ApplicationProse} from "@/pages/application/components/application-prose.tsx";

/**
 * The Contact tab: how to reach whoever maintains this application.
 *
 * Only the editorial body lives here. The application's links already sit under the banner, a few
 * pixels above this text and in view the whole time — repeating them at the bottom of the tab said
 * the same thing twice rather than giving a visitor anywhere new to go.
 */
export const ApplicationContact = () => {
  const {t} = useTranslation(["application"]);
  const {application} = useApplicationPage();
  const body = application.contact_body?.trim();

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-8">
      {body ? (
        <ApplicationProse source={body}/>
      ) : (
        <p className="py-8 text-center text-sm text-neutral-500">{t("application:contact.empty")}</p>
      )}
    </div>
  );
};
