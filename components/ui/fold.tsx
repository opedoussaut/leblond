import type { ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "./cn";

/**
 * Details folded away behind one line: a title, a short hint and, when it
 * helps, one figure. "card" is a standalone surface whose content opens below
 * it (content that brings its own cards); "inline" sits inside a card, under a
 * divider; "flush" fills a card on its own. Native <details>: keyboard and screen readers work as is.
 */
export function Fold({ title, hint, figure, variant = "inline", open, children, className, testId }: {
  title: string;
  hint?: string;
  figure?: ReactNode;
  variant?: "card" | "inline" | "flush";
  open?: boolean;
  children: ReactNode;
  className?: string;
  testId?: string;
}) {
  const card = variant === "card";
  return <details open={open} data-testid={testId} className={cn("group", variant === "inline" && "border-t border-line pt-2", className)}>
    <summary className={cn(
      "flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 [&::-webkit-details-marker]:hidden",
      "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent",
      card ? "leblond-premium-surface px-5 py-4 hover:border-accent" : "rounded-lg py-2",
    )}>
      <span className="min-w-0">
        <span className={cn("block font-bold", card ? "text-lg" : "text-base")}>{title}</span>
        {hint ? <span className="mt-0.5 block text-sm text-ink-2">{hint}</span> : null}
      </span>
      <span className="flex shrink-0 items-center gap-3">
        {figure ? <span className="leblond-number text-xl">{figure}</span> : null}
        <ChevronDown aria-hidden="true" className="size-5 text-ink-3 transition-transform group-open:rotate-180" strokeWidth={2.25} />
      </span>
    </summary>
    <div className={card ? "mt-3 space-y-5" : "pt-2 pb-1"}>{children}</div>
  </details>;
}
