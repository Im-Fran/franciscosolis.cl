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
  /**
   * The size of the whole list, for the endpoints that report one. With it, "next" stops exactly at
   * the last row instead of offering the empty page after a list that ended on a full one.
   */
  total?: number;
};

/**
 * Offset paging over a list endpoint.
 *
 * Most of them report no total, and there a full page is the only hint that more exists, so "next"
 * is offered exactly when the page came back full — which can leave one empty page at the end, and
 * is still better than hiding rows. When a `total` is known it decides instead.
 */
export const Pagination = ({offset, limit, count, onChange, disabled, total}: PaginationProps) => {
  const {t} = useTranslation();
  const hasPrevious = offset > 0;
  const hasNext = total === undefined ? count === limit : offset + count < total;

  if (!hasPrevious && !hasNext) return null;

  return (
    <nav className="mt-5 flex items-center justify-between gap-3 border-t border-neutral-800 pt-4" aria-label={t("admin:common.pagination")}>
      <p className="text-[13px] text-neutral-500">
        {count === 0
          ? t("admin:common.page_empty")
          : total === undefined
            ? t("admin:common.page_range", {from: offset + 1, to: offset + count})
            : t("admin:common.page_range_total", {from: offset + 1, to: offset + count, total})}
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
