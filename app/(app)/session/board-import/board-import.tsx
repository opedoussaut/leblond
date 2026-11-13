"use client";

import Link from "next/link";
import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass, linkClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { importBoardLogbook } from "@/lib/actions/boards";
import { importBatches, parseBoardLibCsv, type BoardLibParse } from "@/lib/climbing/boardlib-csv";
import { BOARD_SHORT, BOARDS, type Board } from "@/lib/climbing/boards";
import { fmt } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";
import { boulderGrade } from "@/lib/grading/display";

const MAX_BYTES = 10 * 1024 * 1024;

/** Reads the file on the phone or computer, shows what was understood, then sends it in batches of whole days. */
export function BoardImport() {
  const { locale } = useI18n();
  const b = boardsDictionary(locale);
  const [text, setText] = useState<string | null>(null);
  const [fallback, setFallback] = useState<Board | "">("");
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState<{ added: number; skipped: number; sessions: number } | null>(null);
  const [error, setError] = useState(false);

  const parsed: BoardLibParse | null = text === null ? null : parseBoardLibCsv(text, fallback || null);
  const days = parsed ? new Set(parsed.rows.map((r) => r.date)).size : 0;

  async function onFile(file: File | undefined) {
    setDone(null); setError(false);
    if (!file) { setText(null); return; }
    if (file.size > MAX_BYTES) { setText(""); return; }
    setText(await file.text());
  }

  async function run() {
    if (!parsed?.rows.length) return;
    setError(false); setDone(null);
    const batches = importBatches(parsed.rows);
    const total = { added: 0, skipped: 0, sessions: 0 };
    setProgress({ done: 0, total: parsed.rows.length });
    let sent = 0;
    for (const batch of batches) {
      let r: Awaited<ReturnType<typeof importBoardLogbook>>;
      try { r = await importBoardLogbook({ rows: batch }); } catch { r = { ok: false, error: "network" }; }
      if (!r.ok || !r.data) { setError(true); setProgress(null); if (total.added || total.skipped) setDone(total); return; }
      total.added += r.data.added; total.skipped += r.data.skipped; total.sessions += r.data.sessions;
      sent += batch.length;
      setProgress({ done: sent, total: parsed.rows.length });
    }
    setProgress(null);
    setDone(total);
  }

  return <section aria-labelledby="import-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <h2 id="import-heading" className="sr-only">{b.importTitle}</h2>
    <label className="block text-sm font-semibold">{b.importFile}
      <input type="file" accept=".csv,text/csv" className={fieldClass} onChange={(e) => onFile(e.target.files?.[0])} data-testid="board-import-file" />
    </label>
    <label className="block text-sm font-semibold">{b.importFallback}
      <select className={fieldClass} value={fallback} onChange={(e) => setFallback(e.target.value as Board | "")}>
        <option value="">{b.importNone}</option>
        {BOARDS.map((x) => <option key={x} value={x}>{BOARD_SHORT[x]}</option>)}
      </select>
    </label>
    {parsed ? parsed.missingColumns.length ? <p role="alert" className="text-sm font-semibold text-danger">{fmt(b.importMissing, { cols: parsed.missingColumns.join(", ") })}</p>
      : <div className="space-y-2" role="status">
        <p className="text-sm font-semibold" data-testid="board-import-preview">{fmt(b.importPreview, { n: parsed.rows.length, days, rejected: parsed.rejected.length })}</p>
        {parsed.rejected.length ? <details className="text-xs text-ink-2">
          <summary className="min-h-11 cursor-pointer py-2">{fmt(b.importPreview, { n: parsed.rows.length, days, rejected: parsed.rejected.length })}</summary>
          <ul className="space-y-1">{parsed.rejected.slice(0, 50).map((r) => <li key={r.line}>{fmt(b.importRejectedLine, { line: r.line, reason: b.importReasons[r.reason] })}</li>)}</ul>
        </details> : null}
        {parsed.rows.length ? <ul className="max-h-64 space-y-1 overflow-auto rounded-xl bg-surface-2 p-3 text-xs">
          {parsed.rows.slice(0, 30).map((r) => <li key={r.ref}>{r.date} · {BOARD_SHORT[r.board]} {r.angle}° · {r.name} · {boulderGrade(r.grade)} · {b.results[r.result]}</li>)}
        </ul> : <p className="text-sm text-ink-3">{b.importEmpty}</p>}
      </div> : null}
    {progress ? <p role="status" className="text-sm font-semibold">{fmt(b.importing, progress)}</p> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{b.importError}</p> : null}
    {done ? <p role="status" className="text-sm font-semibold" data-testid="board-import-done">{fmt(b.importDone, done)} <Link href="/session?type=climb" className={linkClass}>{b.importSeeJournal}</Link></p> : null}
    <button type="button" disabled={!parsed?.rows.length || !!progress} onClick={run} className={buttonClass("primary", "lg")}>{b.importGo}</button>
  </section>;
}
