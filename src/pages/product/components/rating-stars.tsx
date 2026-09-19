import {useTranslation} from "react-i18next";
import {Star, StarHalf} from "@phosphor-icons/react";
import {cn} from "@/lib/utils.ts";
import {MAX_RATING} from "@/lib/marketplace/types.ts";

/**
 * A rating, drawn.
 *
 * `value` being `null` is the case this component exists to get right, and it is the difference
 * between "nobody has said yet" and "everybody hated it". A null never renders as an empty row of
 * stars: it renders as nothing, and the caller says what the absence means. The service is careful
 * to answer `null` rather than `0` for exactly this reason, and a component that collapsed the two
 * would throw that away at the last step.
 *
 * Half stars round to the nearest half rather than down, because 4.4 shown as four flat stars reads
 * as a worse product than it is and 4.6 shown the same way reads as a better one.
 */
export const RatingStars = ({
  value,
  size = 16,
  className,
}: {
  value: number | null | undefined;
  size?: number;
  className?: string;
}) => {
  const {t} = useTranslation(["product"]);

  if (value === null || value === undefined) return null;

  const halves = Math.round(value * 2);

  return (
    <span
      className={cn("inline-flex items-center gap-0.5 text-amber-400", className)}
      role="img"
      aria-label={t("product:reviews.stars_label", {value: value.toFixed(1), max: MAX_RATING})}
    >
      {Array.from({length: MAX_RATING}, (_, index) => {
        const filled = halves >= (index + 1) * 2;
        const half = !filled && halves === index * 2 + 1;

        if (half) return <StarHalf key={index} size={size} weight="fill"/>;
        return (
          <Star
            key={index}
            size={size}
            weight={filled ? "fill" : "regular"}
            className={filled ? undefined : "text-neutral-600"}
          />
        );
      })}
    </span>
  );
};
