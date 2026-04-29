import * as React from "react";
import { cn } from "@/lib/utils";
import { forwardRef, InputHTMLAttributes } from "react";

const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        "flex h-10 w-full rounded-10 border-1.5 border-scout-border bg-white px-3.5 py-2 text-14 text-scout-text shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-scout-text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50",
        className
      )}
      {...props}
    />
  )
);
Input.displayName = "Input";

export { Input };
