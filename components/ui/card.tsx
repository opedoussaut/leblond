import { cn } from "./cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section {...props} className={cn("rounded-2xl border border-line bg-surface p-4", className)} />;
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-xs font-bold uppercase tracking-[0.14em] text-ink-3", className)}>{children}</h2>;
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div>
        <h1 className="text-2xl font-black tracking-tight">{title}</h1>
        {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
      </div>
      {action}
    </header>
  );
}

export function EmptyState({ title, body, action }: { title?: string; body: string; action?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-line p-6 text-center">
      {title ? <p className="font-semibold">{title}</p> : null}
      <p className="mt-1 text-sm text-ink-2">{body}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Notice({ tone = "info", children }: { tone?: "info" | "warn" | "error" | "ok"; children: React.ReactNode }) {
  const tones = {
    info: "border-line bg-surface-2 text-ink-2",
    warn: "border-warn/40 bg-warn/10 text-ink",
    error: "border-danger/40 bg-danger/10 text-ink",
    ok: "border-ok/40 bg-ok/10 text-ink",
  } as const;
  return (
    <div role={tone === "error" ? "alert" : "status"} className={cn("rounded-xl border px-3 py-2 text-sm", tones[tone])}>
      {children}
    </div>
  );
}
