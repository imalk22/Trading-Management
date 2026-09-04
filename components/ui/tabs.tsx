"use client";

import { cn } from "@/lib/utils";

export interface TabsProps<T extends string> {
  value: T;
  options: readonly T[];
  onChange: (value: T) => void;
  className?: string;
}

export function Tabs<T extends string>({ value, options, onChange, className }: TabsProps<T>) {
  return (
    <div role="tablist" className={cn("inline-flex gap-1 rounded-lg bg-muted p-1", className)}>
      {options.map((option) => (
        <button
          key={option}
          role="tab"
          type="button"
          aria-selected={option === value}
          onClick={() => onChange(option)}
          className={cn(
            "rounded-md px-3 py-1 text-xs font-medium transition-colors",
            option === value
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
