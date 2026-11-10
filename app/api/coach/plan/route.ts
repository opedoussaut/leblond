import { getViewer } from "@/lib/auth/viewer";
import { assembleCoachContext } from "@/lib/coach/assemble";
import { serializeContext } from "@/lib/coach/context";
import { classifyProviderError } from "@/lib/coach/errors";
import { loadPatrickPrompt } from "@/lib/coach/prompt";
import { createCoachProvider } from "@/lib/coach/provider";
import { coachConfig, siteUrl } from "@/lib/env";
import { parseContext } from "@/lib/training/assessment-protocol";
import { healthFromContext } from "@/lib/training/health";
import { planInstructions, planRequestMessage, planRequestSchema, readProposal } from "@/lib/training/plan-proposal";

export const runtime = "nodejs";
// A whole plan is a long answer; open models on modest hardware can be slow.
export const maxDuration = 300;

function json(status: number, body: Record<string, unknown>) {
  return Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Patrick proposes a training plan (Patrick mode of the plan editor).
 * Authenticated, validated, counted in the same daily limit as the chat.
 * Patrick gets his usual bounded context plus the request; his JSON answer is
 * checked by readProposal (Atlas methods only, declared health respected,
 * weeks fitted) and returned as a DRAFT: nothing is saved here. Prompts,
 * context and answers are never logged; only token counts and latency.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer) return json(401, { error: "unauthenticated" });
  if (!viewer.active) return json(403, { error: "forbidden" });

  const config = coachConfig();
  const coach = createCoachProvider(config, { appUrl: siteUrl() });
  if (!coach) return json(503, { error: "not_configured" });

  const parsed = planRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return json(400, { error: "invalid_request" });
  const supabase = viewer.supabase;

  const since = new Date(Date.now() - 86_400_000).toISOString();
  const { count } = await supabase.from("ai_usage").select("id", { count: "exact", head: true }).gte("timestamp", since);
  if ((count ?? 0) >= config.dailyLimit) return json(429, { error: "rate_limited", limit: config.dailyLimit });

  const locale = viewer.profile.preferred_language === "en" ? "en" : "fr";
  const { data: assessment } = await supabase.from("training_assessments").select("context")
    .order("created_at", { ascending: false }).limit(1).maybeSingle();
  const health = healthFromContext(parseContext(assessment?.context ?? null));

  const [prompt, context] = await Promise.all([loadPatrickPrompt(), assembleCoachContext(viewer, {})]);
  const started = Date.now();
  const recordUsage = (usage: { inputTokens: number | null; outputTokens: number | null }, succeeded: boolean) =>
    supabase.from("ai_usage").insert({
      user_id: viewer.userId, model: coach.model, input_tokens: usage.inputTokens, output_tokens: usage.outputTokens,
      latency_ms: Date.now() - started, request_type: "plan", succeeded,
    });

  let answer = "";
  try {
    const stream = await coach.chat({
      instructions: `${prompt}\n\n${planInstructions(locale)}`,
      context: serializeContext(context),
      messages: [{ role: "user", content: planRequestMessage(parsed.data, health) }],
      signal: request.signal,
    });
    for await (const delta of stream.text) {
      answer += delta;
      if (answer.length > 60_000) break;
    }
    const usage = await stream.done.catch(() => ({ inputTokens: null, outputTokens: null }));
    const result = readProposal(answer, parsed.data, health, locale);
    await recordUsage(usage, result.ok);
    if (!result.ok) return json(502, { error: "unreadable_proposal" });
    return json(200, { plan: result.plan, adjustments: result.adjustments });
  } catch (e) {
    await recordUsage({ inputTokens: null, outputTokens: null }, false);
    const failure = classifyProviderError(e);
    console.error("plan proposal failed", { status: (e as { status?: number }).status ?? null, failure });
    return json(failure === "coach_unavailable" ? 502 : 503, { error: failure });
  }
}
