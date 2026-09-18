import {useTranslation} from "react-i18next";
import {Warning} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";

export type ConfirmDialogProps = {
  open: boolean;
  title: string;
  /** What is about to happen, in the user's own terms — name the record, not the endpoint. */
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  pending?: boolean;
  /** A failed attempt keeps the dialog open and shows why, so the action can be retried in place. */
  error?: string | null;
};

/** The one gate in front of every destructive write: nothing on these APIs is undoable. */
export const ConfirmDialog = ({
  open,
  title,
  body,
  confirmLabel,
  onConfirm,
  onClose,
  pending,
  error,
}: ConfirmDialogProps) => {
  const {t} = useTranslation();

  return (
    <Modal open={open} onClose={pending ? () => undefined : onClose} title={title} className="max-w-md">
      <div className="flex flex-col gap-5">
        <p className="text-sm leading-relaxed text-neutral-300">{body}</p>

        {error && (
          <Alert tone="error" title={t("admin:common.failed")}>
            {t(`admin:errors.${error}`, {defaultValue: error})}
          </Alert>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={pending}>
            {t("admin:common.cancel")}
          </Button>
          <Button
            variant="secondary"
            onClick={onConfirm}
            disabled={pending}
            className="border-red-500/50 text-red-300 fs-ripple-danger"
          >
            {pending ? <Spinner size={16}/> : <Warning size={16}/>}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
