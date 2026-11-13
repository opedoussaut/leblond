"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { buttonClass } from "@/components/ui/button";
import { deleteBoardProject, setBoardProjectStatus } from "@/lib/actions/boards";
import { BOARD_SHORT, type Board, type BoardProjectStatus } from "@/lib/climbing/boards";
import type { BoardProjectRow } from "@/lib/data/boards";
import { formatDate } from "@/lib/format";
import { fmt, type Locale } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";
import { useI18n } from "@/components/i18n-provider";

/** Board projects: a climb (board, name, angle) not sent yet. Sending it in a séance closes it. */
export function BoardProjects({ locale, projects }: { locale: Locale; projects: BoardProjectRow[] }) {
  const b = boardsDictionary(locale);
  const { t } = useI18n();
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<{ ok: boolean }>) => start(async () => {
    setError(false);
    const r = await fn();
    if (r.ok) router.refresh(); else setError(true);
  });

  return <section aria-labelledby="board-projects" className="mt-8 space-y-3">
    <h2 id="board-projects" className="text-lg font-bold">{b.projectsTitle}</h2>
    {projects.length ? <ul className="space-y-2">
      {projects.map((p) => <li key={p.id} className="rounded-2xl border border-line bg-surface p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-lg font-black tabular-nums">{p.grade}</span>
          <span className="text-xs font-bold uppercase tracking-[0.12em] text-ink-3">{b.projectStatus[p.status as BoardProjectStatus]}</span>
        </div>
        <p className="mt-1 font-semibold">{p.climb_name}</p>
        <p className="text-sm text-ink-3">
          {BOARD_SHORT[p.board as Board]} · {p.angle}° · {fmt(t.projects.since, { date: formatDate(p.started_at, locale) })}
        </p>
        <div className="leblond-actions mt-3">
          {p.status === "ACTIVE" ? <>
            <button type="button" disabled={pending} onClick={() => run(() => setBoardProjectStatus(p.id, "SENT"))} className={buttonClass("secondary", "sm")}>{b.markSent}</button>
            <button type="button" disabled={pending} onClick={() => run(() => setBoardProjectStatus(p.id, "ABANDONED"))} className={buttonClass("ghost", "sm")}>{b.abandon}</button>
          </> : <button type="button" disabled={pending} onClick={() => run(() => setBoardProjectStatus(p.id, "ACTIVE"))} className={buttonClass("ghost", "sm")}>{b.reopen}</button>}
          <button type="button" disabled={pending} onClick={() => { if (window.confirm(b.removeConfirm)) run(() => deleteBoardProject(p.id)); }} className={buttonClass("ghost", "sm")}>{b.remove}</button>
        </div>
      </li>)}
    </ul> : <p className="text-sm text-ink-2">{b.projectsEmpty}</p>}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{b.error}</p> : null}
  </section>;
}
