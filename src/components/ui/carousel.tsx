import type {ReactNode} from "react";
import {CaretLeft, CaretRight} from "@phosphor-icons/react";
import {useTranslation} from "react-i18next";
import {cn} from "@/lib/utils";
import {useAppCarousel} from "@/hooks/useAppCarousel.ts";

type CarouselProps = {
  children: ReactNode;
  slideClassName?: string;
};

export const Carousel = ({children, slideClassName}: CarouselProps) => {
  const {t} = useTranslation("common");
  const {emblaRef, scrollPrev, scrollNext, canScrollPrev, canScrollNext} = useAppCarousel();
  const hasOverflow = canScrollPrev || canScrollNext;

  return (
    <div className="relative">
      <div className="overflow-hidden py-6 -my-2 px-3 -mx-3" ref={emblaRef}>
        <div className="flex items-stretch gap-6">
          {Array.isArray(children)
            ? children.map((child, index) => (
                <div key={index} className={cn("shrink-0 flex flex-col self-stretch", slideClassName)}>
                  {child}
                </div>
              ))
            : <div className={cn("shrink-0 flex flex-col self-stretch", slideClassName)}>{children}</div>}
        </div>
      </div>

      {hasOverflow && (
        <>
          <button
            type="button"
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            aria-label={t("common:carousel_previous")}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 rounded-full bg-surface p-2 shadow-[var(--shadow-md)] text-text disabled:opacity-0 disabled:pointer-events-none transition-opacity"
          >
            <CaretLeft size={18}/>
          </button>
          <button
            type="button"
            onClick={scrollNext}
            disabled={!canScrollNext}
            aria-label={t("common:carousel_next")}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 rounded-full bg-surface p-2 shadow-[var(--shadow-md)] text-text disabled:opacity-0 disabled:pointer-events-none transition-opacity"
          >
            <CaretRight size={18}/>
          </button>
        </>
      )}
    </div>
  );
};
