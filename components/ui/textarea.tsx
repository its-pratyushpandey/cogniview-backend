"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

const Textarea = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    data-slot="textarea"
    className={cn(
      "min-h-[88px] w-full rounded-2xl border border-input/80 bg-secondary/60 px-3 py-2 text-sm shadow-md shadow-black/15 backdrop-blur placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30 disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
))
Textarea.displayName = "Textarea"

export { Textarea }
