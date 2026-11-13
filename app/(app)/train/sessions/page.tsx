import { redirect } from "next/navigation";

/**
 * Old address of the training séances list. Training séances now live in the
 * Journal (Séances), and a new one starts from Nouvelle séance; links that
 * pre-select a template or a method keep working.
 */
export default async function TrainingSessionsRedirect({ searchParams }: PageProps<"/train/sessions">) {
  const sp = await searchParams;
  const keep = new URLSearchParams({ kind: "train" });
  if (typeof sp.coach === "string") keep.set("coach", sp.coach);
  if (typeof sp.method === "string") keep.set("method", sp.method);
  redirect(keep.size > 1 ? `/session/new?${keep}` : "/session?type=training");
}
