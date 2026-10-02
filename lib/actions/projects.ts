"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { PROJECT_STATUSES } from "@/lib/climbing/types";
import type { ActionResult } from "@/lib/validation/common";

export async function createProject(problemId: string): Promise<void> {
  const viewer = await requireViewer();
  if (!z.uuid().safeParse(problemId).success) return;
  const { data: existing } = await viewer.supabase.from("projects").select("id").eq("problem_id", problemId).maybeSingle();
  if (existing) redirect(`/projects/${existing.id}`);
  const { data, error } = await viewer.supabase
    .from("projects")
    .insert({ problem_id: problemId, user_id: viewer.userId })
    .select("id")
    .single();
  if (error || !data) return;
  revalidatePath("/projects");
  redirect(`/projects/${data.id}`);
}

const updateSchema = z.object({
  status: z.enum(PROJECT_STATUSES),
  notes: z.string().max(4000).nullable(),
});

export async function updateProject(projectId: string, _prev: ActionResult | null, formData: FormData): Promise<ActionResult> {
  const viewer = await requireViewer();
  const parsed = updateSchema.safeParse({
    status: formData.get("status"),
    notes: (formData.get("notes") as string | null)?.trim() || null,
  });
  if (!z.uuid().safeParse(projectId).success || !parsed.success) return { ok: false, error: "invalid" };
  const { status, notes } = parsed.data;
  const { error } = await viewer.supabase
    .from("projects")
    .update({ status, notes, completed_at: status === "ACTIVE" ? null : new Date().toISOString() })
    .eq("id", projectId);
  if (error) return { ok: false, error: "unknownError" };
  revalidatePath(`/projects/${projectId}`);
  revalidatePath("/projects");
  return { ok: true };
}
