"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireViewer } from "@/lib/auth/viewer";
import { KmzError, kmlText } from "@/lib/integrations/outdoor/kmz";
import { buildTeamTopo, parseKml, type SkipReason } from "@/lib/integrations/outdoor/mymaps";

/** Below Next's 1 MB server-action body limit, with room for the form fields. */
const MAX_UPLOAD_BYTES = 900 * 1024;

export type TopoImportError = "forbidden" | "site" | "noFile" | "tooLarge" | "notKml" | "linkOnly" | "empty" | "failed";

export type TopoImportState =
  | null
  | { ok: false; error: TopoImportError }
  | {
      ok: true;
      problems: number;
      circuits: number;
      added: number;
      updated: number;
      removed: number;
      unlinked: number;
      skipped: Array<{ name: string; folder: string | null; reason: SkipReason }>;
    };

const counts = z.object({
  problems: z.number().int(),
  circuits: z.number().int(),
  added: z.number().int(),
  updated: z.number().int(),
  removed: z.number().int(),
  unlinked: z.number().int(),
});

/**
 * Admin-only: imports a topo drawn in Google My Maps (KMZ/KML export) into an
 * outdoor site outside the Boolder catalogue. The file is read here and never
 * stored; only the boulders reach the database, through
 * admin_import_leblond_topo() in the admin's own session.
 */
export async function importTeamTopo(_prev: TopoImportState, formData: FormData): Promise<TopoImportState> {
  const viewer = await requireViewer();
  if (viewer.role !== "admin") return { ok: false, error: "forbidden" };
  const gymId = z.guid().safeParse(formData.get("gymId"));
  if (!gymId.success) return { ok: false, error: "site" };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { ok: false, error: "noFile" };
  if (file.size > MAX_UPLOAD_BYTES) return { ok: false, error: "tooLarge" };

  let topo;
  try {
    const doc = parseKml(kmlText(new Uint8Array(await file.arrayBuffer())));
    if (doc.networkLinkOnly) return { ok: false, error: "linkOnly" };
    topo = buildTeamTopo(doc);
  } catch (e) {
    return { ok: false, error: e instanceof KmzError ? e.code : "notKml" };
  }
  if (topo.problems.length === 0) return { ok: false, error: "empty" };

  const creditField = z.string().trim().max(200).safeParse(formData.get("credit") ?? "");
  const credit = creditField.success && creditField.data ? creditField.data : null;
  const { data, error } = await viewer.supabase.rpc("admin_import_leblond_topo", {
    p_gym_id: gymId.data,
    p_topo: { credit, circuits: topo.circuits, problems: topo.problems, skipped: topo.skipped.length },
  });
  if (error) return { ok: false, error: error.message.includes("NOT_A_TEAM_SITE") ? "site" : "failed" };
  const result = counts.safeParse(data);
  if (!result.success) return { ok: false, error: "failed" };

  revalidatePath("/settings/admin");
  revalidatePath("/session/new");
  return { ok: true, ...result.data, skipped: topo.skipped };
}
