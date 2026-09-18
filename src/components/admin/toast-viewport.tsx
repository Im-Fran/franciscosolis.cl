import {useTranslation} from "react-i18next";
import {X} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";

/**
 * Where an administration panel's write confirmations land. One live region per panel, so a save
 * that happens while the screen is scrolled elsewhere is still announced exactly once.
 */
export const ToastViewport = () => {
  const {t} = useTranslation();
  const {toasts, dismiss} = useToast();

  if (toasts.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-4 bottom-4 z-50 flex flex-col items-end gap-2 sm:inset-x-auto sm:right-6 sm:bottom-6"
      role="region"
      aria-label={t("admin:common.notifications")}
    >
      {toasts.map((toast) => (
        <Alert
          key={toast.id}
          tone={toast.tone}
          className="pointer-events-auto w-full max-w-sm shadow-[var(--shadow-sm)] backdrop-blur-sm"
        >
          <div className="flex items-start gap-3">
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label={t("a11y:close")}
              className="shrink-0 cursor-pointer opacity-70 transition-opacity hover:opacity-100"
            >
              <X size={14}/>
            </button>
          </div>
        </Alert>
      ))}
    </div>
  );
};
