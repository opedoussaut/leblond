import type { Locale } from "@/lib/i18n";
import { pick, type TrainingExercise, type TrainingSession } from "./sessions";

/**
 * Export of one training session (CSV, printable page for PDF, PNG card).
 * Pure functions: the data comes from the session page, nothing is fetched here.
 * The figures are the ones the climber logged; nothing is computed or estimated.
 */

const LABELS = {
  fr: {
    columns: ["Date", "Séance", "Bloc", "Exercice", "Statut", "Objectif", "Série", "Répétitions", "Durée (s)", "Charge (kg)", "Réglette (mm)", "Notes"],
    block: { WARMUP: "Échauffement", MAIN: "Corps de séance", COOLDOWN: "Retour au calme" },
    status: { PENDING: "À faire", DONE: "Fait", MODIFIED: "Adapté", SKIPPED: "Passé" },
    sessionStatus: { PLANNED: "Prévue", IN_PROGRESS: "En cours", COMPLETED: "Terminée", SKIPPED: "Non faite", CANCELED: "Annulée", INTERRUPTED: "Interrompue" },
    planned: "Prévu", actual: "Réalisé", rpe: "Effort (RPE)", pain: "Douleur", minutes: "min", notes: "Notes", objective: "Objectif",
    exercises: "Exercices", sets: "séries", rest: "repos", load: "Charge", nothing: "—", generated: "Exporté depuis LEBLOND",
  },
  en: {
    columns: ["Date", "Session", "Block", "Exercise", "Status", "Target", "Set", "Reps", "Duration (s)", "Load (kg)", "Edge (mm)", "Notes"],
    block: { WARMUP: "Warm-up", MAIN: "Main", COOLDOWN: "Cool-down" },
    status: { PENDING: "To do", DONE: "Done", MODIFIED: "Adapted", SKIPPED: "Skipped" },
    sessionStatus: { PLANNED: "Planned", IN_PROGRESS: "In progress", COMPLETED: "Completed", SKIPPED: "Not done", CANCELED: "Canceled", INTERRUPTED: "Interrupted" },
    planned: "Planned", actual: "Done", rpe: "Effort (RPE)", pain: "Pain", minutes: "min", notes: "Notes", objective: "Objective",
    exercises: "Exercises", sets: "sets", rest: "rest", load: "Load", nothing: "—", generated: "Exported from LEBLOND",
  },
};
export function exportLabels(locale: Locale) { return locale === "en" ? LABELS.en : LABELS.fr; }

const isTime = (e: Pick<TrainingExercise, "modality">) => e.modality === "TIME" || e.modality === "FREE";

/** "3 × 10", "4 × 30 s", "10 min" — the planned dose. */
export function targetText(e: TrainingExercise): string {
  const dose = e.targetReps ? String(e.targetReps)
    : e.targetSeconds ? (isTime(e) ? `${Math.round(e.targetSeconds / 60)} min` : `${e.targetSeconds} s`) : "";
  return [e.targetSets && dose ? `${e.targetSets} × ${dose}` : e.targetSets ? `${e.targetSets}` : dose,
    e.restSeconds ? `(${e.restSeconds} s)` : ""].filter(Boolean).join(" ");
}

/** "10 · 8 · 8" / "10 s +8 kg 12 mm" — what was logged, set by set. */
export function doneText(e: TrainingExercise): string {
  const sets = e.sets.filter((s) => s.completed);
  return sets.map((s) => [s.reps !== null ? String(s.reps) : null,
    s.seconds !== null ? (isTime(e) ? `${Math.round(s.seconds / 60)} min` : `${s.seconds} s`) : null,
    s.loadKg !== null ? `${s.loadKg > 0 ? "+" : ""}${s.loadKg} kg` : null,
    s.edgeMm ? `${s.edgeMm} mm` : null].filter(Boolean).join(" ")).join(" · ");
}

export function sessionDate(session: TrainingSession): string {
  return (session.startedAt ?? session.scheduledDate ?? session.createdAt).slice(0, 10);
}

