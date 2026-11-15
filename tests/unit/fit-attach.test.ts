import { describe, expect, it } from "vitest";
import { planFitAttach, prefillFromActivity, readFitUploadResponse } from "@/lib/integrations/wearables/fit/attach";
import { fitAttachDictionary } from "@/lib/i18n/fit-attach";

const ACTIVITY = "11111111-1111-4111-8111-111111111111";
const SESSION = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";

describe("readFitUploadResponse", () => {
  it("reads a new import with its timing", () => {
    expect(readFitUploadResponse(true, {
      status: "inserted", activityId: ACTIVITY, suggestedSessionId: null,
      activity: { startedAt: "2026-11-14T16:02:00.000Z", durationSeconds: 6300, sessionId: null },
    })).toEqual({ kind: "ok", activityId: ACTIVITY, duplicate: false, startedAt: "2026-11-14T16:02:00.000Z", durationSeconds: 6300, linkedSessionId: null });
  });

  it("reads a duplicate already linked to a séance", () => {
    const r = readFitUploadResponse(true, {
      status: "duplicate", activityId: ACTIVITY,
      activity: { startedAt: "2026-11-14T16:02:00Z", durationSeconds: 60, sessionId: OTHER },
    });
    expect(r).toMatchObject({ kind: "ok", duplicate: true, linkedSessionId: OTHER });
  });

  it("maps the endpoint's error codes and hides anything else", () => {
    expect(readFitUploadResponse(false, { error: "not_fit" })).toEqual({ kind: "error", code: "not_fit" });
    expect(readFitUploadResponse(false, { error: "no_activity" })).toEqual({ kind: "error", code: "no_activity" });
    expect(readFitUploadResponse(false, { error: "too_large" })).toEqual({ kind: "error", code: "too_large" });
    expect(readFitUploadResponse(false, { error: "unauthenticated" })).toEqual({ kind: "error", code: "unknown" });
    expect(readFitUploadResponse(false, null)).toEqual({ kind: "error", code: "unknown" });
  });

  it("rejects an answer without usable timing (older endpoint, garbage)", () => {
    expect(readFitUploadResponse(true, { status: "inserted", activityId: ACTIVITY })).toEqual({ kind: "error", code: "unknown" });
    expect(readFitUploadResponse(true, {
      status: "inserted", activityId: ACTIVITY, activity: { startedAt: "not a date", durationSeconds: 10 },
    })).toEqual({ kind: "error", code: "unknown" });
    expect(readFitUploadResponse(true, "oops")).toEqual({ kind: "error", code: "unknown" });
  });
});

describe("planFitAttach", () => {
  const session = { id: SESSION, startedAt: "2026-11-14T16:00:00Z", endedAt: "2026-11-14T17:30:00Z" };
  const upload = { activityId: ACTIVITY, startedAt: "2026-11-14T16:05:00Z", durationSeconds: 5400, linkedSessionId: null };

  it("links straight away when the file overlaps the séance", () => {
    expect(planFitAttach(upload, session)).toBe("link");
  });

  it("asks first when the file is from another time", () => {
    expect(planFitAttach({ ...upload, startedAt: "2026-11-12T08:00:00Z" }, session)).toBe("confirm");
  });

  it("never moves a file linked to another séance, and does nothing when it is already here", () => {
    expect(planFitAttach({ ...upload, linkedSessionId: OTHER }, session)).toBe("elsewhere");
    expect(planFitAttach({ ...upload, linkedSessionId: SESSION }, session)).toBe("already");
  });
});

describe("prefillFromActivity", () => {
  it("gives the local Paris date, start time and rounded duration", () => {
    expect(prefillFromActivity({ startedAt: "2026-11-14T16:02:40Z", durationSeconds: 6290 }))
      .toEqual({ date: "2026-11-14", time: "17:02", minutes: 105 });
  });

  it("crosses midnight in Paris time and clamps the duration to the form's bounds", () => {
    expect(prefillFromActivity({ startedAt: "2026-07-01T22:30:00Z", durationSeconds: 120 }))
      .toEqual({ date: "2026-07-02", time: "00:30", minutes: 10 });
    expect(prefillFromActivity({ startedAt: "2026-07-01T08:00:00Z", durationSeconds: 15 * 3600 }).minutes).toBe(720);
  });
});

describe("fit attach strings", () => {
  it("has the same keys in French and English, none empty", () => {
    const fr = fitAttachDictionary("fr");
    const en = fitAttachDictionary("en");
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
    for (const v of [...Object.values(fr), ...Object.values(en)]) expect(v.trim()).not.toBe("");
    expect(fr.timingReplaced).toContain("{before}");
    expect(en.timingReplaced).toContain("{after}");
  });
});
