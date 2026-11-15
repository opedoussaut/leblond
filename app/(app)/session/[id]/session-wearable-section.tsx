import type { loadSessionView } from "@/lib/data/session";
import { loadActivityCandidates } from "@/lib/data/session-wearable";
import type { ServerSupabase } from "@/lib/supabase/server";
import { SessionWearable } from "./session-wearable";

type View = NonNullable<Awaited<ReturnType<typeof loadSessionView>>>;

/** The watch card for any finished climbing séance (route, board, edit page): loads its link candidates itself. */
export async function SessionWearableSection({ supabase, view }: { supabase: ServerSupabase; view: View }) {
  const candidates = await loadActivityCandidates(supabase, view.session);
  return <SessionWearable session={view.session} activity={view.activity} candidates={candidates} />;
}
