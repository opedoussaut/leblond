import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { computeSnapshot, type ClimbingDataset } from "@/lib/analytics";
import { buildCoachContext, serializeContext } from "@/lib/coach/context";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

vi.mock("server-only", () => ({}));
const { ChatCompletionsCoach } = await import("@/lib/coach/provider");

/**
 * Opt-in smoke test against a REAL OpenAI-compatible server (e.g. Ollama):
 *   COACH_LIVE_TEST_BASE_URL=http://127.0.0.1:11434/v1 COACH_LIVE_TEST_MODEL=qwen3:8b npx vitest run tests/unit/coach-live-model.test.ts --silent=false
 * Prints the answer and the figures it should contain. Skipped otherwise.
 */
it.runIf(process.env.COACH_LIVE_TEST_BASE_URL && process.env.COACH_LIVE_TEST_MODEL)("Patrick answers through a real open model", { timeout: 600_000 }, async () => {
  const ark = Array.from({ length: 6 }, (_, i) => ({ ...problem(i < 3 ? "RED" : "BLUE"), gymId: "ark", tags: ["slab" as const] }));
  const data: ClimbingDataset = {
    gyms: [{ id: "ark", name: "Arkose Démo", brand: "ARKOSE", gradingSystem: "ARKOSE_COLOR" }],
    problems: ark,
    attempts: ark.flatMap((p, i) => attemptsFor(p, i % 2 ? ["ATTEMPT", "TOP"] : ["ATTEMPT", "ATTEMPT"], daysAgo(2), "s1")),
    sessions: [session("s1", daysAgo(2), 95)],
  };
  const target = { grade: "7A", system: "FONT" as const };
  const ctx = buildCoachContext({
    climber: { name: "Alex", language: "fr", target },
    snapshot30: computeSnapshot(data, target, NOW, 30),
    snapshot90: computeSnapshot(data, target, NOW, 90),
    recentSessions: [],
    activeProjects: [],
    now: NOW,
  });
  const coach = new ChatCompletionsCoach(process.env.COACH_LIVE_TEST_MODEL!, {
    baseURL: process.env.COACH_LIVE_TEST_BASE_URL!,
    apiKey: process.env.COACH_LIVE_TEST_API_KEY,
  });
  const started = Date.now();
  const stream = await coach.chat({
    instructions: readFileSync("prompts/patrick-v1.md", "utf8"),
    context: serializeContext(ctx),
    messages: [{ role: "user", content: "Combien de blocs ai-je réussis sur les 30 derniers jours, et quel est mon taux de réussite ? " }],
  });
  let text = "";
  for await (const d of stream.text) text += d;
  const usage = await stream.done;
  console.log(`\n--- ${Date.now() - started} ms, usage ${JSON.stringify(usage)}, context ${serializeContext(ctx).length} chars ---\n${text}\n---`);
  console.log("expected from context:", JSON.stringify(ctx.last30Days.sendRate), "tops", ctx.last30Days.tops);
  expect(text.length).toBeGreaterThan(20);
  expect(text).not.toContain("<think>");
});
