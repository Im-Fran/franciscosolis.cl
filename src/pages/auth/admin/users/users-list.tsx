import {useCallback, useEffect, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {useNavigate, useSearchParams} from "react-router-dom";
import {ArrowClockwise, MagnifyingGlass, Users} from "@phosphor-icons/react";
import {DataTable} from "@/components/admin/data-table.tsx";
import type {Column} from "@/components/admin/data-table.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Badge} from "@/components/ui/badge/badge.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {formatDate} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {AdminUserSummary} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

const PAGE_SIZE = 25;

/**
 * Every account on the service.
 *
 * The search and the page live in the query string rather than in component state, so a filtered
 * view is a URL somebody can send: "the four accounts matching `@franciscosolis.cl`" is a thing an
 * operator wants to hand over, not re-type.
 */
export const UsersList = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  const search = params.get("q") ?? "";
  const offset = Number(params.get("offset") ?? 0) || 0;
  const [draft, setDraft] = useState(search);

  /* The address bar is the source of truth, so a back navigation puts the box back in step. */
  useEffect(() => setDraft(search), [search]);

  /* Debounced: typing a name should not fire a request per keystroke. */
  useEffect(() => {
    if (draft === search) return;
    const timer = setTimeout(() => {
      setParams((current) => {
        const next = new URLSearchParams(current);
        if (draft.trim()) next.set("q", draft.trim());
        else next.delete("q");
        next.delete("offset");
        return next;
      }, {replace: true});
    }, 300);
    return () => clearTimeout(timer);
  }, [draft, search, setParams]);

  const users = useResource(
    useCallback(
      (signal: AbortSignal) =>
        authApi.admin.users({query: search || undefined, limit: PAGE_SIZE, offset}, signal),
      [search, offset],
    ),
  );

  const rows = users.data ?? [];

  const columns = useMemo<Column<AdminUserSummary>[]>(
    () => [
      {
        key: "user",
        header: t("auth_admin:users.column_user"),
        cell: (user) => (
          <span className="flex items-center gap-3">
            <Avatar name={user.name} email={user.email} picture={user.picture} size={32}/>
            <span className="min-w-0">
              <span className="block truncate text-text">{user.name || user.email}</span>
              {user.name && <span className="block truncate text-[12px] text-neutral-500">{user.email}</span>}
            </span>
          </span>
        ),
      },
      {
        key: "status",
        header: t("auth_admin:users.column_status"),
        className: "w-36",
        cell: (user) =>
          user.status === "disabled" ? (
            <Badge variant="outline" size="sm">{t("auth_admin:status.disabled")}</Badge>
          ) : (
            <span className="text-neutral-400">{t("auth_admin:status.active")}</span>
          ),
      },
      {
        key: "last_login",
        header: t("auth_admin:users.column_last_login"),
        className: "w-44",
        hideBelowLg: true,
        cell: (user) => formatDate(user.last_login_at, i18n.language) ?? t("admin:common.none"),
      },
      {
        key: "created",
        header: t("auth_admin:users.column_created"),
        className: "w-44",
        hideBelowLg: true,
        cell: (user) => formatDate(user.created_at, i18n.language) ?? t("admin:common.none"),
      },
    ],
    [t, i18n.language],
  );

  return (
    <>
      <PageHeader
        title={t("auth_admin:users.title")}
        description={t("auth_admin:users.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={users.reload} data-fs-hover>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <Surface>
        <div className="relative mb-5">
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"
          />
          <Input
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            placeholder={t("auth_admin:users.search_placeholder")}
            aria-label={t("auth_admin:users.search_placeholder")}
            className="pl-9"
            type="search"
          />
        </div>

        <SectionState
          resource={users}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<Users size={32}/>}
              title={search ? t("auth_admin:users.no_matches") : t("auth_admin:users.empty")}
              description={search ? t("auth_admin:users.no_matches_hint") : t("auth_admin:users.empty_hint")}
            />
          }
        >
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(user) => user.id}
            caption={t("auth_admin:users.title")}
            onRowClick={(user) => navigate(adminRoute.user(user.id))}
          />
          <Pagination
            offset={offset}
            limit={PAGE_SIZE}
            count={rows.length}
            onChange={(next) =>
              setParams((current) => {
                const params = new URLSearchParams(current);
                if (next > 0) params.set("offset", String(next));
                else params.delete("offset");
                return params;
              })
            }
          />
        </SectionState>
      </Surface>
    </>
  );
};
