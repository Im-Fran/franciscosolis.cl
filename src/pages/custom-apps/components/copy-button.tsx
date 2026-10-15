import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Check, Copy} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";
import {useToast} from "@/lib/admin/toast-context.ts";

export type CopyButtonProps = {
  value: string;
  /** What is being copied, for the button's accessible name. */
  label: string;
  /** Shows the word beside the icon rather than the icon alone. */
  withText?: boolean;
};

/**
 * Copies one value. A denied clipboard is not a failure worth a dialog — the value is on screen and
 * can be selected — so it is a quiet toast instead.
 */
export const CopyButton = ({value, label, withText}: CopyButtonProps) => {
  const {t} = useTranslation("custom_apps");
  const {notify} = useToast();
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      notify(t("admin:common.copied"));
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      notify(t("copy_failed"), "info");
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={withText ? "sm" : "icon"}
      className={withText ? undefined : "size-9 shrink-0"}
      aria-label={t("copy_aria", {label})}
      onClick={() => void copy()}
    >
      {copied ? <Check size={15} /> : <Copy size={15} />}
      {withText && (copied ? t("admin:common.copied") : t("admin:common.copy"))}
    </Button>
  );
};

/** A value worth copying, shown whole in a mono box with the button beside it. */
export const CopyField = ({value, label}: {value: string; label: string}) => (
  <div className="flex min-w-0 items-center gap-1 rounded-[var(--radius-md)] border border-neutral-800 bg-bg pl-3">
    <code className="min-w-0 flex-1 truncate py-2 font-mono text-[12.5px] text-neutral-300" title={value}>
      {value}
    </code>
    <CopyButton value={value} label={label} />
  </div>
);
