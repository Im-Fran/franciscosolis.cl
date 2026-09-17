import {useCallback, useRef, useState} from "react";
import type {ChangeEvent} from "react";
import {useTranslation} from "react-i18next";
import {HourglassMedium, Trash, UploadSimple} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Avatar} from "@/components/ui/avatar.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";
import {useMutation} from "@/lib/admin/useMutation.ts";
import {authApi} from "@/lib/auth/api.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useResource} from "@/lib/auth/useResource.ts";
import type {User} from "@/lib/auth/types.ts";

/** Megabytes, rounded the way a person reads a file size rather than the way a disk reports it. */
const inMegabytes = (bytes: number) => Math.round((bytes / (1024 * 1024)) * 10) / 10;

/** `image/png` → `PNG`, so the hint reads as a list of formats rather than of media types. */
const formatNames = (contentTypes: string[]) =>
  contentTypes.map((type) => type.split("/")[1]?.toUpperCase() ?? type).join(", ");

/**
 * The account's profile picture: upload one, see where it stands, take it back.
 *
 * Uploading does not change anything visible. The service parks the file out of reach and an
 * administrator decides; until then the account keeps whatever picture it had, and this panel says
 * so rather than showing the new one as if it were live. That is the whole reason the picture is no
 * longer a URL field on the profile form — a link anybody could point anywhere made the review a
 * formality.
 */
export const AvatarPanel = ({user}: {user: User}) => {
  const {t} = useTranslation();
  const {reload: reloadAccount} = useAuth();
  const {notify} = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [choice, setChoice] = useState<{file: File; preview: string} | null>(null);

  const avatar = useResource(useCallback((signal: AbortSignal) => authApi.avatar(signal), []));
  const upload = useMutation(useCallback((file: File) => authApi.uploadAvatar(file), []));
  const withdraw = useMutation(useCallback(() => authApi.deleteAvatar(), []));

  const limits = avatar.data?.limits ?? {max_bytes: 2 * 1024 * 1024, content_types: ["image/png", "image/jpeg", "image/webp"]};
  const pending = avatar.data?.pending ?? null;
  const rejected = avatar.data?.rejected ?? null;
  const published = avatar.data?.current ?? null;

  /* Revoked as soon as it is replaced or sent: an object URL that is never released leaks the file. */
  const chooseFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    upload.reset();
    setChoice((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return file ? {file, preview: URL.createObjectURL(file)} : null;
    });
  };

  const clearChoice = () => {
    setChoice((current) => {
      if (current) URL.revokeObjectURL(current.preview);
      return null;
    });
    if (input.current) input.current.value = "";
  };

  const send = async () => {
    if (!choice) return;
    const result = await upload.run(choice.file);
    if (!result.ok) return;

    clearChoice();
    avatar.reload();
    notify(t("auth:account.avatar.sent"));
  };

  const remove = async () => {
    const result = await withdraw.run();
    if (!result.ok) {
      notify(t(`auth:errors.${result.error}`, {defaultValue: result.error}), "error");
      return;
    }

    clearChoice();
    avatar.reload();
    /* The published picture lives on the profile, so the account has to be re-read for it to go. */
    await reloadAccount();
    notify(t("auth:account.avatar.removed"));
  };

  const failure = upload.error ?? avatar.error;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          name={user.name}
          email={user.email}
          picture={choice?.preview ?? user.picture}
          size={72}
          className={choice ? "ring-2 ring-accent-500/60" : undefined}
        />
        <div className="min-w-0 flex-1">
          <p className="text-sm text-text">{t("auth:account.avatar.title")}</p>
          <p className="mt-1 text-[13px] leading-relaxed text-neutral-500">
            {t("auth:account.avatar.hint", {
              size: inMegabytes(limits.max_bytes),
              formats: formatNames(limits.content_types),
            })}
          </p>
        </div>
      </div>

      {pending && !choice && (
        <Alert tone="info" title={t("auth:account.avatar.pending_title")}>
          <span className="inline-flex items-center gap-2">
            <HourglassMedium size={16}/> {t("auth:account.avatar.pending_body")}
          </span>
        </Alert>
      )}

      {rejected && !pending && !choice && (
        <Alert tone="error" title={t("auth:account.avatar.rejected_title")}>
          {rejected.review_note || t("auth:account.avatar.rejected_body")}
        </Alert>
      )}

      {failure && <Alert tone="error">{t(`auth:errors.${failure}`, {defaultValue: failure})}</Alert>}

      <div className="flex flex-wrap items-center gap-3">
        {/* The real control is the button beside it; the input itself is never a nice thing to style. */}
        <input
          ref={input}
          id="avatar-file"
          type="file"
          className="sr-only"
          accept={limits.content_types.join(",")}
          onChange={chooseFile}
        />
        <Button type="button" variant="ghost" onClick={() => input.current?.click()} data-fs-hover>
          <UploadSimple size={16}/> {t("auth:account.avatar.choose")}
        </Button>

        {choice && (
          <>
            <Button type="button" onClick={send} disabled={upload.pending} data-fs-hover>
              {upload.pending ? <Spinner size={16}/> : <UploadSimple size={16}/>}
              {t("auth:account.avatar.send")}
            </Button>
            <Button type="button" variant="ghost" onClick={clearChoice} data-fs-hover>
              {t("auth:common.cancel")}
            </Button>
            <span className="text-[13px] text-neutral-500">
              {choice.file.name} · {inMegabytes(choice.file.size)} MB
            </span>
          </>
        )}

        {!choice && (published || pending) && (
          <Button type="button" variant="ghost" onClick={remove} disabled={withdraw.pending} data-fs-hover>
            {withdraw.pending ? <Spinner size={16}/> : <Trash size={16}/>}
            {t(pending && !published ? "auth:account.avatar.withdraw" : "auth:account.avatar.remove")}
          </Button>
        )}
      </div>
    </div>
  );
};
