"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createCoachKey, revokeCoachKey } from "@/lib/actions/coach-sessions";
import { fmt, type Locale } from "@/lib/i18n";
import { coachSessionsDictionary } from "@/lib/i18n/coach-sessions";
import { formatDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { fieldClass as field } from "@/components/ui/field";
import type { CoachKey } from "@/lib/data/coach-sessions";

/** Create (shown once), list and revoke personal coach keys. */
export function CoachKeys({ locale, keys }: { locale: Locale; keys: CoachKey[] }) {
  const t = coachSessionsDictionary(locale).keys;
  const router = useRouter();
  const [label, setLabel] = useState(t.labelDefault);
  const [created, setCreated] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const day = (iso: string) => formatDate(iso, locale, { day: "numeric", month: "short", year: "numeric" });

  function create() {
    setError(null);
    start(async () => {
      const r = await createCoachKey(label);
      if (!r.ok) { setError(r.error === "too_many_keys" ? t.errors.too_many_keys : t.errors.unknown); return; }
      setCreated(r.data.key);
      setCopied(false);
      router.refresh();
    });
  }
  function revoke(id: string) {
    if (!window.confirm(t.revokeConfirm)) return;
    start(async () => { await revokeCoachKey(id); router.refresh(); });
  }
  async function copy() {
    if (!created) return;
    try { await navigator.clipboard.writeText(created); setCopied(true); } catch { /* the key stays selectable */ }
  }

  return <section aria-labelledby="coach-keys-heading" className="leblond-premium-surface mt-8 space-y-4 p-5 sm:p-6">
    <h2 id="coach-keys-heading" className="text-lg font-extrabold">{t.title}</h2>
    <p className="text-sm text-ink-2">{t.intro}</p>

    {created ? <div role="status" className="space-y-3 rounded-xl border border-accent/40 bg-accent-soft p-4">
      <p className="text-sm font-bold">{t.createdTitle}</p>
      <code className="block select-all break-all rounded-lg bg-surface p-3 text-sm" data-testid="coach-key">{created}</code>
      <p className="text-xs text-ink-2">{t.createdHelp}</p>
      <div className="leblond-actions">
        <button type="button" onClick={copy} className={buttonClass("secondary", "sm")}>{copied ? t.copied : t.copy}</button>
        <button type="button" onClick={() => setCreated(null)} className={buttonClass("primary", "sm")}>{t.done}</button>
      </div>
    </div> : <form className="flex flex-wrap items-end gap-3" onSubmit={(e) => { e.preventDefault(); create(); }}>
      <label className="min-w-48 flex-1 text-sm font-semibold">{t.label}
        <input className={field} maxLength={60} required value={label} onChange={(e) => setLabel(e.target.value)} />
      </label>
      <button type="submit" disabled={pending} className={buttonClass("primary", "md")}>{t.create}</button>
    </form>}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}

    <h3 className="text-sm font-extrabold">{t.active}</h3>
    {keys.length ? <ul className="space-y-2">
      {keys.map((k) => <li key={k.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm">
        <span>
          <strong>{k.label}</strong> <code className="text-ink-2">{k.prefix}…</code>
          <span className="block text-xs text-ink-3">
            {fmt(t.createdOn, { d: day(k.createdAt) })} · {k.lastUsedAt ? fmt(t.lastUsed, { d: day(k.lastUsedAt) }) : t.neverUsed}
          </span>
        </span>
        <button type="button" disabled={pending} onClick={() => revoke(k.id)} className={buttonClass("danger", "sm")}>{t.revoke}</button>
      </li>)}
    </ul> : <p className="text-sm text-ink-3">{t.none}</p>}
  </section>;
}
