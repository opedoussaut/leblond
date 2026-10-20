import { requireViewer } from "@/lib/auth/viewer";
import { QUICK_ACTIONS, type QuickAction } from "@/lib/coach/context";
import { coachConfig } from "@/lib/env";
import { gradeLabel } from "@/lib/grading/labels";
import { getI18n } from "@/lib/i18n/server";
import { PatrickChat } from "./patrick-chat";

export const metadata = { title: "Patrick" };

export default async function PatrickPage({ searchParams }: PageProps<"/patrick">) {
  const viewer = await requireViewer();
  const { t } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  const str = (v: string | string[] | undefined) => (typeof v === "string" ? v : null);
  const uuidRe = /^[0-9a-f-]{36}$/i;

  const conversationId = str(sp.c) && uuidRe.test(str(sp.c)!) ? str(sp.c) : null;
  const sessionId = str(sp.session) && uuidRe.test(str(sp.session)!) ? str(sp.session) : null;
  const projectId = str(sp.project) && uuidRe.test(str(sp.project)!) ? str(sp.project) : null;
  const routeProjectId = str(sp.routeProject) && uuidRe.test(str(sp.routeProject)!) ? str(sp.routeProject) : null;
  const q = str(sp.q);
  const initialAction = q && (QUICK_ACTIONS as readonly string[]).includes(q) ? (q as QuickAction) : null;

  const [{ data: conversations }, { data: messages }, { data: projects }, { data: routeProjects }] = await Promise.all([
    viewer.supabase.from("coach_conversations").select("id, title, updated_at").order("updated_at", { ascending: false }).limit(10),
    conversationId
      ? viewer.supabase.from("coach_messages").select("id, role, content").eq("conversation_id", conversationId).order("created_at")
      : Promise.resolve({ data: [] as Array<{ id: string; role: "user" | "assistant"; content: string }> }),
    viewer.supabase
      .from("projects")
      .select("id, problems(name, native_grade, native_grade_system)")
      .eq("status", "ACTIVE")
      .order("started_at", { ascending: false }),
    viewer.supabase.from("route_projects").select("id, route_name, grade").eq("status", "ACTIVE").order("started_at", { ascending: false }),
  ]);

  return (
    <PatrickChat
      configured={coachConfig().configured}
      dailyLimit={coachConfig().dailyLimit}
      conversations={conversations ?? []}
      conversationId={conversationId}
      initialMessages={messages ?? []}
      projects={(projects ?? []).map((p) => ({
        id: p.id,
        label: p.problems
          ? `${p.problems.name || t.problem.unnamed} · ${gradeLabel(t, p.problems.native_grade_system, p.problems.native_grade)}`
          : t.problem.unnamed,
      })).concat((routeProjects ?? []).map((p) => ({ id: "route:" + p.id, label: `${p.route_name} · ${p.grade}` })))}
      focus={{ sessionId, projectId, routeProjectId, initialAction }}
    />
  );
}
