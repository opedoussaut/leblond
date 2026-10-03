/**
 * Which model serves Patrick. Pure function of the environment so it can be
 * unit-tested; read on the server only (via lib/env.ts).
 *
 *  - COACH_PROVIDER=openai (default): OpenAI Responses API.
 *      OPENAI_API_KEY + OPENAI_MODEL required.
 *  - COACH_PROVIDER=openai-compatible: any server exposing the OpenAI
 *      Chat Completions API — Ollama, LM Studio, llama.cpp server, vLLM —
 *      running an open-weight model. No API key is needed for a self-hosted
 *      server.
 *      COACH_BASE_URL (e.g. http://localhost:11434/v1) + COACH_MODEL required,
 *      COACH_API_KEY optional (only if your server or gateway asks for one).
 */
import type { CoachGenerationOptions } from "./provider-types";

/**
 * Optional, provider-agnostic limits (useful on free tiers with token quotas):
 *   COACH_MAX_OUTPUT_TOKENS   cap on the answer length (incl. reasoning tokens)
 *   COACH_REASONING_EFFORT    low | medium | high — only for reasoning models that support it
 *   COACH_HISTORY_CHAR_BUDGET characters of previous conversation sent with each question (default 12000)
 */
export type CoachConfig =
  | { configured: false; provider: "openai" | "openai-compatible"; missing: string[]; historyCharBudget: number }
  | {
      configured: true;
      provider: "openai";
      apiKey: string;
      model: string;
      generation: CoachGenerationOptions;
      historyCharBudget: number;
    }
  | {
      configured: true;
      provider: "openai-compatible";
      baseURL: string;
      model: string;
      apiKey: string | null;
      generation: CoachGenerationOptions;
      historyCharBudget: number;
    };

export const DEFAULT_HISTORY_CHAR_BUDGET = 12_000;

function positiveInt(v: string | undefined, min: number, max: number): number | null {
  const n = Number.parseInt(v ?? "", 10);
  return Number.isFinite(n) && n >= min && n <= max ? n : null;
}

const clean = (v: string | undefined) => {
  const s = v?.trim();
  return s ? s : undefined;
};

export function resolveCoachConfig(env: Record<string, string | undefined>): CoachConfig {
  const effort = clean(env.COACH_REASONING_EFFORT);
  const generation: CoachGenerationOptions = {
    maxOutputTokens: positiveInt(env.COACH_MAX_OUTPUT_TOKENS, 64, 32_000),
    reasoningEffort: effort === "low" || effort === "medium" || effort === "high" ? effort : null,
  };
  const historyCharBudget = positiveInt(env.COACH_HISTORY_CHAR_BUDGET, 0, 200_000) ?? DEFAULT_HISTORY_CHAR_BUDGET;
  const provider = clean(env.COACH_PROVIDER) === "openai-compatible" ? "openai-compatible" : "openai";

  if (provider === "openai") {
    const apiKey = clean(env.OPENAI_API_KEY);
    const model = clean(env.OPENAI_MODEL);
    if (!apiKey || !model) {
      return {
        configured: false,
        provider,
        missing: [!apiKey && "OPENAI_API_KEY", !model && "OPENAI_MODEL"].filter(Boolean) as string[],
        historyCharBudget,
      };
    }
    return { configured: true, provider, apiKey, model, generation, historyCharBudget };
  }

  const rawBase = clean(env.COACH_BASE_URL);
  const model = clean(env.COACH_MODEL);
  let baseURL: string | undefined;
  if (rawBase) {
    try {
      const u = new URL(rawBase);
      if (u.protocol === "http:" || u.protocol === "https:") baseURL = rawBase.replace(/\/+$/, "");
    } catch {
      baseURL = undefined;
    }
  }
  if (!baseURL || !model) {
    return {
      configured: false,
      provider,
      missing: [!baseURL && "COACH_BASE_URL", !model && "COACH_MODEL"].filter(Boolean) as string[],
      historyCharBudget,
    };
  }
  return {
    configured: true,
    provider,
    baseURL,
    model,
    apiKey: clean(env.COACH_API_KEY) ?? null,
    generation,
    historyCharBudget,
  };
}
