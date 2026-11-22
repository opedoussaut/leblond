/**
 * What went wrong with the model provider, in the climber's terms. Pure, so
 * the mapping is unit-tested; the route never exposes the provider's message.
 *  - provider_busy: the provider's own rate limit (e.g. a free model's requests per minute)
 *  - provider_quota: credit or quota exhausted on the provider account (OpenRouter answers 402)
 *  - empty_answer: the model answered nothing visible (a reasoning model that spent its whole budget thinking)
 *  - coach_unavailable: anything else (wrong key, unknown model, provider down)
 */
export type CoachFailure = "provider_busy" | "provider_quota" | "empty_answer" | "coach_unavailable";

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
  if (e instanceof CoachProviderError && e.code === "empty_answer") return "empty_answer";
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

export function isOpenRouter(baseURL: string): boolean {
  let host = "";
  try {
    host = new URL(baseURL).hostname;
  } catch {
    return false;
  }
  return host === "openrouter.ai" || host.endsWith(".openrouter.ai");
}

/**
 * How the reasoning effort is sent. OpenRouter reads `reasoning: { effort }`
 * (its docs do not list a top-level `reasoning_effort`); other OpenAI-compatible
 * servers take `reasoning_effort`.
 */
export function reasoningParams(baseURL: string, effort: "low" | "medium" | "high" | null): Record<string, unknown> {
  if (!effort) return {};
  return isOpenRouter(baseURL) ? { reasoning: { effort } } : { reasoning_effort: effort };
}

/** OpenRouter's optional app attribution headers; other servers get none. */
export function providerHeaders(baseURL: string, appUrl: string | null): Record<string, string> {
  if (!isOpenRouter(baseURL)) return {};
  return { "X-Title": "LEBLOND", ...(appUrl ? { "HTTP-Referer": appUrl } : {}) };
}
