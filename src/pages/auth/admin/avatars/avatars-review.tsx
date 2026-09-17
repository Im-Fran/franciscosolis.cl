import {useCallback, useMemo, useState} from "react";
import {useTranslation} from "react-i18next";
import {Link, useSearchParams} from "react-router-dom";
import {ArrowClockwise, CheckCircle, ImageSquare, XCircle} from "@phosphor-icons/react";
import {EmptyState} from "@/components/admin/empty-state.tsx";
import {PageHeader} from "@/components/admin/page-header.tsx";
import {StatusBadge} from "@/components/admin/status-badge.tsx";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {useAdmin} from "@/lib/auth/admin-context.ts";
import {authApi} from "@/lib/auth/api.ts";
import {adminRoute} from "@/lib/auth/config.ts";
import {formatDateTime} from "@/lib/auth/format.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {AdminAvatarUpload, AvatarStatus} from "@/lib/auth/types.ts";
import {SectionState, Surface} from "@/pages/auth/admin/components/section.tsx";

const FILTERS = ["pending", "approved", "rejected", "superseded"] as const satisfies readonly AvatarStatus[];
type Filter = (typeof FILTERS)[number];

const isFilter = (value: string | null): value is Filter => FILTERS.includes(value as Filter);

/** Megabytes, as a person reads a file size. */
const inMegabytes = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

/**
 * The avatar review queue.
 *
 * A picture uploaded here is unreachable until somebody on this screen approves it, so this is not
 * a moderation backlog that trails what the world already sees — it is the step that decides
 * whether anyone sees it at all. The bytes arrive inline as `preview`, because a pending upload has
 * no URL to load: that is the same fact from the other side.
 *
 * The filter and the account live in the query string, so "everything waiting from this person" is
 * a URL an operator can hand over — which is what the link from a user's page is.
 */
