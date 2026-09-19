import {useEffect, useState} from "react";
import {useTranslation} from "react-i18next";
import {PencilSimple, Star, Trash} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Input, Textarea} from "@/components/ui/input.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {useMyReview, useReviewMutation} from "@/lib/marketplace/reviews.ts";
import {MIN_RATING} from "@/lib/marketplace/types.ts";
import {StarInput} from "@/pages/product/components/star-input.tsx";

/**
 * Writing, changing or withdrawing this account's review of a product.
 *
 * Who may write one is the service's decision and is obeyed rather than re-derived: only somebody
 * who actually obtained the product — bought it, or downloaded a build — may review it, and the
 * reason a caller may not is a closed set (`not_authenticated`, `not_obtained`, `no_release`) so
 * that each one can be answered with the thing that would actually help. "Sign in", "download it
 * first" and "there is nothing to review yet" are three different invitations, and only the first
 * of them is worth a button.
 *
 * One review per person per product, so there is no separate create and edit: the form opens
 * prefilled with whatever was written before and saving replaces it. The service anchors it to the
 * newest release the reviewer could have obtained, which is why this same form appears both here
 * and on a version's own page without meaning two different things.
 *
 * `onSaved` exists because the review the visitor just wrote has to appear in the list beside it.
 * The reviews read is the one public endpoint the service does not cache, precisely so it can.
 */
export const ReviewForm = ({slug, onSaved}: {slug: string; onSaved?: () => void}) => {
  const {t} = useTranslation(["product"]);
  const {client} = useAuth();
  const mine = useMyReview(slug);

  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(MIN_RATING);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const mutation = useReviewMutation(slug, () => {
    mine.reload();
    onSaved?.();
  });

  const existing = mine.data?.review ?? null;

  /* Whatever was written before is what the form opens with. A blank form would look like a new one. */
  useEffect(() => {
    if (!existing) return;
    setRating(existing.rating);
    setTitle(existing.title ?? "");
    setBody(existing.body ?? "");
  }, [existing]);

  if (mine.loading) {
    return (
      <p className="flex items-center gap-2 py-4 text-[13px] text-neutral-500">
        <Spinner size={14}/> {t("product:reviews.loading_mine")}
      </p>
    );
  }

  /*
   * A failed eligibility call takes the form away rather than showing a broken one. There is
   * nothing useful to offer somebody whose eligibility is unknown, and a form that 403s on submit
   * after they have written three paragraphs is worse than no form at all.
   */
  if (mine.error || !mine.data) return null;

  const {eligibility} = mine.data;

  /* Signed out: the one refusal with an obvious next step, so it gets a button rather than a line. */
  if (eligibility.reason === "not_authenticated") {
    return (
      <section className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
        <p className="text-sm text-neutral-400">{t("product:reviews.sign_in_prompt")}</p>
        <Button
          size="sm"
          variant="secondary"
          className="mt-3"
          onClick={() =>
            void client.flow.startAuthorization(`${window.location.pathname}${window.location.search}`)
          }
        >
          {t("product:reviews.sign_in")}
        </Button>
      </section>
    );
  }

  if (!eligibility.can_review && !existing) {
    return (
      <p className="py-4 text-[13px] text-neutral-500">
        {eligibility.reason === "no_release"
          ? t("product:reviews.no_release")
          : t("product:reviews.not_obtained")}
      </p>
    );
  }

  if (!open) {
    return (
      <section className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
        {existing ? (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-400">{t("product:reviews.yours")}</p>
            <div className="flex items-center gap-2">
              <Button size="sm" variant="secondary" onClick={() => setOpen(true)}>
                <PencilSimple size={15}/> {t("product:reviews.edit")}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setConfirmingDelete(true)}
                disabled={mutation.busy}
              >
                <Trash size={15}/> {t("product:reviews.withdraw")}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-neutral-400">
              {t("product:reviews.prompt")}
              {eligibility.anchor && (
                <span className="ml-1 text-neutral-500">
                  {t("product:reviews.anchored_to", {version: eligibility.anchor.version})}
                </span>
              )}
            </p>
            <Button size="sm" onClick={() => setOpen(true)}>
              <Star size={15}/> {t("product:reviews.write")}
            </Button>
          </div>
        )}

        {confirmingDelete && (
          <div className="mt-4 border-t border-neutral-800/60 pt-4">
            <p className="text-[13px] text-neutral-400">{t("product:reviews.withdraw_confirm")}</p>
            <div className="mt-3 flex items-center gap-2">
              <Button
                size="sm"
                variant="secondary"
                disabled={mutation.busy}
                onClick={() => {
                  void mutation.remove().then((ok) => {
                    if (!ok) return;
                    setConfirmingDelete(false);
                    setTitle("");
                    setBody("");
                    setRating(MIN_RATING);
                  });
                }}
              >
                {mutation.busy ? <Spinner size={15}/> : <Trash size={15}/>} {t("product:reviews.withdraw")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setConfirmingDelete(false)}>
                {t("product:reviews.cancel")}
              </Button>
            </div>
          </div>
        )}

        {mutation.error && <FormError error={mutation.error}/>}
      </section>
    );
  }

  return (
    <section className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void mutation
            .save({
              rating,
              /* Empty is null rather than "": a blank title is the absence of one, not a title. */
              title: title.trim() || null,
              body: body.trim() || null,
            })
            .then((ok) => ok && setOpen(false));
        }}
      >
        <StarInput value={rating} onChange={setRating} disabled={mutation.busy}/>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-neutral-400">{t("product:reviews.title_label")}</span>
          <Input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={120}
            disabled={mutation.busy}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] text-neutral-400">{t("product:reviews.body_label")}</span>
          <Textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={5}
            maxLength={4000}
            disabled={mutation.busy}
          />
        </label>

        {mutation.error && <FormError error={mutation.error}/>}

        <div className="flex items-center gap-2">
          <Button type="submit" size="sm" disabled={mutation.busy}>
            {mutation.busy ? <Spinner size={15}/> : <Star size={15}/>} {t("product:reviews.save")}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => {
              mutation.clearError();
              setOpen(false);
            }}
          >
            {t("product:reviews.cancel")}
          </Button>
        </div>
      </form>
    </section>
  );
};

/**
 * The two sentinels `useResource` produces get the site's own wording; anything else is a sentence
 * the service wrote for a person — "You have to obtain this product before reviewing it" — and is
 * worth more than a generic line would be.
 */
const FormError = ({error}: {error: string}) => {
  const {t} = useTranslation(["common"]);
  return (
    <Alert tone="error">
      {error === "network"
        ? t("common:content_unreachable")
        : error === "unexpected"
          ? t("common:content_failed")
          : error}
    </Alert>
  );
};
