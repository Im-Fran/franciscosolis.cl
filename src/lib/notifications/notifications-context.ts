import {createContext, useContext} from "react";

export type NotificationsContextValue = {
  /** Whether there is a session to ask for — false while anonymous or while it is being restored. */
  enabled: boolean;
  /** Unread notifications, or null until the service has answered once. */
  unread: number | null;
  /**
   * Bumped when a push arrives, so an open list — the bell's panel, the account tab — knows there
   * is something new to read and asks again.
   */
  revision: number;
  /** Asks the service for the unread count again. */
  refresh: () => Promise<void>;
  /**
   * Records a count the service already answered some other way — the list carries it beside its
   * page, and a read-all implies zero — so the badge moves without a second round trip.
   */
  setUnread: (unread: number) => void;
};

export const NotificationsContext = createContext<NotificationsContextValue | null>(null);

export const useNotifications = () => {
  const value = useContext(NotificationsContext);
  if (!value) throw new Error("useNotifications must be used inside <NotificationsProvider>");
  return value;
};