export const AvatarsReview = () => {
  const {t, i18n} = useTranslation(["auth_admin", "admin"]);
  const {can} = useAdmin();
  const {notify} = useToast();
  const [params, setParams] = useSearchParams();

  const status: Filter = isFilter(params.get("status")) ? (params.get("status") as Filter) : "pending";
  const userId = params.get("user_id") ?? undefined;

  const uploads = useResource(
    useCallback((signal: AbortSignal) => authApi.admin.avatars({status, user_id: userId}, signal), [status, userId]),
  );

  const approve = useMutation(useCallback((id: string) => authApi.admin.approveAvatar(id), []));
  const reject = useMutation(
    useCallback((id: string, reason: string | null) => authApi.admin.rejectAvatar(id, reason), []),
  );

  const [refusing, setRefusing] = useState<AdminAvatarUpload | null>(null);
  const [reason, setReason] = useState("");

  const rows = useMemo(() => uploads.data ?? [], [uploads.data]);
  const mayReview = can("avatars:review");

  const setFilter = (next: Filter) =>
    setParams((current) => {
      const search = new URLSearchParams(current);
      search.set("status", next);
      return search;
    });

  const onApprove = async (upload: AdminAvatarUpload) => {
    const result = await approve.run(upload.id);
    if (!result.ok) {
      notify(t(`admin:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    uploads.reload();
    notify(t("auth_admin:avatars.approved", {user: upload.user_email ?? upload.user_id}));
  };

  const onReject = async () => {
    if (!refusing) return;
    const result = await reject.run(refusing.id, reason.trim() || null);
    if (!result.ok) {
      notify(t(`admin:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }
    setRefusing(null);
    setReason("");
    uploads.reload();
    notify(t("auth_admin:avatars.rejected"));
  };

  return (
    <>
      <PageHeader
        title={t("auth_admin:avatars.title")}
        description={t("auth_admin:avatars.description")}
        actions={
          <Button variant="ghost" size="sm" onClick={uploads.reload} data-fs-hover>
            <ArrowClockwise size={14}/> {t("admin:common.refresh")}
          </Button>
        }
      />

      <div className="mb-5 flex flex-wrap items-center gap-2">
        {FILTERS.map((value) => (
          <Button
            key={value}
            size="sm"
            variant={value === status ? "primary" : "ghost"}
            onClick={() => setFilter(value)}
            data-fs-hover
          >
            {t(`auth_admin:avatars.filter_${value}`)}
          </Button>
        ))}
        {userId && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() =>
              setParams((current) => {
                const search = new URLSearchParams(current);
                search.delete("user_id");
                return search;
              })
            }
            data-fs-hover
          >
            <XCircle size={14}/> {t("auth_admin:avatars.clear_user")}
          </Button>
        )}
      </div>

      <Surface>
        <SectionState
          resource={uploads}
          isEmpty={rows.length === 0}
          empty={
            <EmptyState
              icon={<ImageSquare size={28}/>}
              title={t("auth_admin:avatars.empty_title")}
              description={t("auth_admin:avatars.empty_body")}
            />
          }
        >
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {rows.map((upload) => (
              <li
                key={upload.id}
                className="flex flex-col gap-3 rounded-[var(--radius-md)] bg-black/20 p-4"
              >
                <div className="flex items-start gap-3">
                  {/*
                   * A pending upload has no address, so this is the `data:` URL the API inlined.
                   * `preview` is null only for a row whose image was already deleted.
                   */}
                  {upload.preview ? (
                    <img
                      src={upload.preview}
                      alt=""
                      width={72}
                      height={72}
                      className="size-[72px] shrink-0 rounded-full object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden
                      className="inline-flex size-[72px] shrink-0 items-center justify-center rounded-full bg-neutral-800 text-neutral-600"
                    >
                      <ImageSquare size={24}/>
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <Link
                      to={adminRoute.user(upload.user_id)}
                      className="block truncate text-sm text-text hover:underline"
                      data-fs-hover
                    >
                      {upload.user_name || upload.user_email || upload.user_id}
                    </Link>
                    {upload.user_name && (
                      <span className="block truncate text-[12px] text-neutral-500">{upload.user_email}</span>
                    )}
                    <span className="mt-2 flex flex-wrap items-center gap-2">
                      <StatusBadge status={upload.status}/>
                      <span className="text-[12px] text-neutral-500">
                        {upload.content_type.split("/")[1]?.toUpperCase()} · {inMegabytes(upload.size)} MB
                      </span>
                    </span>
                  </div>
                </div>

                <p className="text-[12px] text-neutral-500">
                  {t("auth_admin:avatars.uploaded_at", {
                    when: formatDateTime(upload.created_at, i18n.language) ?? "—",
                  })}
                </p>
                {upload.review_note && (
                  <p className="text-[12px] text-neutral-400">
                    {t("auth_admin:avatars.note", {note: upload.review_note})}
                  </p>
                )}

                {mayReview && (upload.status === "pending" || upload.status === "approved") && (
                  <div className="flex flex-wrap gap-2">
                    {upload.status === "pending" && (
                      <Button size="sm" disabled={approve.pending} onClick={() => onApprove(upload)} data-fs-hover>
                        {approve.pending ? <Spinner size={14}/> : <CheckCircle size={14}/>}
                        {t("auth_admin:avatars.approve")}
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setRefusing(upload);
                        setReason("");
                        reject.reset();
                      }}
                      data-fs-hover
                    >
                      <XCircle size={14}/>
                      {t(upload.status === "approved" ? "auth_admin:avatars.take_down" : "auth_admin:avatars.reject")}
                    </Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </SectionState>
      </Surface>

      <Modal
        open={refusing !== null}
        onClose={() => setRefusing(null)}
        title={t(
          refusing?.status === "approved" ? "auth_admin:avatars.take_down_title" : "auth_admin:avatars.reject_title",
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-400">{t("auth_admin:avatars.reject_body")}</p>
          <Input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={300}
            placeholder={t("auth_admin:avatars.reason_placeholder")}
            aria-label={t("auth_admin:avatars.reason_label")}
          />
          {reject.error && (
            <Alert tone="error">{t(`admin:errors.${reject.error}`, {defaultValue: reject.error})}</Alert>
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setRefusing(null)} data-fs-hover>
              {t("admin:common.cancel")}
            </Button>
            <Button onClick={onReject} disabled={reject.pending} data-fs-hover>
              {reject.pending ? <Spinner size={16}/> : <XCircle size={16}/>}
              {t("auth_admin:avatars.confirm_reject")}
            </Button>
          </div>
        </div>
      </Modal>
    </>
  );
};
