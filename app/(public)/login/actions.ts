"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { siteUrl } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import { publicSupabaseEnv } from "@/lib/supabase/public-env";
import { email as emailSchema, otpCode, safeNext } from "@/lib/validation/common";

export type LoginState =
  | { step: "email"; error?: "invalidEmail" | "rateLimited" | "unknownError" | "notConfigured" }
  | { step: "code"; email: string; error?: "invalidCode" | "rateLimited" | "unknownError" };

export type PasswordState = {
  error?: "invalidCredentials" | "invalidEmail" | "weakPassword" | "passwordMismatch" |
    "rateLimited" | "unknownError" | "notConfigured" | "invalidName";
  sentConfirmation?: boolean;
};
const passwordSchema = z.string().min(8).max(72);
const nameSchema = z.string().trim().min(1).max(60);

export async function signInPassword(_state: PasswordState, formData: FormData): Promise<PasswordState> {
  if (!publicSupabaseEnv()) return { error: "notConfigured" };
  const address = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  if (!address.success) return { error: "invalidEmail" };
  if (!password.success) return { error: "weakPassword" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email: address.data, password: password.data });
  if (error) return { error: error.status === 429 ? "rateLimited" : "invalidCredentials" };
  redirect(safeNext(formData.get("next")));
}

export async function registerWithEmail(_state: PasswordState, formData: FormData): Promise<PasswordState> {
  if (!publicSupabaseEnv()) return { error: "notConfigured" };
  const address = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const name = nameSchema.safeParse(formData.get("displayName"));
  if (!address.success) return { error: "invalidEmail" };
  if (!name.success) return { error: "invalidName" };
  if (!password.success) return { error: "weakPassword" };
  if (password.data !== formData.get("confirmPassword")) return { error: "passwordMismatch" };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: address.data, password: password.data,
    options: {
      data: { display_name: name.data },
      emailRedirectTo: siteUrl() + "/auth/callback?next=" + encodeURIComponent(safeNext(formData.get("next"))),
    },
  });
  if (error) {
    if (error.status === 429) return { error: "rateLimited" };
    if (/password/i.test(error.message)) return { error: "weakPassword" };
    return { error: "unknownError" };
  }
  // On projects with email confirmation disabled, the session is immediate.
  if (data.session) redirect("/onboarding");
  // Never reveal whether the email already belongs to an account.
  return { sentConfirmation: true };
}

export async function sendCode(_prev: LoginState, formData: FormData): Promise<LoginState> {
  if (!publicSupabaseEnv()) return { step: "email", error: "notConfigured" };
  const address = emailSchema.safeParse(formData.get("email"));
  if (!address.success) return { step: "email", error: "invalidEmail" };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: address.data,
    options: {
      shouldCreateUser: true,
      emailRedirectTo: siteUrl() + "/auth/callback?next=" + encodeURIComponent(safeNext(formData.get("next"))),
    },
  });
  if (error) return { step: "email", error: error.status === 429 ? "rateLimited" : "unknownError" };
  return { step: "code", email: address.data };
}

export async function verifyCode(prev: LoginState, formData: FormData): Promise<LoginState> {
  const address = prev.step === "code" ? prev.email : "";
  const token = otpCode.safeParse(formData.get("code"));
  if (!token.success) return { step: "code", email: address, error: "invalidCode" };
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email: address, token: token.data, type: "email" });
  if (error) return { step: "code", email: address, error: error.status === 429 ? "rateLimited" : "invalidCode" };
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