/** One row per logged set; an exercise without sets gets one row with its status. */
export function exportRows(session: TrainingSession, exercises: TrainingExercise[], locale: Locale): string[][] {
  const L = exportLabels(locale);
  const date = sessionDate(session);
  const rows: string[][] = [];
  for (const e of exercises) {
    const base = [date, session.title, L.block[e.block], e.name, L.status[e.status], targetText(e)];
    const sets = e.sets.filter((s) => s.completed);
    if (!sets.length) { rows.push([...base, "", "", "", "", "", e.notes]); continue; }
    for (const s of sets) {
      rows.push([...base, String(s.setIndex), s.reps === null ? "" : String(s.reps), s.seconds === null ? "" : String(s.seconds),
        s.loadKg === null ? "" : String(s.loadKg).replace(".", locale === "fr" ? "," : "."), s.edgeMm ? String(s.edgeMm) : "",
        [s.notes, e.notes].filter(Boolean).join(" — ")]);
    }
  }
  return rows;
}

/** A spreadsheet cell: quoted when needed, and never read as a formula. */
function cell(v: string): string {
  const safe = /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
  return /[";\n\r,]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}

/**
 * CSV with a BOM and ";" separators in French (what Excel expects there), ","
 * in English.
 */
export function toCsv(session: TrainingSession, exercises: TrainingExercise[], locale: Locale): string {
  const sep = locale === "fr" ? ";" : ",";
  const lines = [exportLabels(locale).columns, ...exportRows(session, exercises, locale)].map((r) => r.map(cell).join(sep));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function exportFileName(session: TrainingSession, ext: "csv" | "pdf" | "png"): string {
  const slug = session.title.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50) || "seance";
  return `leblond-${sessionDate(session)}-${slug}.${ext}`;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch]!);

/** A standalone, printable page (the browser's "Save as PDF"). Every value is escaped. */
export function printableHtml(session: TrainingSession, exercises: TrainingExercise[], locale: Locale): string {
  const L = exportLabels(locale);
  const meta = [
    L.sessionStatus[session.status], sessionDate(session),
    session.plannedMinutes ? `${L.planned} ${session.plannedMinutes} ${L.minutes}` : null,
    session.actualMinutes !== null ? `${L.actual} ${session.actualMinutes} ${L.minutes}` : null,
    session.rpe !== null ? `${L.rpe} ${session.rpe}/10` : null,
    session.pain !== null ? `${L.pain} ${session.pain}/10` : null,
  ].filter(Boolean).join(" · ");
  const rows = exercises.map((e, i) => {
    const how = (e.instructions.steps ?? []).map((s) => pick(s, locale)).filter(Boolean);
    return `<tr>
      <td class="n">${i + 1}</td>
      <td><strong>${esc(e.name)}</strong><div class="muted">${esc(L.block[e.block])}${e.instructions.load ? " · " + esc(L.load) + " : " + esc(e.instructions.load) : ""}</div>
        ${how.length ? `<ol>${how.map((s) => `<li>${esc(s)}</li>`).join("")}</ol>` : ""}</td>
      <td>${esc(targetText(e) || L.nothing)}</td>
      <td>${esc(doneText(e) || L.status[e.status])}</td>
    </tr>`;
  }).join("");
  return `<!doctype html><html lang="${locale}"><head><meta charset="utf-8"><title>${esc(exportFileName(session, "pdf").replace(/\.pdf$/, ""))}</title>
<style>
  body { font: 12px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #10233f; margin: 24px; }
  h1 { font-size: 22px; margin: 0 0 4px; } .muted { color: #5b6b82; font-size: 11px; }
  table { width: 100%; border-collapse: collapse; margin-top: 16px; } th, td { text-align: left; vertical-align: top; padding: 6px 8px; border-bottom: 1px solid #d9e1ec; }
  th { font-size: 10px; text-transform: uppercase; letter-spacing: .08em; color: #5b6b82; } td.n { width: 18px; color: #5b6b82; }
  ol { margin: 4px 0 0 16px; padding: 0; color: #33445c; } .brand { letter-spacing: .3em; font-weight: 800; color: #1f6fc5; font-size: 11px; }
  @page { margin: 14mm; } tr { break-inside: avoid; }
</style></head><body>
<div class="brand">LEBLOND</div>
<h1>${esc(session.title)}</h1>
<div class="muted">${esc(meta)}</div>
${session.objective ? `<p><strong>${esc(L.objective)} :</strong> ${esc(session.objective)}</p>` : ""}
<table><thead><tr><th></th><th>${esc(L.exercises)}</th><th>${esc(L.planned)}</th><th>${esc(L.actual)}</th></tr></thead><tbody>${rows}</tbody></table>
${session.notes ? `<p><strong>${esc(L.notes)} :</strong> ${esc(session.notes)}</p>` : ""}
<p class="muted">${esc(L.generated)}</p>
</body></html>`;
}
