import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link} from "react-router-dom";
import {Lifebuoy} from "@phosphor-icons/react";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {TicketRow} from "@/pages/custom-apps/components/tickets/ticket-row.tsx";

const PAGE_SIZE = 10;

/**
 * The support tickets opened from one device, whatever their status, most recently active first —
 * each one a link to its conversation. The inbox filtered to this device is one click away for
 * anything more than reading down the list.
 */
export const InstallationTickets = ({installationId}: {installationId: string}) => {
  const {t} = useTranslation(["custom_apps", "admin"]);
  const [offset, setOffset] = useState(0);

  const tickets = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.tickets.list({installation_id: installationId, limit: PAGE_SIZE, offset}, signal),
      [installationId, offset],
    ),
  );
  const rows = tickets.data?.data ?? [];

  return (
    <Panel
      title={t("custom_apps:tickets.installation_panel.title")}
      description={t("custom_apps:tickets.installation_panel.description")}
      action={
        <Link
          to={customAppsRoute.tickets({installation_id: installationId, status: "all"})}
          className="text-[13px] text-neutral-400 hover:text-text hover:underline"
        >
          {t("custom_apps:tickets.installation_panel.see_all")}
        </Link>
      }
    >
      <PanelState loading={tickets.loading && !tickets.data} error={tickets.error} onRetry={tickets.reload} ns="admin">
        {rows.length === 0 ? (
          <EmptyState
            icon={<Lifebuoy size={28} />}
            title={t("custom_apps:tickets.installation_panel.empty")}
            description={t("custom_apps:tickets.installation_panel.empty_description")}
          />
        ) : (
          <ul className={tickets.loading ? "flex flex-col gap-2 opacity-60 transition-opacity" : "flex flex-col gap-2"}>
            {rows.map((ticket) => (
              <TicketRow key={ticket.id} ticket={ticket} />
            ))}
          </ul>
        )}
        <Pagination
          offset={offset}
          limit={PAGE_SIZE}
          count={rows.length}
          total={tickets.data?.pagination.total}
          onChange={setOffset}
          disabled={tickets.loading}
        />
      </PanelState>
    </Panel>
  );
};
