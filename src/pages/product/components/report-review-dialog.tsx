import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Flag} from "@phosphor-icons/react";
import {Alert} from "@/components/ui/alert.tsx";
import {Button} from "@/components/ui/button/button.tsx";
import {Textarea} from "@/components/ui/input.tsx";
import {Modal} from "@/components/ui/modal.tsx";
import {Spinner} from "@/components/ui/spinner.tsx";
import {useReviewMutation} from "@/lib/marketplace/reviews.ts";
import {REVIEW_REPORT_REASONS} from "@/lib/marketplace/types.ts";

/**
 * Flagging somebody else's review.
 *
 * The reasons are a closed set because the queue on the other end is grouped by them: a free-text
 * "why" would be a queue nobody can triage. The note is where the free text goes, and it is
 * optional — most reports are obvious from the review itself.
 *
 * One report per person per review, enforced by the service. A second attempt answers a sentence
 * saying so, which is shown as-is: "you already reported this" is more useful than a generic error,
 * and the dialog closes on success either way so nobody has to wonder whether it went through.
 */
export const ReportReviewDialog = ({
  open,
  onClose,
  slug,
  reviewId,
}: {
  open: boolean;
  onClose: () => void;
  slug: string;
  reviewId: string;
}) => {
  const {t} = useTranslation(["product", "common"]);
  const [reason, setReason] = useState<string>(REVIEW_REPORT_REASONS[0]);
  const [note, setNote] = useState("");
  const [sent, setSent] = useState(false);
  const mutation = useReviewMutation(slug);

  const submit = () => {
    void mutation.report(reviewId, reason, note.trim() || undefined).then((ok) => {
      if (!ok) return;
      setSent(true);
      setNote("");
    });
  };

  return (
    <Modal open={open} onClose={onClose} title={t("product:reviews.report_title")}>
      {sent ? (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-400">{t("product:reviews.report_sent")}</p>
          <Button
            size="sm"
            variant="secondary"
            onClick={() => {
              setSent(false);
              onClose();
            }}
          >
            {t("common:close")}
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-neutral-400">{t("product:reviews.report_body")}</p>

          <fieldset className="flex flex-col gap-2">
            <legend className="sr-only">{t("product:reviews.report_reason")}</legend>
            {REVIEW_REPORT_REASONS.map((option) => (
              <label key={option} className="flex items-center gap-2 text-sm text-neutral-300">
                <input
                  type="radio"
                  name="report-reason"
                  value={option}
                  checked={reason === option}
                  onChange={() => setReason(option)}
                />
                {t(`product:reviews.report_reasons.${option}`)}
              </label>
            ))}
          </fieldset>

          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] text-neutral-400">{t("product:reviews.report_note")}</span>
            <Textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={3}
              maxLength={1000}
              disabled={mutation.busy}
            />
          </label>

          {mutation.error && (
            <Alert tone="error">
              {mutation.error === "network"
                ? t("common:content_unreachable")
                : mutation.error === "unexpected"
                  ? t("common:content_failed")
                  : mutation.error}
            </Alert>
          )}

          <div className="flex items-center gap-2">
            <Button size="sm" onClick={submit} disabled={mutation.busy}>
              {mutation.busy ? <Spinner size={15}/> : <Flag size={15}/>} {t("product:reviews.report_send")}
            </Button>
            <Button size="sm" variant="ghost" onClick={onClose}>
              {t("product:reviews.cancel")}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
};
