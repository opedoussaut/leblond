"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/** Two selects that pick the series of the paired curves; the page re-renders them on the server. */
export function SeriesPicker({ options, a, b, labels }: {
  options: Array<{ id: string; label: string }>;
  a: string; b: string;
  labels: { a: string; b: string };
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();
  const pick = (key: "a" | "b", value: string) => {
    const next = new URLSearchParams(params.toString());
    next.set(key, value);
    start(() => router.replace(`${pathname}?${next.toString()}`, { scroll: false }));
  };
  const select = (key: "a" | "b", value: string, label: string) => (
    <label className="block min-w-0 flex-1">
      <span className="mb-1 block text-xs font-semibold text-ink-3">{label}</span>
      <select value={value} onChange={(e) => pick(key, e.target.value)} disabled={pending}
        className="min-h-11 w-full rounded-xl border border-line bg-surface px-3 text-sm font-semibold text-ink">
        {options.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
      </select>
    </label>
  );
  return <div className="flex flex-col gap-3 sm:flex-row" aria-busy={pending}>
    {select("a", a, labels.a)}
    {select("b", b, labels.b)}
  </div>;
}
