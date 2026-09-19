import {useCallback, useState} from "react";
import {useAuth} from "@/lib/auth/auth-context.ts";
import {describeError, useResource, type Resource} from "@/lib/auth/useResource.ts";
import {marketplaceContent} from "@/lib/marketplace/content.ts";
import type {MyReview, ReviewPayload, ReviewReportReason, ReviewsPage} from "@/lib/marketplace/types.ts";

/**
 * The reviews of one product: the public list, and the caller's own.
 *
 * Kept out of `content.ts` for the same reason `store.ts` is: the list is public and the same for
 * everybody, while "may *I* review this, and what did I say" is per person and changes the moment
 * somebody signs in or buys. Mixing them would mean a cacheable read sharing a module with one that
 * must never be cached.
 */

/** How many reviews a page holds. The service caps it; this is what the tab asks for. */
export const REVIEWS_PAGE_SIZE = 20;

export const useReviews = (slug: string, offset: number, rating?: number): Resource<ReviewsPage> =>
  useResource(
    useCallback(
      (signal: AbortSignal) =>
        marketplaceContent.reviews(slug, {limit: REVIEWS_PAGE_SIZE, offset, rating}, signal),
      [slug, offset, rating],
    ),
  );

/**
 * The caller's own review, and whether they may write one.
 *
 * Re-read whenever the session changes, exactly like `access`: signing in is the moment an
 * anonymous visitor turns into somebody who may already have bought this and may therefore review
 * it. A signed-out caller is not a 401 here — the service answers `can_review: false` with
 * `not_authenticated`, which is what lets the form offer a sign-in instead of an error.
 */
export const useMyReview = (slug: string): Resource<MyReview> => {
  const {status} = useAuth();
  return useResource(
    useCallback(
      (signal: AbortSignal) => {
        void status;
        return marketplaceContent.myReview(slug, signal);
      },
      [slug, status],
    ),
  );
};

export type ReviewMutation = {
  busy: boolean;
  error: string | null;
  save: (body: ReviewPayload) => Promise<boolean>;
  remove: () => Promise<boolean>;
  report: (id: string, reason: ReviewReportReason | string, note?: string) => Promise<boolean>;
  clearError: () => void;
};

/**
 * Writing a review, withdrawing it, and flagging somebody else's.
 *
 * `save` is a `PUT`: it creates or replaces, and there is no separate edit path, because "I already
 * reviewed this and want to change my mind" and "I am reviewing this" are the same request as far
 * as the service is concerned — one person holds at most one review per product.
 *
 * Each call answers whether it landed rather than throwing, so the form can close on success and
 * stay open with its text intact on failure. A failed save that cleared the textarea would be the
 * worst possible outcome for somebody who just wrote three paragraphs.
 */
export const useReviewMutation = (slug: string, onDone?: () => void): ReviewMutation => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (action: () => Promise<unknown>) => {
      setBusy(true);
      setError(null);
      try {
        await action();
        onDone?.();
        return true;
      } catch (cause) {
        setError(describeError(cause).message);
        return false;
      } finally {
        setBusy(false);
      }
    },
    [onDone],
  );

  const save = useCallback(
    (body: ReviewPayload) => run(() => marketplaceContent.saveReview(slug, body)),
    [run, slug],
  );

  const remove = useCallback(() => run(() => marketplaceContent.deleteReview(slug)), [run, slug]);

  const report = useCallback(
    (id: string, reason: ReviewReportReason | string, note?: string) =>
      run(() => marketplaceContent.reportReview(slug, id, {reason, ...(note ? {note} : {})})),
    [run, slug],
  );

  return {busy, error, save, remove, report, clearError: useCallback(() => setError(null), [])};
};
