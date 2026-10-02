import "server-only";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const PROMPT_VERSION = "patrick-v1";
let cached: string | null = null;

/** Patrick's system prompt, versioned in /prompts (traced into the coach route bundle). */
export async function loadPatrickPrompt(): Promise<string> {
  if (cached) return cached;
  cached = await readFile(path.join(process.cwd(), "prompts", `${PROMPT_VERSION}.md`), "utf8");
  return cached;
}
