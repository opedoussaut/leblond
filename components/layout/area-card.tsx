import Link from "next/link";
import type { ReactNode } from "react";

export function AreaCard({
  href, title, description, icon, emphasis = false, note,
}: {
  href: string;
  title: string;
  description: string;
  icon: ReactNode;
  emphasis?: boolean;
  note?: string;
}) {
  return <Link href={href}
    className={"group flex h-full items-start gap-4 rounded-2xl border p-5 transition-colors hover:border-accent focus-visible:outline-2 " +
      (emphasis ? "border-accent/30 bg-accent-soft" : "border-line bg-surface")}>
    <span className="shrink-0 text-accent [&_svg]:h-6 [&_svg]:w-6">{icon}</span>
    <span className="min-w-0 flex-1">
      <span className="block text-base font-bold text-ink">{title}</span>
      <span className="mt-1 block text-sm leading-relaxed text-ink-2">{description}</span>
      {note ? <span className="mt-2 block text-xs font-semibold text-accent">{note}</span> : null}
    </span>
    <svg className="mt-0.5 h-5 w-5 shrink-0 text-accent transition-transform group-hover:translate-x-0.5" viewBox="0 0 20 20" fill="none"
      stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m8 5 5 5-5 5" />
    </svg>
  </Link>;
}
