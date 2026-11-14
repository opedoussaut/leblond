"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass, linkClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { importArkoseHistory, type ArkoseImportResult } from "@/lib/actions/arkose-import";
import { ARKOSE_COLOURS, arkoseBatches, daySends, parseArkoseHistory } from "@/lib/climbing/arkose-history";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt } from "@/lib/i18n";
import { arkoseImportDictionary } from "@/lib/i18n/arkose-import";
import { utcToZoned } from "@/lib/time";

const MAX_BYTES = 1024 * 1024;

/** Reads the file on the device, shows what was understood, then sends it in batches of days. */
export function ArkoseImport({ gyms }: { gyms: Array<{ id: string; name: string }> }) {
  const { t, locale } = useI18n();
  const a = arkoseImportDictionary(locale);
  const [gymId, setGymId] = useState(gyms[0]?.id ?? "");
  const [text, setText] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<ArkoseImportResult | null>(null);
  const [error, setError] = useState(false);

  const parsed = text === null ? null : parseArkoseHistory(text, utcToZoned(new Date()).date);

  async function onFile(file: File | undefined) {
    setDone(null); setError(false);
    if (!file) { setText(null); return; }
    setText(file.size > MAX_BYTES ? "" : await file.text());
  }

  async function run() {
    if (!parsed?.days.length || !gymId) return;
    setError(false); setDone(null);
    const total: ArkoseImportResult = { sessions: 0, sends: 0, skippedDays: 0 };
    let sent = 0;
    setProgress({ done: 0, total: parsed.days.length });
    for (const batch of arkoseBatches(parsed.days)) {
      let r: Awaited<ReturnType<typeof importArkoseHistory>>;
      try { r = await importArkoseHistory({ gymId, days: batch }); } catch { r = { ok: false, error: "network" }; }
      if (!r.ok || !r.data) { setError(true); setProgress(null); if (total.sessions || total.skippedDays) setDone(total); return; }
      total.sessions += r.data.sessions; total.sends += r.data.sends; total.skippedDays += r.data.skippedDays;
      sent += batch.length;
      setProgress({ done: sent, total: parsed.days.length });
    }
    setProgress(null);
    setDone(total);
  }

  if (!gyms.length) return <p className="text-sm text-ink-3">{a.noGym}</p>;

  return <section aria-labelledby="arkose-import-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <h2 id="arkose-import-heading" className="sr-only">{a.title}</h2>
    <label className="block text-sm font-semibold">{a.gym}
      <select className={fieldClass} value={gymId} onChange={(e) => setGymId(e.target.value)}>
        {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
      </select>
    </label>
    <label className="block text-sm font-semibold">{a.file}
      <input type="file" accept=".csv,text/csv,text/plain" className={fieldClass} onChange={(e) => onFile(e.target.files?.[0])} data-testid="arkose-import-file" />
    </label>
    {parsed ? parsed.missingColumns.length
      ? <p role="alert" className="text-sm font-semibold text-danger">{fmt(a.missing, { cols: parsed.missingColumns.join(", ") })}</p>
      : <div className="space-y-2" role="status">
        <p className="text-sm font-semibold" data-testid="arkose-import-preview">{fmt(a.preview, { sends: parsed.sends, days: parsed.days.length, rejected: parsed.rejected.length })}</p>
        {parsed.rejected.length ? <ul className="space-y-1 text-xs text-ink-2">
          {parsed.rejected.slice(0, 30).map((r) => <li key={r.line}>{fmt(a.rejectedLine, { line: r.line, reason: a.reasons[r.reason] })}</li>)}
        </ul> : null}
        {parsed.days.length ? <ul className="max-h-72 space-y-1 overflow-auto rounded-xl bg-surface-2 p-3 text-xs">
          {parsed.days.map((d) => <li key={d.date}>
            <span className="font-semibold">{fmt(a.previewDay, { date: d.date, n: daySends(d) })}</span>
            {" · "}{ARKOSE_COLOURS.filter((c) => d.counts[c]).map((c) => `${gradeLabel(t, "ARKOSE_COLOR", c)} : ${d.counts[c]}`).join(", ")}
          </li>)}
        </ul> : <p className="text-sm text-ink-3">{a.empty}</p>}
      </div> : null}
    <button type="button" className={buttonClass("primary")} disabled={!parsed?.days.length || !!progress} onClick={run} data-testid="arkose-import-run">{a.run}</button>
    {progress ? <p role="status" className="text-sm font-semibold">{fmt(a.importing, progress)}</p> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{a.error}</p> : null}
    {done ? <p role="status" className="text-sm font-semibold" data-testid="arkose-import-done">{fmt(a.done, done)} <Link href="/session?type=climb" className={linkClass}>{a.seeJournal}</Link></p> : null}
  </section>;
}
