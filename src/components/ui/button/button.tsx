import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { type VariantProps } from "class-variance-authority"

import {buttonVariants} from "@/components/ui/button/buttonVariants";
import {cn} from "@/lib/utils.ts";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

/*
 * The ripple's geometry, written straight onto the node: the origin is where the pointer is, and
 * the diameter is twice the distance to the furthest corner from there, so a circle of that size
 * centred on the origin covers the button no matter which edge the pointer came in through.
 */
const writeRippleOrigin = (el: HTMLElement, clientX: number, clientY: number, atLeast = 0) => {
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const diameter = 2 * Math.hypot(Math.max(x, rect.width - x), Math.max(y, rect.height - y))

  el.style.setProperty("--fs-ripple-x", `${x}px`)
  el.style.setProperty("--fs-ripple-y", `${y}px`)
  el.style.setProperty("--fs-ripple-d", `${Math.max(diameter, atLeast)}px`)
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, onPointerEnter, onPointerLeave, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"

    const handlePointerEnter = (event: React.PointerEvent<HTMLButtonElement>) => {
      const el = event.currentTarget
      writeRippleOrigin(el, event.clientX, event.clientY)
      el.style.setProperty("--fs-ripple-scale", "1")
      onPointerEnter?.(event)
    }

    const handlePointerLeave = (event: React.PointerEvent<HTMLButtonElement>) => {
      const el = event.currentTarget
      /*
       * Re-centring on the exit point makes the fill collapse toward where the pointer left. The
       * diameter never shrinks while it does, so the button stays covered at the moment it moves
       * and the switch is invisible.
       */
      const current = Number.parseFloat(el.style.getPropertyValue("--fs-ripple-d")) || 0
      writeRippleOrigin(el, event.clientX, event.clientY, current)
      el.style.setProperty("--fs-ripple-scale", "0")
      onPointerLeave?.(event)
    }

    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        onPointerEnter={handlePointerEnter}
        onPointerLeave={handlePointerLeave}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button }
