import { describe, expect, it } from "vitest";
import {
  formatInviteCode,
  generateInviteCode,
  INVITE_ALPHABET,
  inviteLink,
  inviteStatus,
  normalizeInviteCode,
  shareLinks,
} from "@/lib/auth/invite-code";

describe("invitation codes", () => {
  it("are 10 characters without look-alikes", () => {
    expect(INVITE_ALPHABET).toHaveLength(32);
    expect(INVITE_ALPHABET).not.toMatch(/[IO01]/);
    for (let i = 0; i < 200; i++) expect(generateInviteCode()).toMatch(/^[A-HJ-NP-Z2-9]{10}$/);
  });

  it("use every byte value evenly (low 5 bits)", () => {
    expect(generateInviteCode(() => Uint8Array.from([0, 31, 32, 255, 1, 2, 3, 4, 5, 6]))).toBe("A9A9BCDEFG");
  });

  it("differ from one call to the next", () => {
    const codes = new Set(Array.from({ length: 500 }, () => generateInviteCode()));
    expect(codes.size).toBe(500);
  });

  it("accept what people type or paste", () => {
    expect(normalizeInviteCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeInviteCode("  ABCDE FGHJK ")).toBe("ABCDEFGHJK");
    expect(normalizeInviteCode("ABCDEFGHJK")).toBe("ABCDEFGHJK");
  });

  it("refuse anything that cannot be a code", () => {
    expect(normalizeInviteCode("ABCDE-FGHJ")).toBeNull();
    expect(normalizeInviteCode("ABCDE-FGHJKL")).toBeNull();
    expect(normalizeInviteCode("OBCDE-FGHJK")).toBeNull();
    expect(normalizeInviteCode("1BCDE-FGHJK")).toBeNull();
    expect(normalizeInviteCode("")).toBeNull();
    expect(normalizeInviteCode(null)).toBeNull();
  });

  it("are shown in two groups and carried by a sign-up link", () => {
    expect(formatInviteCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
    expect(inviteLink("https://leblond.vercel.app/", "ABCDEFGHJK")).toBe("https://leblond.vercel.app/login?invite=ABCDE-FGHJK");
    expect(normalizeInviteCode(new URL(inviteLink("https://x.test", "ABCDEFGHJK")).searchParams.get("invite"))).toBe("ABCDEFGHJK");
  });
});

describe("invitation status", () => {
  const now = new Date("2026-11-09T12:00:00Z");
  const base = { redeemed_at: null, revoked_at: null, expires_at: "2026-12-09T12:00:00Z" };

  it("is pending until used, cancelled or expired", () => {
    expect(inviteStatus(base, now)).toBe("pending");
    expect(inviteStatus({ ...base, redeemed_at: "2026-11-10T08:00:00Z" }, now)).toBe("used");
    expect(inviteStatus({ ...base, revoked_at: "2026-11-10T08:00:00Z" }, now)).toBe("revoked");
    expect(inviteStatus({ ...base, expires_at: "2026-11-09T12:00:00Z" }, now)).toBe("expired");
  });

  it("says used even when the link was later cancelled or has expired", () => {
    expect(inviteStatus({ redeemed_at: "2026-11-01T08:00:00Z", revoked_at: "2026-11-02T08:00:00Z", expires_at: "2026-11-03T00:00:00Z" }, now)).toBe("used");
  });
});

describe("share links", () => {
  it("prefill WhatsApp and Telegram with the message and the link", () => {
    const { whatsapp, telegram } = shareLinks("Rejoins-moi sur LEBLOND :", "https://x.test/login?invite=ABCDE-FGHJK");
    expect(decodeURIComponent(new URL(whatsapp).searchParams.get("text") ?? "")).toBe(
      "Rejoins-moi sur LEBLOND : https://x.test/login?invite=ABCDE-FGHJK",
    );
    expect(whatsapp.startsWith("https://wa.me/?text=")).toBe(true);
    const tg = new URL(telegram);
    expect(tg.origin + tg.pathname).toBe("https://t.me/share/url");
    expect(tg.searchParams.get("url")).toBe("https://x.test/login?invite=ABCDE-FGHJK");
    expect(tg.searchParams.get("text")).toBe("Rejoins-moi sur LEBLOND :");
  });
});
