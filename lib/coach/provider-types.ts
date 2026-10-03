/** Provider-neutral types shared by the coach (no server-only imports). */
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

export interface CoachChatInput {
  instructions: string;
  context: string;
  messages: CoachMessage[];
  signal?: AbortSignal;
}

export interface CoachProvider {
  readonly model: string;
  chat(input: CoachChatInput): Promise<CoachStream>;
}

/** Optional generation limits, passed only when set (not every server supports every option). */
export interface CoachGenerationOptions {
  maxOutputTokens: number | null;
  reasoningEffort: "low" | "medium" | "high" | null;
}


