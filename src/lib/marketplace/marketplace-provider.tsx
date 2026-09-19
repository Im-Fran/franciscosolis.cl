import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {describeError} from "@/lib/auth/useResource.ts";
import {marketplaceApi} from "@/lib/marketplace/client.ts";
import {MarketplaceContext, type MarketplaceEditor} from "@/lib/marketplace/marketplace-context.ts";

/**
 * Answers "may this account edit the marketplace" once, above the whole signed-in subtree.
 *
 * `GET /admin/me` is the probe, and its three outcomes are three different screens: an editor, a
 * `403` for a live session that lacks `marketplace:editor`, and anything else — a failure worth
 * retrying. Telling the second apart from the third is the point: "you are signed in but not on the
 * roster" is a sentence somebody can act on, and a generic error is not.
 *
 * It deliberately does **not** treat a 401 as a special case. That is a dead session, and
 * `RequireAuth` above this has already sent it to the sign-in screen.
 */
export const MarketplaceProvider = ({children}: {children: ReactNode}) => {
  const [editor, setEditor] = useState<MarketplaceEditor | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    marketplaceApi
      .me(controller.signal)
      .then((me) => {
        if (controller.signal.aborted) return;
        setEditor(me);
        setForbidden(false);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const described = describeError(cause);
        setEditor(null);
        setForbidden(described.status === 403);
        setError(described.status === 403 ? null : described.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  const value = useMemo(
    () => ({editor, loading, forbidden, error, reload}),
    [editor, loading, forbidden, error, reload],
  );

  return <MarketplaceContext value={value}>{children}</MarketplaceContext>;
};
