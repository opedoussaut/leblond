import { describe, expect, it } from "vitest";
import { exportFileName, exportRows, printableHtml, toCsv } from "@/lib/training/session-export";
import type { TrainingExercise, TrainingSession } from "@/lib/training/sessions";

const session: TrainingSession = {
  id: "s", title: "Haut et bas · genoux ménagés", objective: "Tirage", methodId: null, planId: null, planSessionIndex: null,
  calendarEntryId: null, climbingSessionId: null, venue: "", status: "COMPLETED", scheduledDate: "2026-11-10", scheduledTime: null,
  plannedMinutes: 90, startedAt: "2026-11-10T17:00:00Z", pausedAt: null, pausedSeconds: 0, completedAt: "2026-11-10T18:30:00Z",
  actualMinutes: 88, currentIndex: 0, rpe: 7, pain: 2, painNotes: "", notes: "Bonne séance", createdAt: "2026-11-10T16:00:00Z",
};
const ex = (over: Partial<TrainingExercise>): TrainingExercise => ({
  id: "e", position: 0, block: "MAIN", methodId: null, name: "No-hang", instructions: {}, modality: "HOLD",
  targetSets: 6, targetReps: null, targetSeconds: 10, restSeconds: 60, intensity: "", status: "DONE", rpe: null, notes: "", sets: [], ...over,
});
const exercises = [
  ex({ sets: [
    { id: "a", setIndex: 1, reps: null, seconds: 10, loadKg: 8.5, completed: true, notes: "", edgeMm: 12 },
    { id: "b", setIndex: 2, reps: null, seconds: 10, loadKg: 8.5, completed: true, notes: "", edgeMm: 12 },
  ] }),
  ex({ id: "f", name: "=HYPERLINK(\"x\")", modality: "REPS", targetSets: 3, targetReps: 8, targetSeconds: null, status: "SKIPPED", notes: "genou; trop tôt" }),
];

describe("session export", () => {
  it("writes one row per logged set and one for an exercise without sets", () => {
    const rows = exportRows(session, exercises, "fr");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(["2026-11-10", session.title, "Corps de séance", "No-hang", "Fait", "6 × 10 s (60 s)", "1", "", "10", "8,5", "12", ""]);
    expect(rows[2].slice(4, 7)).toEqual(["Passé", "3 × 8 (60 s)", ""]);
  });

  it("produces a spreadsheet-safe CSV (BOM, separators, quotes, no formulas)", () => {
    const csv = toCsv(session, exercises, "fr");
    expect(csv.startsWith("\uFEFFDate;Séance;")).toBe(true);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain(`"genou; trop tôt"`);
    expect(toCsv(session, exercises, "en").split("\r\n")[0]).toBe("\uFEFFDate,Session,Block,Exercise,Status,Target,Set,Reps,Duration (s),Load (kg),Edge (mm),Notes");
  });

  it("escapes everything in the printable page", () => {
    const html = printableHtml({ ...session, title: "<script>alert(1)</script>" }, exercises, "fr");
    expect(html).not.toContain("<script>alert");
    expect(html).toContain("&lt;script&gt;");
    expect(html).toContain("10 s +8.5 kg 12 mm · 10 s +8.5 kg 12 mm");
    expect(html).toContain("RPE");
  });

  it("names files by date and title", () => {
    expect(exportFileName(session, "png")).toBe("leblond-2026-11-10-haut-et-bas-genoux-menages.png");
    expect(exportFileName({ ...session, title: "!!!" }, "csv")).toBe("leblond-2026-11-10-seance.csv");
  });
});
