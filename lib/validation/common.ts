import { z } from "zod";

export const uuid = z.uuid();
export const email = z.email().trim().toLowerCase().max(254);
export const otpCode = z.string().trim().regex(/^\d{6,10}$/);

/** Only allow same-site relative redirects ("/home", not "//evil.com"). */
export function safeNext(next: unknown, fallback = "/home"): string {
  if (typeof next !== "string") return fallback;
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return fallback;
  return next;
}

export type ActionResult<T = undefined> = { ok: true; data?: T } | { ok: false; error: string };
