import {createContext, useContext} from "react";
import type {AdminMe} from "@/lib/auth/types.ts";

export type AdminContextValue = {
  /** The caller as the administration API sees them, or null while the answer is a refusal. */
  me: AdminMe | null;
  loading: boolean;
  error: string | null;
  /** Signed in, but holding no administration permission: the API answered 403 to `/admin/me`. */
  forbidden: boolean;
  reload: () => void;
  /**
   * Whether the caller holds a permission slug.
   *
   * This only decides what is *offered*. Every endpoint re-checks the caller, and because
   * permissions are re-read from the database on each request rather than taken from the token,
   * the API can refuse something this said yes to moments ago. A screen that can be reached anyway
   * still renders its own no-access state.
   */
  can: (permission: string) => boolean;
};

export const AdminContext = createContext<AdminContextValue | null>(null);

export const useAdmin = () => {
  const value = useContext(AdminContext);
  if (!value) throw new Error("useAdmin must be used inside <AdminProvider>");
  return value;
};
