import { describe, expect, it } from "vitest";
import {
  coachExerciseRows, coachSessionFromRow, coachSessionSchema, coachContent, musclewikiUrl, type CoachSessionInput,
} from "@/lib/training/coach-sessions";
import { createTrainingSessionSchema } from "@/lib/training/sessions";

const session: CoachSessionInput = {
  slug: "upper-lower-90",
  title: "Haut et bas · 90 min",
  objective: "Force de tirage, genou prudent",
  minutes: 90,
  place: "HOME",
  exercises: [
    { block: "WARMUP", name: "Écartés à l’élastique", sets: 2, reps: 15, restAfterSeconds: 90, musclewiki: "band-pull-apart" },
    { block: "MAIN", name: "Tractions lestées", sets: 4, reps: 5, restSeconds: 150, load: "poids du corps", methodId: "strength-conditioning",
      steps: ["Gainage serré", "Descente contrôlée"], safety: "Stop si douleur au coude", musclewiki: "weighted-pull-ups" },
    { block: "COOLDOWN", name: "Squat profond tenu", modality: "HOLD", sets: 3, seconds: 30 },
  ],
  sources: [{ label: "MuscleWiki", url: "https://musclewiki.com" }],
};

describe("coach sessions", () => {
  it("accepts a complete session and fills defaults", () => {
    const s = coachSessionSchema.parse(session);
    expect(s.exercises[0].modality).toBe("REPS");
    expect(s.notes).toBe("");
    expect(s.shared).toBe(false);
  });

  it("refuses unverified MuscleWiki pages, unknown methods, http sources and bad slugs", () => {
    const bad = (patch: object) => coachSessionSchema.safeParse({ ...session, ...patch }).success;
    expect(bad({ exercises: [{ block: "MAIN", name: "X", musclewiki: "made-up-page" }] })).toBe(false);
    expect(bad({ exercises: [{ block: "MAIN", name: "X", methodId: "secret" }] })).toBe(false);
    expect(bad({ sources: [{ label: "X", url: "http://example.com" }] })).toBe(false);
    expect(bad({ slug: "Bad Slug" })).toBe(false);
    expect(bad({ exercises: [] })).toBe(false);
    expect(bad({ minutes: 300 })).toBe(false);
    expect(bad({ extra: 1 })).toBe(false);
  });

  it("builds MuscleWiki links only for verified pages", () => {
    expect(musclewikiUrl("wall-sit")).toBe("https://musclewiki.com/exercise/wall-sit");
    expect(musclewikiUrl("javascript:alert(1)")).toBeNull();
    expect(musclewikiUrl(undefined)).toBeNull();
  });

  it("round-trips through a stored row and skips rows that no longer parse", () => {
    const s = coachSessionSchema.parse(session);
    const row = { id: "r", user_id: "u", shared: true, slug: s.slug, title: s.title, objective: s.objective, minutes: s.minutes, place: s.place,
      author: "CLAUDE", content: coachContent(s), updated_at: "2026-11-10T10:00:00Z" };
    expect(coachSessionFromRow(row)?.exercises).toHaveLength(3);
    expect(coachSessionFromRow(row)).toMatchObject({ ownerId: "u", shared: true });
    expect(coachSessionFromRow({ ...row, content: { exercises: [{ name: "no block" }] } })).toBeNull();
    expect(coachSessionFromRow({ ...row, content: null })).toBeNull();
  });

  it("maps exercises to session rows with a snapshot", () => {
    const rows = coachExerciseRows(coachSessionSchema.parse(session));
    expect(rows.map((r) => r.position)).toEqual([0, 1, 2]);
    expect(rows[1]).toMatchObject({ block: "MAIN", method_id: "strength-conditioning", target_sets: 4, target_reps: 5, rest_seconds: 150 });
    expect(rows[1].instructions).toMatchObject({ key: "coach:upper-lower-90:1", load: "poids du corps", musclewiki: "weighted-pull-ups" });
    expect(rows[1].instructions.steps[0]).toEqual({ fr: "Gainage serré", en: "Gainage serré" });
    expect(rows[2]).toMatchObject({ modality: "HOLD", target_seconds: 30, target_reps: null });
    expect(rows[0].instructions.restAfter).toBe(90);
    expect(rows[1].instructions.restAfter).toBeUndefined();
  });

  it("can be started as a training session", () => {
    expect(createTrainingSessionSchema.safeParse({
      source: "coach", coachSessionId: "6f9619ff-8b86-4d11-b42d-00c04fc964ff", date: "2026-11-11", time: "", startNow: false,
    }).success).toBe(true);
  });
});
