import {useCallback, useEffect, useState} from "react";
import {AuthApiError, AuthNetworkError} from "@/lib/auth/client.ts";

export type Resource<T> = {
  data: T | null;
  loading: boolean;
  /** Human-readable failure from the API, or `network` when the service was unreachable. */
  error: string | null;
  /** HTTP status of the failure, so views can tell 403 apart from a genuine error. */
  status: number | null;
  reload: () => void;
};

/**
 * Turns a thrown cause into something a view can show.
 *
 * The two auth errors carry text written for a person. Anything else reaching here is a programming
 * fault, and its `message` is written for whoever is reading a stack trace — a truncated response
 * once put "Expected ',' or '}' after property value in JSON at position 29" in front of a user.
 * Those collapse to one translated line, and the detail goes where it is useful instead.
 */
export const describeError = (cause: unknown) => {
  if (cause instanceof AuthNetworkError) return {message: "network", status: null, issues: [] as string[]};
  if (cause instanceof AuthApiError) return {message: cause.message, status: cause.status, issues: cause.issues};
  console.error("Unexpected failure while talking to the auth service:", cause);
  return {message: "unexpected", status: null, issues: [] as string[]};
};

/**
 * Loads one API resource, cancelling the in-flight request when the inputs change or the view
 * unmounts. `fetcher` must be stable — wrap it in `useCallback` at the call site.
 */
export const useResource = <T>(fetcher: (signal: AbortSignal) => Promise<T>): Resource<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [nonce, setNonce] = useState(0);

  const reload = useCallback(() => setNonce((value) => value + 1), []);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    fetcher(controller.signal)
      .then((result) => {
        if (controller.signal.aborted) return;
        setData(result);
        setError(null);
        setStatus(null);
      })
      .catch((cause: unknown) => {
        if (controller.signal.aborted) return;
        const described = describeError(cause);
        setError(described.message);
        setStatus(described.status);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [fetcher, nonce]);

  return {data, loading, error, status, reload};
};
