/**
 * What went wrong with the model provider, in the climber's terms. Pure, so
 * the mapping is unit-tested; the route never exposes the provider's message.
 *  - provider_busy: the provider's own rate limit (e.g. a free model's requests per minute)
 *  - provider_quota: credit or quota exhausted on the provider account (OpenRouter answers 402)
 *  - coach_unavailable: anything else (wrong key, unknown model, provider down, empty answer)
 */
export type CoachFailure = "provider_busy" | "provider_quota" | "coach_unavailable";

/** Raised inside a stream: an error chunk from the provider, or an answer with no visible text. */
export class CoachProviderError extends Error {
  constructor(
    readonly code: "stream_error" | "empty_answer",
    readonly status: number | null = null,
  ) {
    super(code);
    this.name = "CoachProviderError";
  }
}

export function classifyProviderError(e: unknown): CoachFailure {
  const status = typeof e === "object" && e !== null ? (e as { status?: unknown }).status : undefined;
  if (status === 402) return "provider_quota";
  if (status === 429 || status === 413 || status === 503) return "provider_busy";
  return "coach_unavailable";
}

/** OpenRouter sends errors that happen after the stream started as a chunk with an `error` field. */
export function streamChunkError(chunk: unknown): CoachProviderError | null {
  if (typeof chunk !== "object" || chunk === null) return null;
  const c = chunk as { error?: { code?: unknown }; choices?: Array<{ finish_reason?: unknown }> };
  if (c.error) return new CoachProviderError("stream_error", typeof c.error.code === "number" ? c.error.code : null);
  if (c.choices?.[0]?.finish_reason === "error") return new CoachProviderError("stream_error");
  return null;
}

/** OpenRouter's optional app attribution headers; other servers get none. */
export function providerHeaders(baseURL: string, appUrl: string | null): Record<string, string> {
  let host = "";
  try {
    host = new URL(baseURL).hostname;
  } catch {
    return {};
  }
  if (host !== "openrouter.ai" && !host.endsWith(".openrouter.ai")) return {};
  return { "X-Title": "LEBLOND", ...(appUrl ? { "HTTP-Referer": appUrl } : {}) };
}
