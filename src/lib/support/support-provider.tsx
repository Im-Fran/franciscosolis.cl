import {useCallback, useEffect, useMemo, useState} from "react";
import type {ReactNode} from "react";
import {describeError} from "@/lib/auth/useResource.ts";
import {supportApi} from "@/lib/support/client.ts";
import {SupportContext} from "@/lib/support/support-context.ts";
import type {Label, SupportAgent, SupportStatus} from "@/lib/support/types.ts";

/**
 * Loads the three things every console screen needs — who is signed in *here*, the service's
 * vocabularies, and the label catalogue — once, above the whole signed-in subtree.
 *
 * Doing it in one place is what lets the shell answer "is this account an agent at all" a single
 * time: `/admin/me` replies 403 for an account with no support role, and one no-access screen is
 * rendered instead of every panel failing separately.
 */
export const SupportProvider = ({children}: {children: ReactNode}) => {
  const [agent, setAgent] = useState<SupportAgent | null>(null);
  const [status, setStatus] = useState<SupportStatus | null>(null);
  const [labels, setLabels] = useState<Label[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [forbidden, setForbidden] = useState(false);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    /* The status call is public, so a 403 on `/admin/me` still leaves the shell something to show. */
    Promise.allSettled([
      supportApi.me(controller.signal),
      supportApi.status(controller.signal),
      supportApi.labels.list(controller.signal),
    ])
      .then(([me, service, catalogue]) => {
        if (controller.signal.aborted) return;

        if (me.status === "fulfilled") {
          setAgent(me.value);
          setError(null);
          setForbidden(false);
        } else {
          const described = describeError(me.reason);
          setAgent(null);
          setForbidden(described.status === 403);
          setError(described.status === 403 ? null : described.message);
        }

        if (service.status === "fulfilled") setStatus(service.value);
        /* Not fatal: without the catalogue the label picker is empty, not the whole console. */
        if (catalogue.status === "fulfilled") setLabels(catalogue.value);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [nonce]);

  const value = useMemo(
    () => ({
      agent,
      status,
      labels,
      loading,
      error,
      forbidden,
      canAdminister: agent?.can_administer ?? false,
      reload,
    }),
    [agent, status, labels, loading, error, forbidden, reload],
  );

  return <SupportContext value={value}>{children}</SupportContext>;
};
