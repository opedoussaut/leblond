/**
 * Closed-beta invitation codes: 10 characters from an alphabet without
 * look-alikes (no I, O, 0, 1), so a code retyped from a message still works.
 * 32 symbols ^ 10 ≈ 10^15 codes: far too many to guess. The database checks
 * the same pattern (beta_invites.code) and redeem_beta_invite() normalises
 * input the same way.
 */
export const INVITE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export const INVITE_CODE_LENGTH = 10;
const CODE_PATTERN = /^[A-HJ-NP-Z2-9]{10}$/;

type RandomBytes = (n: number) => Uint8Array;
const cryptoBytes: RandomBytes = (n) => crypto.getRandomValues(new Uint8Array(n));

export function generateInviteCode(random: RandomBytes = cryptoBytes): string {
  // 256 is a multiple of 32, so keeping the low 5 bits leaves every symbol equally likely.
  return Array.from(random(INVITE_CODE_LENGTH), (b) => INVITE_ALPHABET[b & 31]).join("");
}

/** Accepts what people type or paste ("abcde-fghjk", spaces…); null when it cannot be a code. */
export function normalizeInviteCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const code = input.toUpperCase().replace(/[^A-Z0-9]/g, "");
  return CODE_PATTERN.test(code) ? code : null;
}

/** "ABCDE-FGHJK": easier to read in a message. */
export function formatInviteCode(code: string): string {
  return code.length === INVITE_CODE_LENGTH ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

export function inviteLink(siteUrl: string, code: string): string {
  return `${siteUrl.replace(/\/+$/, "")}/login?invite=${formatInviteCode(code)}`;
}

export type InviteStatus = "pending" | "used" | "expired" | "revoked";

export function inviteStatus(
  invite: { redeemed_at: string | null; revoked_at: string | null; expires_at: string },
  now: Date = new Date(),
): InviteStatus {
  if (invite.redeemed_at) return "used";
  if (invite.revoked_at) return "revoked";
  return new Date(invite.expires_at).getTime() <= now.getTime() ? "expired" : "pending";
}

/** Ready-made share links: they open the app with the message filled in; the admin still sends it. */
export function shareLinks(message: string, url: string) {
  return {
    whatsapp: `https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`,
    telegram: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message)}`,
  };
}
