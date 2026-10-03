import "server-only";
import OpenAI from "openai";
/**
 * Coach provider abstraction: the rest of the app never talks to a model SDK
 * directly, so the provider can be swapped without touching routes or UI.
 */
import type { CoachConfig } from "./config";
import type { CoachChatInput, CoachGenerationOptions, CoachProvider, CoachStream, CoachUsage } from "./provider-types";
export type { CoachMessage, CoachProvider, CoachStream, CoachUsage } from "./provider-types";

const NO_LIMITS: CoachGenerationOptions = { maxOutputTokens: null, reasoningEffort: null };

/** OpenAI Responses API implementation (server-side only, streaming). */
export class OpenAIResponsesCoach implements CoachProvider {
  private client: OpenAI;
  constructor(
    apiKey: string,
    readonly model: string,
    options: { fetch?: typeof fetch; baseURL?: string; generation?: CoachGenerationOptions } = {},
  ) {
    this.client = new OpenAI({ apiKey, fetch: options.fetch, baseURL: options.baseURL });
    this.generation = options.generation ?? NO_LIMITS;
  }
  private generation: CoachGenerationOptions;

  async chat({ instructions, context, messages, signal }: CoachChatInput): Promise<CoachStream> {
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
        ...(this.generation.maxOutputTokens ? { max_output_tokens: this.generation.maxOutputTokens } : {}),
        ...(this.generation.reasoningEffort ? { reasoning: { effort: this.generation.reasoningEffort } } : {}),
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

/**
 * Removes `<think>…</think>` blocks from a text stream. Some open reasoning
 * models emit their chain of thought inline in the answer; the climber should
 * only see the answer. Handles tags split across chunks.
 */
export function createThinkFilter() {
  const OPEN = "<think>";
  const CLOSE = "</think>";
  let buffer = "";
  let inside = false;
  return {
    push(chunk: string): string {
      buffer += chunk;
      let out = "";
      for (;;) {
        const tag = inside ? CLOSE : OPEN;
        const idx = buffer.indexOf(tag);
        if (idx !== -1) {
          if (!inside) out += buffer.slice(0, idx);
          buffer = buffer.slice(idx + tag.length);
          inside = !inside;
          continue;
        }
        // Keep a possible partial tag at the end for the next chunk.
        let keep = 0;
        for (let k = Math.min(tag.length - 1, buffer.length); k > 0; k--) {
          if (tag.startsWith(buffer.slice(-k))) {
            keep = k;
            break;
          }
        }
        if (!inside) out += buffer.slice(0, buffer.length - keep);
        buffer = buffer.slice(buffer.length - keep);
        return out;
      }
    },
    flush(): string {
      const rest = inside ? "" : buffer;
      buffer = "";
      return rest;
    },
  };
}

/**
 * Open-weight models through any OpenAI-compatible Chat Completions server
 * (Ollama, LM Studio, llama.cpp server, vLLM). Instructions and evidence go
 * in ONE system message: several chat templates of open models reject or
 * ignore a second system message.
 */
export class ChatCompletionsCoach implements CoachProvider {
  private client: OpenAI;
  constructor(
    readonly model: string,
    options: { baseURL: string; apiKey?: string | null; fetch?: typeof fetch; generation?: CoachGenerationOptions },
  ) {
    // The SDK requires a non-empty key; self-hosted servers ignore it.
    this.client = new OpenAI({ apiKey: options.apiKey || "not-needed", baseURL: options.baseURL, fetch: options.fetch });
    this.generation = options.generation ?? NO_LIMITS;
  }
  private generation: CoachGenerationOptions;

  async chat({ instructions, context, messages, signal }: CoachChatInput): Promise<CoachStream> {
    const stream = await this.client.chat.completions.create(
      {
        model: this.model,
        messages: [
          { role: "system", content: `${instructions}\n\n---\n\n${context}` },
          ...messages.map((m) => ({ role: m.role, content: m.content })),
        ],
        stream: true,
        stream_options: { include_usage: true },
        ...(this.generation.maxOutputTokens ? { max_tokens: this.generation.maxOutputTokens } : {}),
        ...(this.generation.reasoningEffort ? { reasoning_effort: this.generation.reasoningEffort } : {}),
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
      const think = createThinkFilter();
      let usage: CoachUsage = { inputTokens: null, outputTokens: null };
      try {
        for await (const chunk of stream) {
          // Only the answer (`content`) is shown; separate reasoning fields are ignored.
          const delta = chunk.choices?.[0]?.delta?.content;
          if (delta) {
            const visible = think.push(delta);
            if (visible) yield visible;
          }
          if (chunk.usage) {
            usage = { inputTokens: chunk.usage.prompt_tokens ?? null, outputTokens: chunk.usage.completion_tokens ?? null };
          }
        }
        const rest = think.flush();
        if (rest) yield rest;
        resolveDone(usage);
      } catch (e) {
        rejectDone(e);
        throw e;
      }
    }

    return { text: text(), done };
  }
}

/** Builds the configured provider (see lib/coach/config.ts). */
export function createCoachProvider(
  config: CoachConfig,
  options: { fetch?: typeof fetch } = {},
): CoachProvider | null {
  if (!config.configured) return null;
  if (config.provider === "openai") {
    return new OpenAIResponsesCoach(config.apiKey, config.model, { ...options, generation: config.generation });
  }
  return new ChatCompletionsCoach(config.model, {
    baseURL: config.baseURL,
    apiKey: config.apiKey,
    fetch: options.fetch,
    generation: config.generation,
  });
}
