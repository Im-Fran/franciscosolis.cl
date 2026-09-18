import {cva} from "class-variance-authority";

/*
 * Every variant is an outline that fills in on hover. The fill itself is the `.fs-ripple` circle
 * in src/lib/main.css, so what each variant sets here is only the colour it fills with and the
 * text and border it ends on — never a `hover:bg-*`, which would paint the whole button at once.
 */
const buttonVariants = cva(
  "fs-ripple inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--radius-md)] text-sm font-medium focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50 cursor-pointer",
  {
    variants: {
      variant: {
        primary:
          "border border-accent text-accent-300 bg-transparent [--fs-ripple-fill:var(--color-accent)] hover:text-bg focus-visible:text-bg",
        secondary:
          "border border-neutral-700 text-neutral-200 bg-transparent [--fs-ripple-fill:var(--color-neutral-700)] hover:text-neutral-100 focus-visible:text-neutral-100",
        ghost:
          "border border-transparent text-neutral-200 bg-transparent [--fs-ripple-fill:var(--color-neutral-800)] hover:border-neutral-800 hover:text-neutral-100 focus-visible:text-neutral-100",
      },
      size: {
        default: "h-11 px-5 py-2",
        sm: "h-9 px-4",
        lg: "h-12 px-6",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "primary",
      size: "default",
    },
  },
)

export {buttonVariants}
