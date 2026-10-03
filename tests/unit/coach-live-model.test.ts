import { readFileSync } from "node:fs";
import { expect, it, vi } from "vitest";
import { computeSnapshot, type ClimbingDataset } from "@/lib/analytics";
import { buildCoachContext, serializeContext } from "@/lib/coach/context";
import { attemptsFor, daysAgo, NOW, problem, session } from "./fixtures";

vi.mock("server-only", () => ({}));
const { createCoachProvider } = await import("@/lib/coach/provider");
const { resolveCoachConfig } = await import("@/lib/coach/config");

/**
 * Opt-in smoke test against the REAL configured model provider, with synthetic
 * climbing data only. Uses the same variables as the app (COACH_PROVIDER,
 * COACH_BASE_URL, COACH_MODEL, COACH_API_KEY, OPENAI_*, COACH_MAX_OUTPUT_TOKENS,
 * COACH_REASONING_EFFORT). Enabled by COACH_LIVE_TEST=1, e.g. from the
 * "Patrick live check" GitHub Action. Prints the answer, timing and token use.
 */
it.runIf(process.env.COACH_LIVE_TEST === "1")("Patrick answers through the configured model", { timeout: 600_000 }, async () => {
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
  const config = resolveCoachConfig(process.env);
  if (!config.configured) throw new Error(`Patrick is not configured: missing ${config.missing.join(", ")}`);
  const coach = createCoachProvider(config)!;
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
  console.log("model:", coach.model, "| check: answer in French, figures 3/6 sent (50 %), no invented data");
  expect(text.length).toBeGreaterThan(20);
  expect(text).not.toContain("<think>");
});
