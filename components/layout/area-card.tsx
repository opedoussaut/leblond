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
    className={"group flex min-h-44 flex-col justify-between gap-5 rounded-[1.5rem] border p-5 transition-colors hover:border-accent focus-visible:outline-2 " +
      (emphasis ? "border-accent/30 bg-accent-soft" : "border-line bg-surface")}>
    <div className="flex items-center justify-between gap-2">
      <span className="text-accent [&_svg]:h-8 [&_svg]:w-8">{icon}</span>
      <span className="text-accent transition-transform group-hover:translate-x-1" aria-hidden="true">↗</span>
    </div>
    <div>
      <h2 className="text-lg font-extrabold tracking-tight text-ink">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-ink-2">{description}</p>
      {note ? <p className="mt-3 text-xs font-semibold text-accent">{note}</p> : null}
    </div>
  </Link>;
}
