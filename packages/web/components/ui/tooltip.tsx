"use client"

import * as React from "react"
import * as TooltipPrimitive from "@radix-ui/react-tooltip"
import { motion, useReducedMotion } from "motion/react"

import { cn } from "@/lib/utils"
import { DURATION } from "@/lib/motion"

function TooltipProvider({
  delayDuration = 0,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Provider>) {
  return (
    <TooltipPrimitive.Provider
      data-slot="tooltip-provider"
      delayDuration={delayDuration}
      {...props}
    />
  )
}

function Tooltip({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...props} />
    </TooltipProvider>
  )
}

function TooltipTrigger({
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Trigger>) {
  return <TooltipPrimitive.Trigger data-slot="tooltip-trigger" {...props} />
}

/**
 * Editorial Paper tooltip: a hairline-bordered paper panel (sharp corners),
 * with a quiet pop on entry — the sole entrance animation, composed from the
 * shared motion register (DURATION.micro on the shared power3-out curve).
 * Gated behind reduced motion: under prefers-reduced-motion the tooltip
 * appears instantly. The Radix data-state exit classes remain for a smooth
 * fade-out; the global reduced-motion rule in globals.css neutralizes them.
 */
function TooltipContent({
  className,
  sideOffset = 0,
  children,
  ...props
}: React.ComponentProps<typeof TooltipPrimitive.Content>) {
  const prefersReducedMotion = useReducedMotion();

  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        data-slot="tooltip-content"
        sideOffset={sideOffset}
        className={cn(
          "border border-border bg-popover text-popover-foreground data-[state=closed]:animate-out data-[state=closed]:fade-out-0 z-50 w-fit origin-(--radix-tooltip-content-transform-origin) px-3 py-1.5 text-xs text-balance shadow-sm",
          className
        )}
        {...props}
      >
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          // power3.out expressed numerically (the register's EASE token is
          // the GSAP string "power3.out" — motion/react takes the bezier).
          transition={{ duration: DURATION.micro, ease: [0.16, 1, 0.3, 1] }}
        >
          {children}
        </motion.div>
        <TooltipPrimitive.Arrow className="fill-popover z-50 size-2.5 translate-y-[calc(-50%_-_2px)] rotate-45" />
      </TooltipPrimitive.Content>
    </TooltipPrimitive.Portal>
  )
}

export { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider }
