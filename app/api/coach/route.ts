import { z } from "zod";
import { getViewer } from "@/lib/auth/viewer";
import { assembleCoachContext } from "@/lib/coach/assemble";
import { QUICK_ACTIONS, serializeContext } from "@/lib/coach/context";
import { loadPatrickPrompt } from "@/lib/coach/prompt";
import { OpenAIResponsesCoach, type CoachMessage } from "@/lib/coach/provider";
import { coachConfig } from "@/lib/env";

export const runtime = "nodejs";
export const maxDuration = 60;

const bodySchema = z.object({
  conversationId: z.guid().nullish(),
  message: z.string().trim().min(1).max(2000),
  quickAction: z.enum(QUICK_ACTIONS).nullish(),
  sessionId: z.guid().nullish(),
  projectId: z.guid().nullish(),
});

const HISTORY_MESSAGES = 12;

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status });
}

/**
 * Patrick's chat endpoint. Authenticated, validated, rate-limited, streams
 * plain text. Private content (prompts, context, answers) is never logged;
 * only token counts and latency are recorded in ai_usage.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json(401, { error: "unauthenticated" });
  if (!viewer.active) return json(403, { error: "forbidden" });

  const config = coachConfig();
  if (!config.configured) return json(503, { error: "not_configured" });

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_request" });
  const body = parsed.data;
  const supabase = viewer.supabase;

  // Rate limit: requests in the last 24 h (ai_usage is append-only for users).
  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("timestamp", since);
  if ((count ?? 0) >= config.dailyLimit) return json(429, { error: "rate_limited", limit: config.dailyLimit });

  // Conversation (RLS: only the viewer's own).
  let conversationId = body.conversationId ?? null;
  if (conversationId) {
    const { data } = await supabase.from("coach_conversations").select("id").eq("id", conversationId).maybeSingle();
    if (!data) return json(404, { error: "not_found" });
  } else {
    const { data, error } = await supabase
      .from("coach_conversations")
      .insert({
        user_id: viewer.userId,
        title: body.message.slice(0, 80),
        session_id: body.sessionId ?? null,
        project_id: body.projectId ?? null,
      })
      .select("id")
      .single();
    if (error || !data) return json(500, { error: "server_error" });
    conversationId = data.id;
  }

  await supabase.from("coach_messages").insert({
    conversation_id: conversationId,
    user_id: viewer.userId,
    role: "user",
    content: body.message,
  });
  await supabase.from("coach_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId);
  const { data: history } = await supabase
    .from("coach_messages")
    .select("role, content")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(HISTORY_MESSAGES);
  const messages: CoachMessage[] = (history ?? []).reverse().map((m) => ({ role: m.role, content: m.content }));

  // A conversation started from a session/project keeps that focus.
  const { data: conv } = await supabase
    .from("coach_conversations")
    .select("session_id, project_id")
    .eq("id", conversationId)
    .single();

  const [instructions, context] = await Promise.all([
    loadPatrickPrompt(),
    assembleCoachContext(viewer, {
      sessionId: body.sessionId ?? conv?.session_id ?? null,
      projectId: body.projectId ?? conv?.project_id ?? null,
      quickAction: body.quickAction ?? null,
    }),
  ]);

  const coach = new OpenAIResponsesCoach(config.apiKey!, config.model!);
  const started = Date.now();
  const requestType = body.quickAction ?? "chat";
  const recordUsage = (usage: { inputTokens: number | null; outputTokens: number | null }, succeeded: boolean) =>
    supabase.from("ai_usage").insert({
      user_id: viewer.userId,
      model: coach.model,
      input_tokens: usage.inputTokens,
      output_tokens: usage.outputTokens,
      latency_ms: Date.now() - started,
      request_type: requestType,
      succeeded,
    });

  let stream;
  try {
    stream = await coach.chat({ instructions, context: serializeContext(context), messages, signal: request.signal });
  } catch {
    await recordUsage({ inputTokens: null, outputTokens: null }, false);
    return json(502, { error: "coach_unavailable" });
  }

  const encoder = new TextEncoder();
  const body$ = new ReadableStream<Uint8Array>({
    async start(controller) {
      let answer = "";
      try {
        for await (const delta of stream.text) {
          answer += delta;
          controller.enqueue(encoder.encode(delta));
        }
        const usage = await stream.done;
        await supabase.from("coach_messages").insert({
          conversation_id: conversationId,
          user_id: viewer.userId,
          role: "assistant",
          content: answer.slice(0, 20000),
        });
        await recordUsage(usage, true);
        controller.close();
      } catch {
        await recordUsage({ inputTokens: null, outputTokens: null }, false);
        controller.error(new Error("coach_stream_failed"));
      }
    },
  });

  return new Response(body$, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Conversation-Id": conversationId!,
    },
  });
}
