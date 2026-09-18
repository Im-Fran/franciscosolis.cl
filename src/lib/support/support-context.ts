import {createContext, useContext} from "react";
import type {Label, SupportAgent, SupportStatus} from "@/lib/support/types.ts";

export type SupportContextValue = {
  /** The account behind the current token, as the support service itself sees it. */
  agent: SupportAgent | null;
  /** The vocabularies the console builds its filters and its timeline renderer from. */
  status: SupportStatus | null;
  labels: Label[];
  loading: boolean;
  error: string | null;
  /** Signed in, but not an agent: the API answered 403 to `/admin/me`. */
  forbidden: boolean;
  /**
   * Whether this account may reshape the service — the label catalogue, the help centre, the
   * assistant — as opposed to answering tickets.
   *
   * Used to decide what the navigation draws, not what is allowed: every one of those routes checks
   * for itself. A menu of entries that all answer 403 is worse than a shorter menu.
   */
  canAdminister: boolean;
  reload: () => void;
};

export const SupportContext = createContext<SupportContextValue | null>(null);

export const useSupport = () => {
  const value = useContext(SupportContext);
  if (!value) throw new Error("useSupport must be used inside <SupportProvider>");
  return value;
};
