import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const { OpenAIResponsesCoach } = await import("@/lib/coach/provider");

function sse(events: Array<Record<string, unknown>>): Response {
  const body = events.map((e) => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  return new Response(body, { status: 200, headers: { "content-type": "text/event-stream" } });
}

describe("OpenAI Responses coach provider", () => {
  it("streams text deltas and reports usage, sending context as a developer message", async () => {
    let sent: Record<string, unknown> | null = null;
    const fakeFetch = (async (_url: string, init: RequestInit) => {
      sent = JSON.parse(String(init.body));
      return sse([
        { type: "response.output_text.delta", delta: "Salut ", item_id: "i", output_index: 0, content_index: 0, sequence_number: 1 },
        { type: "response.output_text.delta", delta: "Alex.", item_id: "i", output_index: 0, content_index: 0, sequence_number: 2 },
        { type: "response.completed", sequence_number: 3, response: { id: "r", usage: { input_tokens: 120, output_tokens: 8 } } },
      ]);
    }) as unknown as typeof fetch;

    const coach = new OpenAIResponsesCoach("sk-test", "test-model", { fetch: fakeFetch, baseURL: "https://example.invalid/v1" });
    const stream = await coach.chat({
      instructions: "You are Patrick",
      context: "LEBLOND_CONTEXT = {}",
      messages: [{ role: "user", content: "Hello" }],
    });
    let text = "";
    for await (const d of stream.text) text += d;
    expect(text).toBe("Salut Alex.");
    await expect(stream.done).resolves.toEqual({ inputTokens: 120, outputTokens: 8 });
    expect(sent).toMatchObject({
      model: "test-model",
      instructions: "You are Patrick",
      stream: true,
      store: false,
      input: [
        { role: "developer", content: "LEBLOND_CONTEXT = {}" },
        { role: "user", content: "Hello" },
      ],
    });
  });
});
