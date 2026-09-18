import {useTranslation} from "react-i18next";
import {useApplicationPage} from "@/pages/application/application-context.ts";
import {ApplicationLinks} from "@/pages/application/components/application-links.tsx";
import {ApplicationProse} from "@/pages/application/components/application-prose.tsx";

/**
 * The Contact tab: how to reach whoever maintains this application.
 *
 * The application's own links are repeated under the text rather than left only in the header. A
 * visitor who navigated here wants a way to get in touch, and "the Discord button is back up at the
 * top" is a worse answer than showing it again where they are looking.
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

      {application.links.length > 0 && (
        <section className="border-t border-neutral-800 pt-8">
          <h2 className="mb-4 text-sm font-medium tracking-wide text-neutral-400 uppercase">
            {t("application:contact.links_title")}
          </h2>
          <ApplicationLinks links={application.links} size="sm"/>
        </section>
      )}
    </div>
  );
};
