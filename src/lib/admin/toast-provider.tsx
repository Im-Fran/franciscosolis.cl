import {useCallback, useEffect, useMemo, useRef, useState} from "react";
import type {ReactNode} from "react";
import type {AlertTone} from "@/components/ui/alert.tsx";
import {ToastContext} from "@/lib/admin/toast-context.ts";
import type {Toast} from "@/lib/admin/toast-context.ts";

/** How long a toast stays up. Errors linger, since they usually carry something worth reading. */
const LIFETIME: Record<AlertTone, number> = {success: 4000, info: 5000, error: 9000};

/**
 * Transient confirmations for an administration panel's writes. A saved record already shows its new
 * state in the screen behind it, so the toast only has to say the write landed, never the result.
 */
export const ToastProvider = ({children}: {children: ReactNode}) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const notify = useCallback(
    (message: string, tone: AlertTone = "success") => {
      const id = next.current++;
      setToasts((current) => [...current, {id, tone, message}]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), LIFETIME[tone]),
      );
      return id;
    },
    [dismiss],
  );

  /* Timers outlive a route change, so they have to be cleared when the subtree goes away. */
  const pending = timers.current;
  useEffect(() => () => pending.forEach(clearTimeout), [pending]);

  const value = useMemo(() => ({toasts, notify, dismiss}), [toasts, notify, dismiss]);

  return <ToastContext value={value}>{children}</ToastContext>;
};
