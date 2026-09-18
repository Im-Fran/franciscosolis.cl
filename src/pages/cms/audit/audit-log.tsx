import {useCallback, useId, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {ArrowClockwise, ClockCounterClockwise, MagnifyingGlass} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Select} from "@/components/ui/input.tsx";
import {Panel, PanelState} from "@/components/ui/panel.tsx";
import {useResource} from "@/lib/auth/useResource.ts";
import {cmsApi} from "@/lib/cms/client.ts";
import type {AuditEntry} from "@/lib/cms/types.ts";
import {AuditEntryItem} from "@/pages/cms/audit/audit-entry.tsx";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {Pagination} from "@/components/admin/pagination.tsx";

/* The API caps `limit` at 200; these are the sizes worth offering, and 25 is a comfortable default. */
const PAGE_SIZES = [25, 50, 100];

/**
 * The audit log: an append-only record of every write the CMS made, newest first.
 *
 * Two things shape this screen. The first is that the response schema guarantees only `id`, `event`
 * and `created_at` — everything else is typed optional because a service like this usually sends it,
 * not because the contract says so. So the log is drawn as a timeline rather than a table: a table
 * commits to a grid of columns and shows its gaps as a field of empty cells, while a timeline reads
 * as complete with three fields and simply says more when more arrives. The second is that the
 * endpoint takes nothing but `limit` and `offset`: no search, no filter by event or actor, and no
 * total. Everything else this screen offers is therefore done over the page that is loaded, and
 * says so out loud rather than pretending to reach the whole log.
 */
export const AuditLog = () => {
  const {t} = useTranslation(["cms_audit", "cms"]);
  const [limit, setLimit] = useState(PAGE_SIZES[0]);
  const [offset, setOffset] = useState(0);
  const [search, setSearch] = useState("");
  const searchId = useId();
  const sizeId = useId();

  const entries = useResource(
    useCallback((signal: AbortSignal) => cmsApi.audit({limit, offset}, signal), [limit, offset]),
  );

  /* Memoised so the filter below only reruns when a fresh page actually arrives. */
  const loaded = useMemo(() => entries.data ?? [], [entries.data]);

  /*
   * Filtering happens here rather than in the request because `/admin/audit` accepts no `search`
   * parameter — sending one would be silently ignored and the page would lie about what it did.
   * The translated label is matched alongside the raw slug, since the reader is searching for the
   * words on screen, not for the vocabulary the service happens to use.
   */
  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return loaded;

    return loaded.filter((entry: AuditEntry) =>
      [
        entry.event,
        t(`cms_audit:events.${entry.event}`, {defaultValue: ""}),
        entry.actor_email,
        entry.actor_id,
        entry.target_type,
        entry.target_id,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [loaded, search, t]);

  const changeSize = (value: number) => {
    setLimit(value);
    /* A page of a different size starting at the old offset would skip or repeat entries. */
    setOffset(0);
  };

  return (
    <>
      <PageHeader
        title={t("cms_audit:title")}
        description={t("cms_audit:description")}
        actions={
          /*
           * The log grows on the service's side and nothing pushes it here. Polling would spend
           * requests on a screen nobody watches for minutes at a time, so the refresh is a button
           * the reader presses when they want a fresh answer — and the entries carry a relative
           * timestamp so a stale page is visibly stale.
           */
          <Button
            variant="secondary"
            size="sm"
            onClick={entries.reload}
            disabled={entries.loading}
            title={t("cms_audit:refresh_hint")}
          >
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <Panel title={t("cms_audit:list.title")} description={t("cms_audit:list.description")}>
        <div className="mb-2 flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label htmlFor={searchId} className="sr-only">
              {t("cms_audit:search.label")}
            </label>
            <div className="relative">
              <MagnifyingGlass
                size={16}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-neutral-600"
              />
              <Input
                id={searchId}
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t("cms_audit:search.placeholder")}
                className="pl-9"
              />
            </div>
          </div>

          {/*
            * The page size sits with the filter rather than next to `Pagination` on purpose:
            * `Pagination` renders nothing while a single page fits, and a control that vanishes
            * exactly when the reader wants to load more of the log is worse than one that stays.
            */}
          <div className="flex items-center gap-2">
            <label htmlFor={sizeId} className="text-[13px] whitespace-nowrap text-neutral-500">
              {t("cms_audit:page_size.label")}
            </label>
            <Select
              id={sizeId}
              value={limit}
              onChange={(event) => changeSize(Number(event.target.value))}
              aria-label={t("cms_audit:page_size.aria")}
              className="w-[5.5rem]"
            >
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </Select>
          </div>
        </div>

        <p className="mb-5 text-xs leading-relaxed text-neutral-600">{t("cms_audit:search.hint")}</p>

        <PanelState
          loading={entries.loading}
          error={entries.error}
          /* Reading the log is a permission of its own: an editor may write content and still be
             refused here, which is a state to explain, not an error to report. */
          forbidden={entries.status === 403}
          onRetry={entries.reload}
          ns="cms"
        >
          {loaded.length === 0 ? (
            <EmptyState
              icon={<ClockCounterClockwise size={28}/>}
              title={offset > 0 ? t("cms_audit:empty.page_title") : t("cms_audit:empty.title")}
              description={offset > 0 ? t("cms_audit:empty.page_body") : t("cms_audit:empty.body")}
            />
          ) : rows.length === 0 ? (
            <div className="flex flex-col items-start gap-3 py-8">
              <p className="text-sm text-neutral-300">{t("cms_audit:search.none_title")}</p>
              <p className="max-w-md text-[13px] leading-relaxed text-neutral-500">
                {t("cms_audit:search.none_body")}
              </p>
              <Button variant="ghost" size="sm" onClick={() => setSearch("")}>
                {t("admin:common.clear_filters")}
              </Button>
            </div>
          ) : (
            <>
              {search.trim() && (
                <p className="mb-4 text-[13px] text-neutral-500">
                  {t("cms_audit:search.matches", {matched: rows.length, total: loaded.length})}
                </p>
              )}
              <ol aria-label={t("cms_audit:list.title")}>
                {rows.map((entry, index) => (
                  <AuditEntryItem key={entry.id} entry={entry} last={index === rows.length - 1}/>
                ))}
              </ol>
            </>
          )}

          {/* Paged over what the service returned, not over the filtered view: the filter never
              changes which slice of the log is loaded. */}
          <Pagination
            offset={offset}
            limit={limit}
            count={loaded.length}
            onChange={setOffset}
            disabled={entries.loading}
          />
        </PanelState>
      </Panel>
    </>
  );
};
