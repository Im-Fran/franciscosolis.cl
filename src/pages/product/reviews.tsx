import {useCallback, useState} from "react";
import {useTranslation} from "react-i18next";
import {ChatCircle} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {REVIEWS_PAGE_SIZE, useReviews} from "@/lib/marketplace/reviews.ts";
import {MAX_RATING, MIN_RATING} from "@/lib/marketplace/types.ts";
import {SectionError, SectionSkeleton} from "@/pages/home/components/section-state.tsx";
import {useProductPage} from "@/pages/product/product-context.ts";
import {RatingStars} from "@/pages/product/components/rating-stars.tsx";
import {ReviewCard} from "@/pages/product/components/review-card.tsx";
import {ReviewForm} from "@/pages/product/components/review-form.tsx";

/**
 * The Reviews tab: what the people who obtained this product thought.
 *
 * The summary is two numbers that are easy to conflate and are both shown: `count` is what the
 * average is computed over, `total` is every visible review including the ones written before a
 * reset. Quoting the second as the first would put a four-year-old average on a product that
 * restarted its rating last week; quoting the first as the second would make a page of visible
 * reviews look like it had lost some.
 *
 * A reset is stated rather than implied, for the same reason: nothing was deleted, and a reader who
 * remembers the old score deserves to know why this one is different.
 *
 * The list is paged rather than infinite. A review is something people link to and come back to,
 * and an infinite list has no second page to link to.
 */
export const ProductReviews = () => {
  const {t, i18n} = useTranslation(["product"]);
  const {slug} = useProductPage();
  const {status} = useAuth();

  const [offset, setOffset] = useState(0);
  /** Filtering by star count, which is what the histogram rows are for. */
  const [rating, setRating] = useState<number | undefined>(undefined);

  const reviews = useReviews(slug, offset, rating);
  const reload = reviews.reload;

  /*
   * A review the visitor just wrote has to appear in the list beside the form that wrote it.
   *
   * Depending on `reviews.reload` rather than on the resource object: the object is new on every
   * render, which would make this callback new on every render too, and it is handed down to the
   * form as a prop.
   */
  const refresh = useCallback(() => {
    setOffset(0);
    reload();
  }, [reload]);

  const selectRating = useCallback((value: number | undefined) => {
    setRating(value);
    setOffset(0);
  }, []);

  if (reviews.loading && !reviews.data) {
    return <SectionSkeleton count={3} className="mx-auto max-w-3xl flex-col"/>;
  }

  if (reviews.error || !reviews.data) {
    return (
      <div className="mx-auto max-w-3xl">
        <SectionError error={reviews.error ?? "unexpected"} onRetry={reviews.reload}/>
      </div>
    );
  }

  const {summary, reviews: rows, pagination} = reviews.data;
  const number = (value: number) => new Intl.NumberFormat(i18n.resolvedLanguage ?? "en").format(value);
  const hasMore = pagination.offset + rows.length < pagination.total;

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <section className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
        {summary.average === null ? (
          <p className="text-sm text-neutral-500">{t("product:reviews.none_yet")}</p>
        ) : (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-8">
            <div className="shrink-0">
              <p className="font-display text-4xl text-text">{summary.average.toFixed(1)}</p>
              <RatingStars value={summary.average} className="mt-1"/>
              <p className="mt-1 text-[13px] text-neutral-500">
                {t("product:reviews.count", {count: summary.count})}
              </p>
              {/* `total` differs from `count` only after a reset, and then it needs saying. */}
              {summary.total > summary.count && (
                <p className="text-[12px] text-neutral-500">
                  {t("product:reviews.total", {count: summary.total})}
                </p>
              )}
            </div>

            <div className="min-w-0 flex-1">
              {Array.from({length: MAX_RATING}, (_, index) => MAX_RATING - index).map((star) => {
                const value = summary.distribution[String(star)] ?? 0;
                const share = summary.count > 0 ? (value / summary.count) * 100 : 0;
                const active = rating === star;

                return (
                  <button
                    key={star}
                    type="button"
                    onClick={() => selectRating(active ? undefined : star)}
                    aria-pressed={active}
                    className="flex w-full items-center gap-2 py-0.5 text-left"
                  >
                    <span className="w-8 shrink-0 text-[12px] text-neutral-500">
                      {t("product:reviews.star_row", {count: star})}
                    </span>
                    <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-bg/60">
                      <span
                        className={active ? "block h-full bg-amber-400" : "block h-full bg-neutral-600"}
                        style={{width: `${share}%`}}
                      />
                    </span>
                    <span className="w-10 shrink-0 text-right text-[12px] text-neutral-500">
                      {number(value)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {summary.reset_at && (
          <p className="mt-4 border-t border-neutral-800/60 pt-4 text-[13px] text-neutral-500">
            {t("product:reviews.reset_notice", {
              date: formatDate(summary.reset_at, i18n.language),
            })}
          </p>
        )}
      </section>

      <ReviewForm slug={slug} onSaved={refresh}/>

      {rating !== undefined && (
        <div className="flex items-center gap-2 text-[13px] text-neutral-400">
          <span>{t("product:reviews.filtered", {count: rating})}</span>
          <Button size="sm" variant="ghost" onClick={() => selectRating(undefined)}>
            {t("product:reviews.clear_filter")}
          </Button>
        </div>
      )}

      {rows.length === 0 ? (
        <p className="flex items-center justify-center gap-2 py-12 text-sm text-neutral-500">
          <ChatCircle size={18}/>
          {rating === undefined ? t("product:reviews.none_yet") : t("product:reviews.none_for_rating")}
        </p>
      ) : (
        <ol className="flex flex-col gap-4">
          {rows.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              slug={slug}
              /* Flagging needs an account: offering it signed out is a button that 401s. */
              reportable={status === "authenticated"}
            />
          ))}
        </ol>
      )}

      {hasMore && (
        <Button
          variant="secondary"
          className="self-center"
          onClick={() => setOffset(offset + REVIEWS_PAGE_SIZE)}
          disabled={reviews.loading}
        >
          {t("product:reviews.more")}
        </Button>
      )}

      {/* Referenced so the bounds live in one place even where only the maximum is drawn. */}
      <span className="sr-only">{t("product:reviews.scale", {min: MIN_RATING, max: MAX_RATING})}</span>
    </div>
  );
};
