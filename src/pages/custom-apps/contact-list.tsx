import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useNavigate} from "react-router-dom";
import {useDebounceValue} from "usehooks-ts";
import {AddressBook, ArrowClockwise, Plus} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {customAppsRoute} from "@/lib/custom-apps/config.ts";
import type {Contact} from "@/lib/custom-apps/types.ts";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {SearchBox} from "@/pages/custom-apps/components/search-box.tsx";

const PAGE_SIZE = 50;

/** The first entry of a list, with a "+2" for the rest — a table cell has room for one address. */
const firstOf = (values: string[]) =>
  values.length === 0 ? null : values.length === 1 ? values[0] : `${values[0]} +${values.length - 1}`;

/**
 * The people at the clients. A contact exists on its own and is linked to companies with roles,
 * because the same person is often the technical contact for one client and the owner of another.
 */
export const ContactList = () => {
  const {t, i18n} = useTranslation(["custom_apps", "admin"]);
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [debounced] = useDebounceValue(search.trim(), 300);
  const [offset, setOffset] = useState(0);

  const contacts = useResource(
    useCallback(
      (signal: AbortSignal) => customAppsApi.contacts.list({search: debounced, limit: PAGE_SIZE, offset}, signal),
      [debounced, offset],
    ),
  );

  const rows = contacts.data?.data ?? [];
  const total = contacts.data?.pagination.total ?? 0;

  const columns = useMemo<Column<Contact>[]>(
    () => [
      {
        key: "name",
        header: t("custom_apps:contacts.columns.name"),
        cell: (row) => <span className="text-sm text-text">{row.name}</span>,
      },
      {
        key: "email",
        header: t("custom_apps:contacts.columns.email"),
        cell: (row) => firstOf(row.emails) ?? <span className="text-neutral-600">—</span>,
      },
      {
        key: "phone",
        header: t("custom_apps:contacts.columns.phone"),
        className: "w-44",
        hideBelowLg: true,
        cell: (row) => firstOf(row.phones) ?? <span className="text-neutral-600">—</span>,
      },
      {
        key: "companies",
        header: t("custom_apps:contacts.columns.companies"),
        className: "w-28 tabular-nums",
        cell: (row) => row.company_count,
      },
      {
        key: "updated",
        header: t("custom_apps:contacts.columns.updated"),
        className: "w-32",
        hideBelowLg: true,
        cell: (row) => formatDate(row.updated_at, i18n.language),
      },
    ],
    [i18n.language, t],
  );

  return (
    <>
      <PageHeader
        title={t("custom_apps:contacts.title")}
        description={t("custom_apps:contacts.description")}
        actions={
          <Button asChild>
            <Link to={customAppsRoute.contactNew}>
              <Plus size={16} /> {t("custom_apps:contacts.new")}
            </Link>
          </Button>
        }
      />

      <Panel
        title={t("custom_apps:contacts.panel_title")}
        description={contacts.data ? t("custom_apps:contacts.count", {count: total}) : undefined}
        action={
          <Button variant="ghost" size="sm" onClick={contacts.reload}>
            <ArrowClockwise size={14} /> {t("admin:common.refresh")}
          </Button>
        }
      >
        <div className="mb-5 flex">
          <SearchBox
            value={search}
            onChange={(value) => {
              setSearch(value);
              setOffset(0);
            }}
            placeholder={t("custom_apps:contacts.search")}
          />
        </div>

        <PanelState
          loading={contacts.loading && !contacts.data}
          error={contacts.error}
          forbidden={contacts.status === 403}
          onRetry={contacts.reload}
          ns="admin"
        >
          {rows.length === 0 ? (
            debounced ? (
              <p className="py-4 text-sm text-neutral-500">{t("custom_apps:no_matches", {search: debounced})}</p>
            ) : (
              <EmptyState
                icon={<AddressBook size={28} />}
                title={t("custom_apps:contacts.empty_title")}
                description={t("custom_apps:contacts.empty_description")}
              />
            )
          ) : (
            <DataTable
              columns={columns}
              rows={rows}
              rowKey={(row) => row.id}
              onRowClick={(row) => navigate(customAppsRoute.contact(row.id))}
              caption={t("custom_apps:contacts.title")}
              className={contacts.loading ? "opacity-60 transition-opacity" : undefined}
            />
          )}

          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            total={total}
            onChange={setOffset}
            disabled={contacts.loading}
          />
        </PanelState>
      </Panel>
    </>
  );
};
