import {createContext, useContext} from "react";
import type {AlertTone} from "@/components/ui/alert.tsx";

export type Toast = {id: number; tone: AlertTone; message: string};

export type ToastContextValue = {
  toasts: Toast[];
  /** Announces the outcome of a write. Returns the toast's id, so a caller can dismiss it early. */
  notify: (message: string, tone?: AlertTone) => number;
  dismiss: (id: number) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export const useToast = () => {
  const value = useContext(ToastContext);
  if (!value) throw new Error("useToast must be used inside <ToastProvider>");
  return value;
};
