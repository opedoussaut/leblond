import { describe, expect, it, vi } from "vitest";
import { CoachProviderError, classifyProviderError, providerHeaders, streamChunkError } from "@/lib/coach/errors";

vi.mock("server-only", () => ({}));
const { ChatCompletionsCoach } = await import("@/lib/coach/provider");

const chunk = (o: Record<string, unknown>) =>
  `data: ${JSON.stringify({ id: "gen-1", object: "chat.completion.chunk", created: 1, model: "m", ...o })}\n\n`;

function fakeServer(body: string, status = 200, seen: { headers?: Headers; body?: Record<string, unknown> } = {}) {
  return (async (_url: string, init: RequestInit) => {
    seen.headers = new Headers(init.headers);
    seen.body = JSON.parse(String(init.body));
    return status === 200
      ? new Response(body, { headers: { "content-type": "text/event-stream" } })
      : new Response(body, { status, headers: { "content-type": "application/json" } });
  }) as unknown as typeof fetch;
}

async function drain(coach: InstanceType<typeof ChatCompletionsCoach>) {
  const stream = await coach.chat({ instructions: "Patrick", context: "{}", messages: [{ role: "user", content: "Salut" }] });
  let text = "";
  const done = stream.done.catch((e: unknown) => e);
  try {
    for await (const d of stream.text) text += d;
  } catch (e) {
    return { text, error: e, done: await done };
  }
  return { text, error: null, done: await done };
}

describe("OpenRouter through the OpenAI-compatible provider", () => {
  const baseURL = "https://openrouter.ai/api/v1";

  it("streams an answer, with the app attribution headers and the configured token cap", async () => {
    const seen: { headers?: Headers; body?: Record<string, unknown> } = {};
    const body =
      chunk({ choices: [{ index: 0, delta: { role: "assistant", content: "Repose-toi " }, finish_reason: null }] }) +
      chunk({ choices: [{ index: 0, delta: { content: "demain." }, finish_reason: "stop" }] }) +
      ": OPENROUTER PROCESSING\n\n" +
      chunk({ choices: [], usage: { prompt_tokens: 1200, completion_tokens: 4, total_tokens: 1204 } }) +
      "data: [DONE]\n\n";
    const coach = new ChatCompletionsCoach("deepseek/deepseek-chat-v3.1:free", {
      baseURL, apiKey: "sk-or-test", fetch: fakeServer(body, 200, seen),
      generation: { maxOutputTokens: 800, reasoningEffort: null }, appUrl: "https://leblond.vercel.app",
    });
    const r = await drain(coach);
    expect(r.error).toBeNull();
    expect(r.text).toBe("Repose-toi demain.");
    expect(r.done).toEqual({ inputTokens: 1200, outputTokens: 4 });
    expect(seen.headers?.get("x-title")).toBe("LEBLOND");
    expect(seen.headers?.get("http-referer")).toBe("https://leblond.vercel.app");
    expect(seen.headers?.get("authorization")).toBe("Bearer sk-or-test");
    expect(seen.body).toMatchObject({ model: "deepseek/deepseek-chat-v3.1:free", stream: true, max_tokens: 800 });
  });

  it("stops on an error chunk sent after the stream started", async () => {
    const body =
      chunk({ choices: [{ index: 0, delta: { content: "Je " }, finish_reason: null }] }) +
      chunk({ error: { code: 502, message: "Provider disconnected" }, choices: [{ index: 0, delta: { content: "" }, finish_reason: "error" }] }) +
      "data: [DONE]\n\n";
    const r = await drain(new ChatCompletionsCoach("m", { baseURL, apiKey: "k", fetch: fakeServer(body) }));
    // The SDK itself raises on an `error` chunk; the partial text is kept, the stream fails.
    expect(r.text).toBe("Je ");
    expect(r.error).toBeInstanceOf(Error);
    expect(r.done).toBeInstanceOf(Error);
  });

  it("stops on a chunk that only says finish_reason=error", async () => {
    const body =
      chunk({ choices: [{ index: 0, delta: { content: "Je " }, finish_reason: null }] }) +
      chunk({ choices: [{ index: 0, delta: { content: "" }, finish_reason: "error" }] }) +
      "data: [DONE]\n\n";
    const r = await drain(new ChatCompletionsCoach("m", { baseURL, apiKey: "k", fetch: fakeServer(body) }));
    expect(r.text).toBe("Je ");
    expect(r.error).toBeInstanceOf(CoachProviderError);
    expect((r.error as CoachProviderError).code).toBe("stream_error");
  });

  it("treats an answer made only of reasoning as a failure, not as an empty reply", async () => {
    const body =
      chunk({ choices: [{ index: 0, delta: { content: "<think>long plan…" }, finish_reason: null }] }) +
      chunk({ choices: [{ index: 0, delta: { content: "" }, finish_reason: "length" }] }) +
      "data: [DONE]\n\n";
    const r = await drain(new ChatCompletionsCoach("m", { baseURL, apiKey: "k", fetch: fakeServer(body) }));
    expect(r.text).toBe("");
    expect((r.error as CoachProviderError).code).toBe("empty_answer");
  });

  it("surfaces the HTTP status of a refused request (402 credits, 429 rate limit)", async () => {
    for (const [status, expected] of [[402, "provider_quota"], [429, "provider_busy"], [401, "coach_unavailable"], [404, "coach_unavailable"]] as const) {
      const coach = new ChatCompletionsCoach("m", {
        baseURL, apiKey: "k", fetch: fakeServer(JSON.stringify({ error: { code: status, message: "no" } }), status),
      });
      const failure = await coach
        .chat({ instructions: "Patrick", context: "{}", messages: [{ role: "user", content: "Salut" }] })
        .then(() => null, (e: unknown) => classifyProviderError(e));
      expect(failure).toBe(expected);
    }
  });
});

describe("provider error helpers", () => {
  it("maps statuses to what the climber is told", () => {
    expect(classifyProviderError({ status: 402 })).toBe("provider_quota");
    expect(classifyProviderError({ status: 429 })).toBe("provider_busy");
    expect(classifyProviderError({ status: 503 })).toBe("provider_busy");
    expect(classifyProviderError(new Error("network"))).toBe("coach_unavailable");
    expect(classifyProviderError(null)).toBe("coach_unavailable");
  });

  it("reads error chunks only when present", () => {
    expect(streamChunkError({ choices: [{ finish_reason: "stop" }] })).toBeNull();
    expect(streamChunkError({ error: { code: "server_error" } })?.status).toBeNull();
    expect(streamChunkError({ choices: [{ finish_reason: "error" }] })?.code).toBe("stream_error");
  });

  it("adds attribution headers for OpenRouter only", () => {
    expect(providerHeaders("https://openrouter.ai/api/v1", null)).toEqual({ "X-Title": "LEBLOND" });
    expect(providerHeaders("http://localhost:11434/v1", "https://leblond.vercel.app")).toEqual({});
    expect(providerHeaders("https://openrouter.ai.evil.example/v1", null)).toEqual({});
    expect(providerHeaders("not a url", null)).toEqual({});
  });
});
