import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Flag} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {formatDate} from "@/lib/auth/format.ts";
import type {Review} from "@/lib/marketplace/types.ts";
import {ChannelBadge} from "@/pages/product/components/channel-badge.tsx";
import {RatingStars} from "@/pages/product/components/rating-stars.tsx";
import {ReportReviewDialog} from "@/pages/product/components/report-review-dialog.tsx";

/**
 * One review, with the owner's answer under it when there is one.
 *
 * Two things this has to say out loud:
 *
 * - **Which version it was written against.** A one-star review of a build from two years ago is a
 *   different fact from a one-star review of yesterday's, and a list that hides the version makes
 *   the reader assume the worst case.
 * - **Whether it counts toward the current rating.** A reset does not delete anything — the review
 *   stays here and stays readable — so a review from before the line has to say so, or the numbers
 *   at the top of the tab will not add up and it will look like the average is wrong.
 *
 * The author is a name, never an address: the service does not serialize one, and this renders what
 * it is given.
 */
export const ReviewCard = ({
  review,
  slug,
  reportable,
}: {
  review: Review;
  slug: string;
  /** Flagging needs a session and is somebody *else's* review; the tab decides which. */
  reportable: boolean;
}) => {
  const {t, i18n} = useTranslation(["product"]);
  const [reporting, setReporting] = useState(false);

  return (
    <li className="rounded-[var(--radius-lg)] bg-surface px-6 py-5 shadow-[var(--shadow-sm)]">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <RatingStars value={review.rating} size={15}/>
        <span className="text-sm text-text">{review.author.name}</span>
        <time dateTime={review.created_at} className="text-[13px] text-neutral-500">
          {formatDate(review.created_at, i18n.language)}
        </time>
        {review.edited && <span className="text-[12px] text-neutral-500">{t("product:reviews.edited")}</span>}

        {review.release && (
          <span className="inline-flex items-center gap-1.5 text-[12px] text-neutral-500">
            <span className="font-mono">{review.release.version}</span>
            <ChannelBadge channel={review.release.channel}/>
          </span>
        )}
      </div>

      {!review.counts_toward_rating && (
        <p className="mt-2 text-[12px] text-neutral-500">{t("product:reviews.before_reset")}</p>
      )}

      {review.title?.trim() && <h3 className="mt-3 text-[15px] text-text">{review.title}</h3>}

      {/*
        * Plain text, rendered as plain text. Review bodies are the one piece of unauthenticated
        * free text this site shows, and they are deliberately not Markdown anywhere in the stack —
        * `whitespace-pre-line` keeps the paragraphs somebody typed without giving them a renderer.
        */}
      {review.body?.trim() && (
        <p className="mt-2 text-sm leading-relaxed whitespace-pre-line text-neutral-300">{review.body}</p>
      )}

      {review.reply && (
        <div className="mt-4 border-l-2 border-[var(--page-accent,var(--color-accent))] pl-4">
          <p className="text-[13px] text-neutral-400">
            {t("product:reviews.reply_by", {name: review.reply.author_name})}
            <time dateTime={review.reply.created_at} className="ml-2 text-neutral-500">
              {formatDate(review.reply.created_at, i18n.language)}
            </time>
          </p>
          <p className="mt-1 text-sm leading-relaxed whitespace-pre-line text-neutral-300">
            {review.reply.body}
          </p>
        </div>
      )}

      {reportable && (
        <div className="mt-4">
          <Button size="sm" variant="ghost" onClick={() => setReporting(true)}>
            <Flag size={14}/> {t("product:reviews.report")}
          </Button>
        </div>
      )}

      <ReportReviewDialog
        open={reporting}
        onClose={() => setReporting(false)}
        slug={slug}
        reviewId={review.id}
      />
    </li>
  );
};
