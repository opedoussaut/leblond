"use client";

import { useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { GradeChip } from "@/components/climbing/grade-chip";
import { ResultIcon, toneButtonStyle } from "@/components/climbing/result-badge";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import type { GradeSystem } from "@/lib/climbing/types";
import { listGrades, isColorSystem } from "@/lib/grading";
import { fontRangeFor, formatFontRange } from "@/lib/grading/conversions";
import { gradeLabel, gradeSpokenLabel } from "@/lib/grading/labels";
import { fmt } from "@/lib/i18n";
import { loggingDictionary } from "@/lib/i18n/logging";
import { Stepper } from "./route-session";
import { IconFlash } from "@/components/ui/icons";

type Outcome = "FLASH" | "TOP" | "ATTEMPT" | "PROJECT";
export type QuickChoice = { grade: string; count: number; tries: number; outcome: Outcome; notes: string };

/** Several problems of one grade, with their tries and outcome, in one tap. */
export function QuickBoulderEntry({ system, onSubmit, onClose }: {
  system: GradeSystem;
  /** Logs them (saved on the phone, sent when there is signal); false when refused. */
  onSubmit: (choice: QuickChoice) => boolean;
  onClose: () => void;
}) {
  const { t, locale } = useI18n();
  const L = loggingDictionary(locale);
  const [grade, setGrade] = useState<string | null>(null);
  const [count, setCount] = useState(1);
  const [tries, setTries] = useState(1);
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const grades = listGrades(system);
  // Climbing District levels: twelve big numerals, the chosen one clearly marked.
  const levels = system === "CLIMBING_DISTRICT_LEVEL";

  function submit(outcome: Outcome) {
    if (!grade) return;
    setMessage(null);
    if (!onSubmit({ grade, count, tries: outcome === "FLASH" ? 1 : tries, outcome, notes })) {
      setMessage({ ok: false, text: t.common.unknownError });
      return;
    }
    setMessage({ ok: true, text: fmt(L.logged, { n: count, grade: gradeLabel(t, system, grade) }) });
    setCount(1); setTries(1); setNotes("");
  }

  return <section aria-labelledby="quick-entry" className="space-y-4 rounded-2xl border-2 border-accent/40 bg-surface p-4">
    <div className="flex items-start justify-between gap-2">
      <div>
        <h2 id="quick-entry" className="font-bold"><IconFlash /> {L.quickTitle}</h2>
        <p className="text-xs text-ink-3">{L.quickHint}</p>
      </div>
      <button type="button" onClick={onClose} className={buttonClass("ghost", "sm", "text-ink-2")}>{t.common.cancel}</button>
    </div>
    <fieldset>
      <legend className="text-sm font-bold">{levels ? t.session.pickLevel : t.session.pickGrade}</legend>
      <div className={cn("mt-2 grid gap-2", isColorSystem(system) ? "grid-cols-3" : system === "FONT" ? "grid-cols-6" : levels ? "grid-cols-4" : "grid-cols-5")}>
        {grades.map((g) => <button key={g.id} type="button" aria-pressed={grade === g.id} onClick={() => setGrade(g.id)}
          aria-label={levels ? gradeSpokenLabel(t, system, g.id) : undefined}
          style={g.swatch ? { backgroundColor: g.swatch, color: g.swatchText } : undefined}
          className={cn("flex flex-col items-center justify-center rounded-xl border px-1",
            levels ? "min-h-14 leblond-number text-2xl" : "min-h-12 text-xs font-bold",
            isColorSystem(system) && "uppercase",
            grade === g.id ? cn("ring-4 ring-accent ring-offset-2", levels && "border-accent bg-accent text-accent-ink") : "border-line")}>
          <span>{isColorSystem(system) ? (t.grades.colors as Record<string, string>)[g.id] : g.id}</span>
          {fontRangeFor(system, g.id) ? <span className="text-xs font-medium normal-case opacity-90">{formatFontRange(fontRangeFor(system, g.id)!)}</span> : null}
        </button>)}
      </div>
    </fieldset>
    {grade ? <>
      <p className="text-sm"><GradeChip t={t} system={system} grade={grade} showFont /></p>
      <Stepper label={L.howMany} value={count} min={1} max={30} onChange={setCount} />
      <Stepper label={L.tries} hint={L.triesHint} value={tries} min={1} max={50} onChange={setTries} />
      <label className="block text-sm font-bold">{L.comment}
        <textarea value={notes} maxLength={2000} rows={2} placeholder={L.commentPlaceholder} onChange={(ev) => setNotes(ev.target.value)}
          className="mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 font-normal" />
      </label>
      <div className="grid grid-cols-2 gap-2">
        {([["FLASH", "flash", L.flash], ["TOP", "top", L.top], ["ATTEMPT", "attempt", L.notSent], ["PROJECT", "project", L.project]] as const)
          .map(([outcome, tone, label]) => <button key={outcome} type="button"
            disabled={outcome === "FLASH" && tries > 1} onClick={() => submit(outcome)}
            style={toneButtonStyle(tone)} className="inline-flex min-h-14 items-center justify-center gap-1.5 rounded-2xl border px-3 text-base font-semibold disabled:opacity-40">
            <ResultIcon tone={tone} />{label}{outcome !== "FLASH" && tries > 1 ? ` · ${tries}` : ""}
          </button>)}
      </div>
      {tries > 1 ? <p className="text-xs text-ink-3">{L.flashOnlyOne}</p> : null}
    </> : null}
    {message ? <p role={message.ok ? "status" : "alert"} className={cn("text-sm font-semibold", message.ok ? "text-ink-2" : "text-danger")}>{message.text}</p> : null}
  </section>;
}
