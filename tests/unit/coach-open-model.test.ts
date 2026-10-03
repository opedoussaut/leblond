import { describe, expect, it, vi } from "vitest";
import { resolveCoachConfig } from "@/lib/coach/config";

vi.mock("server-only", () => ({}));
const { ChatCompletionsCoach, createCoachProvider, createThinkFilter, OpenAIResponsesCoach } = await import("@/lib/coach/provider");

describe("coach provider configuration", () => {
  it("defaults to OpenAI and reports what is missing", () => {
    expect(resolveCoachConfig({})).toMatchObject({ configured: false, provider: "openai", missing: ["OPENAI_API_KEY", "OPENAI_MODEL"] });
    expect(resolveCoachConfig({ OPENAI_API_KEY: "sk", OPENAI_MODEL: "m" })).toMatchObject({ configured: true, provider: "openai" });
  });

  it("accepts an open-model server without any API key", () => {
    expect(
      resolveCoachConfig({ COACH_PROVIDER: "openai-compatible", COACH_BASE_URL: "http://localhost:11434/v1/", COACH_MODEL: "qwen3:8b" }),
    ).toMatchObject({ configured: true, provider: "openai-compatible", baseURL: "http://localhost:11434/v1", model: "qwen3:8b", apiKey: null });
  });

  it("rejects a missing or malformed base URL", () => {
    expect(resolveCoachConfig({ COACH_PROVIDER: "openai-compatible", COACH_MODEL: "m" })).toMatchObject({
      configured: false,
      missing: ["COACH_BASE_URL"],
    });
    expect(resolveCoachConfig({ COACH_PROVIDER: "openai-compatible", COACH_BASE_URL: "file:///etc", COACH_MODEL: "m" })).toMatchObject({
      configured: false,
    });
  });

  it("builds the matching provider", () => {
    expect(createCoachProvider(resolveCoachConfig({}))).toBeNull();
    expect(createCoachProvider(resolveCoachConfig({ OPENAI_API_KEY: "sk", OPENAI_MODEL: "m" }))).toBeInstanceOf(OpenAIResponsesCoach);
    expect(
      createCoachProvider(resolveCoachConfig({ COACH_PROVIDER: "openai-compatible", COACH_BASE_URL: "http://x/v1", COACH_MODEL: "m" })),
    ).toBeInstanceOf(ChatCompletionsCoach);
  });
});

describe("<think> filter", () => {
  it("removes reasoning blocks, including tags split across chunks", () => {
    const f = createThinkFilter();
    const out = ["Hel", "lo <thi", "nk>secret plan</th", "ink> world", "<think>more", "</think>!"].map((c) => f.push(c)).join("") + f.flush();
    expect(out).toBe("Hello  world!");
  });

  it("passes text without tags through unchanged", () => {
    const f = createThinkFilter();
    expect(f.push("a < b and c > d") + f.flush()).toBe("a < b and c > d");
  });
});

describe("Chat Completions coach", () => {
  it("streams content, sends one system message, reports usage, sends no real key", async () => {
    let sent: Record<string, unknown> | null = null;
    let auth: string | null = null;
    const chunk = (o: Record<string, unknown>) => `data: ${JSON.stringify({ id: "c", object: "chat.completion.chunk", created: 1, model: "m", ...o })}\n\n`;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      auth = new Headers(init.headers).get("authorization");
      const body =
        chunk({ choices: [{ index: 0, delta: { role: "assistant", content: "<think>x</think>Salut " }, finish_reason: null }] }) +
        chunk({ choices: [{ index: 0, delta: { content: "Alex." }, finish_reason: "stop" }] }) +
        chunk({ choices: [], usage: { prompt_tokens: 900, completion_tokens: 5, total_tokens: 905 } }) +
        "data: [DONE]\n\n";
      return new Response(body, { headers: { "content-type": "text/event-stream" } });
    }) as unknown as typeof fetch;

    const coach = new ChatCompletionsCoach("qwen3:8b", { baseURL: "http://localhost:11434/v1", fetch: fakeFetch });
    const stream = await coach.chat({ instructions: "You are Patrick", context: "LEBLOND_CONTEXT = {}", messages: [{ role: "user", content: "Hi" }] });
    let text = "";
    for await (const d of stream.text) text += d;
    expect(text).toBe("Salut Alex.");
    await expect(stream.done).resolves.toEqual({ inputTokens: 900, outputTokens: 5 });
    expect(sent).toMatchObject({
      model: "qwen3:8b",
      stream: true,
      messages: [
        { role: "system", content: "You are Patrick\n\n---\n\nLEBLOND_CONTEXT = {}" },
        { role: "user", content: "Hi" },
      ],
    });
    expect(auth).toBe("Bearer not-needed");
  });
});
