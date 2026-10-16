import {useCallback, useState} from "react";
import {describeError} from "@/lib/auth/useResource.ts";

/** What a write reports back, so a caller can branch without a `try`/`catch` at every call site. */
export type MutationOutcome<R> =
  | {ok: true; data: R}
  | {ok: false; error: string; status: number | null; issues: string[]};

export type Mutation<A extends unknown[], R> = {
  run: (...args: A) => Promise<MutationOutcome<R>>;
  pending: boolean;
  /** Human-readable failure from the API, or `network` when the service was unreachable. */
  error: string | null;
  /** HTTP status of the failure, so a form can tell a 403 or a 409 apart from a generic error. */
  status: number | null;
  /** The itemised reasons a service listed beside the error, when it listed any. */
  issues: string[];
  reset: () => void;
};

/**
 * The write-side counterpart of `useResource`: runs one API call, tracking whether it is in flight
 * and how it failed. `fn` must be stable — wrap it in `useCallback` at the call site.
 */
export const useMutation = <A extends unknown[], R>(fn: (...args: A) => Promise<R>): Mutation<A, R> => {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<number | null>(null);
  const [issues, setIssues] = useState<string[]>([]);

  const reset = useCallback(() => {
    setError(null);
    setStatus(null);
    setIssues([]);
  }, []);

  const run = useCallback(
    async (...args: A): Promise<MutationOutcome<R>> => {
      setPending(true);
      setError(null);
      setStatus(null);
      setIssues([]);
      try {
        return {ok: true, data: await fn(...args)};
      } catch (cause) {
        const described = describeError(cause);
        setError(described.message);
        setStatus(described.status);
        setIssues(described.issues);
        return {ok: false, error: described.message, status: described.status, issues: described.issues};
      } finally {
        setPending(false);
      }
    },
    [fn],
  );

  return {run, pending, error, status, issues, reset};
};
