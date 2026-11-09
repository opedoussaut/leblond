import { describe, expect, it } from "vitest";
import { isNotInvitedError } from "@/lib/auth/closed-beta";

describe("closed-beta refusal from Supabase Auth", () => {
  it("recognises the trigger refusal", () => {
    // Message returned by the local Supabase stack for signUp and signInWithOtp
    // (and, for Google, the error_description query parameter once decoded).
    expect(isNotInvitedError({ message: "Database error saving new user" })).toBe(true);
  });
  it("leaves other auth errors alone", () => {
    expect(isNotInvitedError({ message: "User already registered" })).toBe(false);
    expect(isNotInvitedError({ message: "Password should be at least 8 characters." })).toBe(false);
    expect(isNotInvitedError({ message: "Email rate limit exceeded" })).toBe(false);
    expect(isNotInvitedError(null)).toBe(false);
    expect(isNotInvitedError({ message: null })).toBe(false);
  });
});
