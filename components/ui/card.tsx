import { cn } from "./cn";

export function Card({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  return <section {...props} className={cn("leblond-premium-surface p-5", className)} />;
}

export function SectionTitle({ children, className }: { children: React.ReactNode; className?: string }) {
  return <h2 className={cn("text-xs font-bold uppercase tracking-[0.12em] text-ink-3", className)}>{children}</h2>;
}

/**
 * Page title. `icon` is the page's navigation icon (components/layout/nav-icons),
 * so a page looks the same in the menu and in its own header.
 */
export function PageHeader({ title, subtitle, action, icon }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  icon?: React.ReactNode;
}) {
  return (
    <header className="mb-5 flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {icon ? <span aria-hidden="true"
          className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent md:h-11 md:w-11 [&_svg]:h-5 [&_svg]:w-5 md:[&_svg]:h-[22px] md:[&_svg]:w-[22px]">
          {icon}
        </span> : null}
        <div className="min-w-0">
          <h1 className="text-2xl font-black tracking-tight md:text-3xl">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-2">{subtitle}</p> : null}
        </div>
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
