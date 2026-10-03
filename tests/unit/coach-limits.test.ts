import { describe, expect, it, vi } from "vitest";
import { DEFAULT_HISTORY_CHAR_BUDGET, resolveCoachConfig } from "@/lib/coach/config";
import { trimHistory } from "@/lib/coach/history";

vi.mock("server-only", () => ({}));
const { ChatCompletionsCoach } = await import("@/lib/coach/provider");

const groq = {
  COACH_PROVIDER: "openai-compatible",
  COACH_BASE_URL: "https://api.groq.com/openai/v1",
  COACH_MODEL: "openai/gpt-oss-120b",
  COACH_API_KEY: "gsk_test",
};

describe("generation limits from the environment", () => {
  it("are off by default", () => {
    const c = resolveCoachConfig(groq);
    expect(c).toMatchObject({ generation: { maxOutputTokens: null, reasoningEffort: null }, historyCharBudget: DEFAULT_HISTORY_CHAR_BUDGET });
  });

  it("parse valid values and ignore invalid ones", () => {
    expect(
      resolveCoachConfig({ ...groq, COACH_MAX_OUTPUT_TOKENS: "1500", COACH_REASONING_EFFORT: "low", COACH_HISTORY_CHAR_BUDGET: "6000" }),
    ).toMatchObject({ generation: { maxOutputTokens: 1500, reasoningEffort: "low" }, historyCharBudget: 6000 });
    expect(
      resolveCoachConfig({ ...groq, COACH_MAX_OUTPUT_TOKENS: "-3", COACH_REASONING_EFFORT: "max", COACH_HISTORY_CHAR_BUDGET: "abc" }),
    ).toMatchObject({ generation: { maxOutputTokens: null, reasoningEffort: null }, historyCharBudget: DEFAULT_HISTORY_CHAR_BUDGET });
  });
});

describe("history trimming", () => {
  const m = (role: "user" | "assistant", n: number) => ({ role, content: "x".repeat(n) });

  it("keeps the most recent turns within the budget and always the question", () => {
    const out = trimHistory([m("user", 100), m("assistant", 500), m("user", 50), m("assistant", 300), m("user", 40)], 400);
    // 40 + 300 + 50 = 390 ≤ 400; adding the 500-char answer would exceed it.
    expect(out.map((x) => [x.role, x.content.length])).toEqual([
      ["user", 50],
      ["assistant", 300],
      ["user", 40],
    ]);
  });

  it("never starts with an assistant message", () => {
    const out = trimHistory([m("user", 10), m("assistant", 30), m("user", 10)], 45);
    expect(out[0].role).toBe("user");
    expect(out).toHaveLength(1);
  });

  it("keeps the whole conversation when it fits", () => {
    const msgs = [m("user", 10), m("assistant", 10), m("user", 10)];
    expect(trimHistory(msgs, 1000)).toEqual(msgs);
  });

  it("truncates an over-long question instead of dropping it", () => {
    expect(trimHistory([m("user", 5000)], 100)[0].content).toHaveLength(100);
  });
});

describe("limits are sent to the server only when set", () => {
  async function sentBody(generation?: { maxOutputTokens: number | null; reasoningEffort: "low" | "medium" | "high" | null }) {
    let sent: Record<string, unknown> = {};
    const fakeFetch = (async (_u: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return new Response("data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
    }) as unknown as typeof fetch;
    const coach = new ChatCompletionsCoach("m", { baseURL: "http://x/v1", fetch: fakeFetch, generation });
    const s = await coach.chat({ instructions: "i", context: "c", messages: [{ role: "user", content: "q" }] });
    for await (const _ of s.text) void _;
    return sent;
  }

  it("omits them by default", async () => {
    const body = await sentBody();
    expect(body).not.toHaveProperty("max_tokens");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it("includes them when configured", async () => {
    expect(await sentBody({ maxOutputTokens: 1500, reasoningEffort: "low" })).toMatchObject({ max_tokens: 1500, reasoning_effort: "low" });
  });
});
