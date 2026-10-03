import type { CoachMessage } from "./provider-types";

/**
 * Keeps the most recent conversation turns that fit in `maxChars`
 * (roughly 4 characters per token for French/English text). The latest
 * message — the climber's question — is always kept, truncated if needed.
 * Free model tiers limit tokens per minute, so an unbounded history would
 * make long conversations fail.
 */
export function trimHistory(messages: CoachMessage[], maxChars: number): CoachMessage[] {
  if (messages.length === 0) return [];
  const last = messages[messages.length - 1];
  const kept: CoachMessage[] = [{ ...last, content: last.content.slice(0, Math.max(1, maxChars)) }];
  let used = kept[0].content.length;
  for (let i = messages.length - 2; i >= 0; i--) {
    const m = messages[i];
    if (used + m.content.length > maxChars) break;
    kept.unshift(m);
    used += m.content.length;
  }
  // A conversation sent to the model should start with the climber, not with Patrick.
  while (kept.length > 1 && kept[0].role === "assistant") kept.shift();
  return kept;
}
