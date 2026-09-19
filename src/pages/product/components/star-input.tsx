import {useState} from "react";
import {useTranslation} from "react-i18next";
import {Star} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {MAX_RATING, MIN_RATING} from "@/lib/marketplace/types.ts";

/**
 * Picking a rating.
 *
 * A row of radio inputs under the stars rather than buttons with `aria-label`s: a rating is a
 * single choice from a small set, which is what a radio group *is*, and getting that right means
 * arrow keys, a form value and a screen reader announcement all work without being rebuilt.
 *
 * Whole stars only. Half stars are fine to *display* — an average genuinely lands between two — but
 * asking somebody to choose 3.5 turns a one-click judgement into a measurement.
 */
export const StarInput = ({
  value,
  onChange,
  disabled = false,
  className,
}: {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
  className?: string;
}) => {
  const {t} = useTranslation(["product"]);
  /** What the pointer is over, so the row previews the choice before it is made. */
  const [hovered, setHovered] = useState<number | null>(null);

  const shown = hovered ?? value;

  return (
    <div
      className={cn("flex items-center gap-1", className)}
      role="radiogroup"
      aria-label={t("product:reviews.rating_label")}
      onMouseLeave={() => setHovered(null)}
    >
      {Array.from({length: MAX_RATING}, (_, index) => {
        const rating = index + MIN_RATING;
        const filled = shown >= rating;

        return (
          <label
            key={rating}
            className={cn("cursor-pointer p-0.5", disabled && "cursor-not-allowed opacity-60")}
            onMouseEnter={() => !disabled && setHovered(rating)}
          >
            <input
              type="radio"
              name="review-rating"
              value={rating}
              checked={value === rating}
              disabled={disabled}
              onChange={() => onChange(rating)}
              className="sr-only"
            />
            <Star
              size={28}
              weight={filled ? "fill" : "regular"}
              className={cn("transition", filled ? "text-amber-400" : "text-neutral-600")}
            />
            <span className="sr-only">{t("product:reviews.rating_option", {count: rating})}</span>
          </label>
        );
      })}
    </div>
  );
};
