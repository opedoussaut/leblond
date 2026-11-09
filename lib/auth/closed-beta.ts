/**
 * Supabase Auth reports a refusal by the closed-beta trigger
 * (`enforce_beta_whitelist` on auth.users) only as a generic database error
 * while saving the new user: HTTP 500, no error code. Any other failure at
 * that point is rare enough that "not invited" is still the right message.
 */
export function isNotInvitedError(error: { message?: string | null } | null | undefined): boolean {
  return /database error saving new user/i.test(error?.message ?? "");
}
