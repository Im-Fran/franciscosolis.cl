import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {authApi} from "@/lib/auth/api.ts";
import {AdminContext} from "@/lib/auth/admin-context.ts";
import {describeError} from "@/lib/auth/useResource.ts";
import type {AdminMe} from "@/lib/auth/types.ts";

/**
 * Asks `GET /admin/me` once, above the whole console.
 *
 * A live session and a seat in the console are two different questions. `RequireAuth` settles the
 * first; this settles the second, and asking it in one place is what keeps an account with no
 * administration permission from meeting eight screens that each fail with their own 403.
 *
 * The answer also drives the navigation: the sections are filtered by the permissions it reports,
 * so the console shows what this account can actually do rather than a menu of dead ends.
 */
export const AdminProvider = ({children}: {children: ReactNode}) => {
  const [me, setMe] = useState<AdminMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    authApi.admin
      .me(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setMe(result);
        setError(null);
        setForbidden(false);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const described = describeError(cause);
        setMe(null);
        setForbidden(described.status === 403);
        /* A refusal is a state the console renders, not a failure it reports. */
        setError(described.status === 403 ? null : described.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  const value = useMemo(
    () => ({
      me,
      loading,
      error,
      forbidden,
      reload,
      can: (permission: string) => me?.permissions.includes(permission) ?? false,
    }),
    [me, loading, error, forbidden, reload],
  );

  return <AdminContext value={value}>{children}</AdminContext>;
};
