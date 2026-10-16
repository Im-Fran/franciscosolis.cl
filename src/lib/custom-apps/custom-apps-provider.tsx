import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {describeError} from "@/lib/auth/useResource.ts";
import {customAppsApi} from "@/lib/custom-apps/client.ts";
import {CustomAppsContext} from "@/lib/custom-apps/custom-apps-context.ts";
import type {Account, ServiceStatus} from "@/lib/custom-apps/types.ts";

/**
 * Answers "may this account use the panel" once, above the whole signed-in subtree.
 *
 * `GET /v1/me` is the probe, with the same three outcomes as the marketplace console's: an account
 * the service lets in, a `403` for a live session it does not (wrong domain, unverified address, or
 * no `custom-apps:admin`), and anything else — a failure worth retrying. A 401 is not special-cased:
 * that is a dead session, and `RequireAuth` above has already sent it to the sign-in screen.
 *
 * `GET /` rides along because every form in here wants its vocabularies, and asking once is cheaper
 * than each screen asking. Its failure is deliberately not an error: the bundle carries a copy of
 * the lists, and a panel that refuses to open because a public status probe hiccupped would be a
 * worse panel than one offering last release's list of app kinds.
 */
export const CustomAppsProvider = ({children}: {children: ReactNode}) => {
  const [account, setAccount] = useState<Account | null>(null);
  const [service, setService] = useState<ServiceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    customAppsApi
      .status(controller.signal)
      .then((status) => {
        if (!controller.signal.aborted) setService(status);
      })
      .catch(() => {
        /* See above: the bundle's own vocabulary stands in. */
      });

    customAppsApi
      .me(controller.signal)
      .then((me) => {
        if (controller.signal.aborted) return;
        setAccount(me);
        setForbidden(false);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const described = describeError(cause);
        setAccount(null);
        setForbidden(described.status === 403);
        setError(described.status === 403 ? null : described.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  const value = useMemo(
    () => ({account, service, loading, forbidden, error, reload}),
    [account, service, loading, forbidden, error, reload],
  );

  return <CustomAppsContext value={value}>{children}</CustomAppsContext>;
};
