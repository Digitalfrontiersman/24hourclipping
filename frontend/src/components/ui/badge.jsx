import * as React from "react"
import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[#CCFF00] text-black hover:bg-[#B3E600]",
        secondary:
          "border-transparent bg-white/[0.08] text-zinc-200 hover:bg-white/[0.12]",
        destructive:
          "border-transparent bg-[#FF4500] text-white hover:bg-[#E63E00]",
        outline: "border-white/15 text-zinc-300",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

function Badge({
  className,
  variant,
  ...props
}) {
  return (<div className={cn(badgeVariants({ variant }), className)} {...props} />);
}

export { Badge, badgeVariants }
