"use server";

import { redirect } from "next/navigation";
import { siteUrl } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { email as emailSchema, otpCode, safeNext } from "@/lib/validation/common";

export type LoginState =
  | { step: "email"; error?: "invalidEmail" | "notInvited" | "rateLimited" | "unknownError" | "notConfigured" }
  | { step: "code"; email: string; error?: "invalidCode" | "rateLimited" | "unknownError" };

/** Whitelist check with the service role (the whitelist is not readable anonymously). */
async function isInvited(address: string): Promise<boolean | null> {
  const admin = createAdminClient();
  if (!admin) return null; // unknown → rely on the database trigger
  const { data, error } = await admin.from("beta_users").select("active").eq("email", address).maybeSingle();
  if (error) return null;
  return data?.active === true;
}

export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!publicSupabaseEnv()) return { step: "email", error: "notConfigured" };
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { step: "email", error: "invalidEmail" };
  const address = parsed.data;

  const invited = await isInvited(address);
  if (invited === false) return { step: "email", error: "notInvited" };

  const supabase = await createClient();
  const next = safeNext(formData.get("next"));
  const { error } = await supabase.auth.signInWithOtp({
    email: address,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: `${siteUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) {
    if (error.status === 429) return { step: "email", error: "rateLimited" };
    // The whitelist trigger rejects uninvited sign-ups at the database level.
    if (/database error|not invited|closed beta/i.test(error.message)) return { step: "email", error: "notInvited" };
    return { step: "email", error: "unknownError" };
  }
  return { step: "code", email: address };
}

export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const address = prev.step === "code" ? prev.email : "";
  const token = otpCode.safeParse(formData.get("code"));
  if (!token.success) return { step: "code", email: address, error: "invalidCode" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: address, token: token.data, type: "email" });
  if (error) {
    return { step: "code", email: address, error: error.status === 429 ? "rateLimited" : "invalidCode" };
  }
  redirect(safeNext(formData.get("next")));
}

export async function resetLogin(): Promise<LoginState> {
  return { step: "email" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
