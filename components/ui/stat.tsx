import { cn } from "./cn";

export function Stat({ value, label, className }: { value: React.ReactNode; label: string; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <div className="text-2xl font-black tabular-nums leading-none">{value}</div>
      <div className="mt-1 text-xs uppercase tracking-wider text-ink-3">{label}</div>
    </div>
  );
}

/** Collapsible explanation used for every "How is this calculated?" link. */
export function Explain({ summary, children }: { summary: string; children: React.ReactNode }) {
  return (
    <details className="group mt-2 text-sm">
      <summary className="cursor-pointer list-none text-accent underline-offset-2 hover:underline">{summary}</summary>
      <div className="mt-2 rounded-xl bg-surface-2 p-3 text-ink-2">{children}</div>
    </details>
  );
}
