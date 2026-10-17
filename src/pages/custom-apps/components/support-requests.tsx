import {useCallback} from "react";
import {useTranslation} from "react-i18next";
import {Lifebuoy} from "@phosphor-icons/react";
import type {AuditEntry} from "@/lib/custom-apps/types.ts";
import {AuditTrail} from "@/pages/custom-apps/components/audit-trail.tsx";

/**
 * What the in-app support form sent from this device. The request itself went by email to soporte@
 * with the device's context — there are no tickets in the panel, by decision — so all the panel has
 * is the audit entry the service wrote for each one: its subject, whether a reply address was given
 * and whether diagnostics were attached.
 */
export const SupportRequests = ({installationId}: {installationId: string}) => {
  const {t} = useTranslation("custom_apps");

  const describe = useCallback(
    (entry: AuditEntry) => {
      const metadata = entry.metadata ?? {};
      const subject = typeof metadata.subject === "string" ? metadata.subject : null;
      const flags = [
        metadata.has_reply_address === true ? t("support.with_reply") : t("support.without_reply"),
        metadata.diagnostics === true ? t("support.with_diagnostics") : null,
      ].filter(Boolean);
      return (
        <>
          {subject && <span className="block text-neutral-300">«{subject}»</span>}
          <span className="block text-[12px] text-neutral-500">{flags.join(" · ")}</span>
        </>
      );
    },
    [t],
  );

  return (
    <AuditTrail
      title={t("support.title")}
      description={t("support.description")}
      query={{event: "support.requested", resource_type: "installation", resource_id: installationId}}
      describe={describe}
      icon={<Lifebuoy size={28} />}
      emptyTitle={t("support.empty")}
      emptyDescription={t("support.empty_description")}
      systemActor={t("support.from_device")}
    />
  );
};
