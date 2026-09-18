import {useTranslation} from "react-i18next";
import {CaretLeft, CaretRight} from "@phosphor-icons/react";
import {Button} from "@/components/ui/button/button.tsx";

export type PaginationProps = {
  offset: number;
  limit: number;
  /** How many rows the current page actually returned. */
  count: number;
  onChange: (offset: number) => void;
  disabled?: boolean;
};

/**
 * Offset paging over a list endpoint that reports no total.
 *
 * A full page is the only hint that more exists, so "next" is offered exactly when the page came
 * back full — which can leave one empty page at the end, and is still better than hiding rows.
 */
export const Pagination = ({offset, limit, count, onChange, disabled}: PaginationProps) => {
  const {t} = useTranslation();
  const hasPrevious = offset > 0;
  const hasNext = count === limit;

  if (!hasPrevious && !hasNext) return null;

  return (
    <nav className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-800 pt-4" aria-label={t("admin:common.pagination")}>
      <p className="text-[13px] text-neutral-500">
        {count === 0
          ? t("admin:common.page_empty")
          : t("admin:common.page_range", {from: offset + 1, to: offset + count})}
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || !hasPrevious}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          <CaretLeft size={14}/> {t("admin:common.previous")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled || !hasNext}
          onClick={() => onChange(offset + limit)}
        >
          {t("admin:common.next")} <CaretRight size={14}/>
        </Button>
      </div>
    </nav>
  );
};
