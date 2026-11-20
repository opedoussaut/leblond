"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { hintsFromActivity } from "@/lib/integrations/wearables/fit/classify";
import { fileActivity, refileActivity, type FileOutcome } from "@/lib/integrations/wearables/fit/file";
import { FILE_AS, choiceFor } from "@/lib/integrations/wearables/fit/import-flow";
import type { ActionResult } from "@/lib/validation/common";

/** One-step FIT import: the climber's answers (which kind, or a correction) and removing a training séance's file. */

const fileSchema = z.object({ activityId: z.guid(), as: z.enum(FILE_AS) }).strict();
const refileSchema = z.object({ activityId: z.guid(), as: z.enum([...FILE_AS, "PICK_VENUE"]) }).strict();

type HrefResult = ActionResult<{ href: string }>;

const toResult = (outcome: FileOutcome): HrefResult => {
  if (outcome.ok) return { ok: true, data: { href: outcome.href } };
  // Somewhere to go instead: the past-séance form to pick a venue, or the séance the file is already in.
  if ((outcome.error === "needs_venue" || outcome.error === "already") && outcome.href) return { ok: true, data: { href: outcome.href } };
  return { ok: false, error: outcome.error };
};

async function loadHints(activityId: string) {
  const viewer = await requireViewer();
  const { data } = await viewer.supabase.from("wearable_activities")
    .select("activity_type, duration_seconds, raw_metadata").eq("id", activityId).maybeSingle();
  return { viewer, hints: data ? hintsFromActivity(data) : null };
}

/** Files an imported activity the file could not classify, as the climber says. */
export async function fileFitImport(input: unknown): Promise<HrefResult> {
  const parsed = fileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { viewer, hints } = await loadHints(parsed.data.activityId);
  if (!hints) return { ok: false, error: "not_found" };
  const outcome = await fileActivity(viewer, parsed.data.activityId, choiceFor(hints, parsed.data.as), { by: "climber" });
  revalidatePath("/", "layout");
  return toResult(outcome);
}

/** "Not right?": files an import again as another kind while its séance is still empty. */
export async function refileFitImport(input: unknown): Promise<HrefResult> {
  const parsed = refileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "invalid" };
  const { viewer, hints } = await loadHints(parsed.data.activityId);
  if (!hints) return { ok: false, error: "not_found" };
  const as = parsed.data.as;
  const outcome = await refileActivity(viewer, parsed.data.activityId, as === "PICK_VENUE" ? as : choiceFor(hints, as));
  revalidatePath("/", "layout");
  return toResult(outcome);
}

/** Takes the FIT file off a training séance; the séance keeps its times and the file stays imported. */
export async function unlinkTrainingActivity(activityId: string): Promise<ActionResult> {
  const viewer = await requireViewer();
  if (!z.guid().safeParse(activityId).success) return { ok: false, error: "invalid" };
  const { error } = await viewer.supabase.rpc("link_training_activity", { p_activity_id: activityId, p_training_session_id: null });
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath("/", "layout");
  return { ok: true };
}
