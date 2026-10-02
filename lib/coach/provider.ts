import "server-only";
import OpenAI from "openai";

/**
 * Coach provider abstraction: the rest of the app never talks to a model SDK
 * directly, so the provider can be swapped without touching routes or UI.
 */
export interface CoachMessage {
  role: "user" | "assistant";
  content: string;
}

export interface CoachUsage {
  inputTokens: number | null;
  outputTokens: number | null;
}

export interface CoachStream {
  /** Text deltas as they arrive. */
  text: AsyncIterable<string>;
  /** Resolves when the stream completes (usage may be null if not reported). */
  done: Promise<CoachUsage>;
}

export interface CoachProvider {
  readonly model: string;
  chat(input: { instructions: string; context: string; messages: CoachMessage[]; signal?: AbortSignal }): Promise<CoachStream>;
}

/** OpenAI Responses API implementation (server-side only, streaming). */
export class OpenAIResponsesCoach implements CoachProvider {
  private client: OpenAI;
  constructor(
    apiKey: string,
    readonly model: string,
    options: { fetch?: typeof fetch; baseURL?: string } = {},
  ) {
    this.client = new OpenAI({ apiKey, fetch: options.fetch, baseURL: options.baseURL });
  }

  async chat({ instructions, context, messages, signal }: Parameters<CoachProvider["chat"]>[0]): Promise<CoachStream> {
    const stream = await this.client.responses.create(
      {
        model: this.model,
        instructions,
        input: [
          // The evidence is sent as a developer message so it is clearly not the climber speaking.
          { role: "developer", content: context },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        // Do not keep conversations on the provider side; LEBLOND stores its own history.
        store: false,
      },
      { signal },
    );

    let resolveDone!: (u: CoachUsage) => void;
    let rejectDone!: (e: unknown) => void;
    const done = new Promise<CoachUsage>((res, rej) => {
      resolveDone = res;
      rejectDone = rej;
    });

    async function* text() {
      let usage: CoachUsage = { inputTokens: null, outputTokens: null };
      try {
        for await (const event of stream) {
          if (event.type === "response.output_text.delta") {
            yield event.delta;
          } else if (event.type === "response.completed") {
            usage = {
              inputTokens: event.response.usage?.input_tokens ?? null,
              outputTokens: event.response.usage?.output_tokens ?? null,
            };
          } else if (event.type === "response.failed" || event.type === "error") {
            throw new Error("coach_stream_failed");
          }
        }
        resolveDone(usage);
      } catch (e) {
        rejectDone(e);
        throw e;
      }
    }

    return { text: text(), done };
  }
}
