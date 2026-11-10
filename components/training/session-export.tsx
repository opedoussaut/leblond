"use client";

import { useState } from "react";
import type { Locale } from "@/lib/i18n";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import {
  doneText, exportFileName, exportLabels, printableHtml, sessionDate, targetText, toCsv,
} from "@/lib/training/session-export";
import type { TrainingExercise, TrainingSession } from "@/lib/training/sessions";
import { buttonClass } from "@/components/ui/button";

function download(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Wraps `text` to `max` px wide with the context's current font. */
function wrap(ctx: CanvasRenderingContext2D, text: string, max: number): string[] {
  const lines: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/)) {
    const next = line ? line + " " + word : word;
    if (ctx.measureText(next).width > max && line) { lines.push(line); line = word; } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

/** A shareable image of the session: title, figures, every exercise planned vs done. */
function drawCard(session: TrainingSession, exercises: TrainingExercise[], locale: Locale): HTMLCanvasElement {
  const L = exportLabels(locale);
  const W = 1080, P = 64, inner = W - 2 * P;
  const font = (size: number, weight = 400) => `${weight} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const meta = [L.sessionStatus[session.status], sessionDate(session),
    session.actualMinutes !== null ? `${session.actualMinutes} ${L.minutes}` : session.plannedMinutes ? `${session.plannedMinutes} ${L.minutes}` : null,
    session.rpe !== null ? `RPE ${session.rpe}/10` : null].filter(Boolean).join("  ·  ");

  // Two passes: measure, then draw on a canvas of the right height.
  const paint = (ctx: CanvasRenderingContext2D, draw: boolean): number => {
    let y = P;
    const text = (s: string, size: number, weight: number, color: string, x = P, max = inner, lh = 1.3) => {
      ctx.font = font(size, weight);
      for (const l of wrap(ctx, s, max)) { if (draw) { ctx.fillStyle = color; ctx.fillText(l, x, y + size); } y += size * lh; }
    };
    text("L E B L O N D", 22, 800, "#1f6fc5");
    y += 12;
    text(session.title, 52, 900, "#10233f", P, inner, 1.15);
    y += 6;
    text(meta, 26, 600, "#5b6b82");
    y += 28;
    exercises.forEach((e, i) => {
      if (draw) { ctx.fillStyle = "#d9e1ec"; ctx.fillRect(P, y, inner, 2); }
      y += 22;
      const top = y;
      text(`${i + 1}`, 26, 800, "#1f6fc5", P, 40);
      y = top;
      text(e.name, 30, 800, "#10233f", P + 48, inner - 48);
      const done = doneText(e);
      text(`${L.planned} : ${targetText(e) || L.nothing}`, 24, 500, "#5b6b82", P + 48, inner - 48);
      text(`${L.actual} : ${done || L.status[e.status]}`, 24, 700, done ? "#10233f" : "#8a97aa", P + 48, inner - 48);
      y += 8;
    });
    y += 24;
    text(L.generated, 20, 600, "#8a97aa");
    return y + P - 24;
  };

  const probe = document.createElement("canvas").getContext("2d")!;
  const H = Math.min(16000, Math.ceil(paint(probe, false)));
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#f5f8fc"; ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = "#ffffff"; ctx.fillRect(24, 24, W - 48, H - 48);
  paint(ctx, true);
  return canvas;
}

/** Export buttons: PNG (image to share), PDF (print → save as PDF), CSV (spreadsheet). */
export function SessionExport({ locale, session, exercises }: { locale: Locale; session: TrainingSession; exercises: TrainingExercise[] }) {
  const t = trainingSessionDictionary(locale);
  const [error, setError] = useState(false);

  function csv() {
    download(new Blob([toCsv(session, exercises, locale)], { type: "text/csv;charset=utf-8" }), exportFileName(session, "csv"));
  }
  function png() {
    setError(false);
    drawCard(session, exercises, locale).toBlob((blob) => {
      if (blob) download(blob, exportFileName(session, "png")); else setError(true);
    }, "image/png");
  }
  function pdf() {
    setError(false);
    // A clean standalone page in a hidden frame; the print dialog offers "Save as PDF".
    const frame = document.createElement("iframe");
    frame.setAttribute("aria-hidden", "true");
    frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
    document.body.appendChild(frame);
    const doc = frame.contentDocument;
    if (!doc || !frame.contentWindow) { frame.remove(); setError(true); return; }
    doc.open(); doc.write(printableHtml(session, exercises, locale)); doc.close();
    frame.contentWindow.focus();
    frame.contentWindow.print();
    window.setTimeout(() => frame.remove(), 60_000);
  }

  return <section aria-labelledby="export-heading" className="rounded-2xl border border-line bg-surface p-4">
    <h2 id="export-heading" className="text-sm font-extrabold">{t.exportTitle}</h2>
    <p className="mt-1 text-xs text-ink-3">{t.exportHint}</p>
    <div className="leblond-actions mt-3">
      <button type="button" onClick={png} className={buttonClass("secondary", "sm")}>{t.exportPng}</button>
      <button type="button" onClick={pdf} className={buttonClass("secondary", "sm")}>{t.exportPdf}</button>
      <button type="button" onClick={csv} className={buttonClass("secondary", "sm")}>{t.exportCsv}</button>
    </div>
    {error ? <p role="alert" className="mt-2 text-sm font-semibold text-danger">{t.exportError}</p> : null}
  </section>;
}
