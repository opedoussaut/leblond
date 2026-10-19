"use client";

import { useActionState, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { fmt } from "@/lib/i18n";
import { getBrowserClient } from "@/lib/supabase/client";
import { registerWithEmail, resetLogin, sendCode, signInPassword, verifyCode, type LoginState } from "./actions";

async function codeReducer(prev: LoginState, formData: FormData): Promise<LoginState> {
  if (formData.get("intent") === "reset") return resetLogin();
  return prev.step === "email" ? sendCode(prev, formData) : verifyCode(prev, formData);
}

function PasswordSignIn({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(signInPassword, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="sign-in-email">{t.auth.emailLabel}</Label>
        <Input id="sign-in-email" name="email" type="email" autoComplete="email" required placeholder={t.auth.emailPlaceholder} />
      </div>
      <div>
        <Label htmlFor="sign-in-password">{t.auth.passwordLabel}</Label>
        <Input id="sign-in-password" name="password" type="password" autoComplete="current-password" minLength={8} required />
      </div>
      {state.error ? <Notice tone="error">{t.auth[state.error]}</Notice> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t.auth.verifying : t.auth.signInPassword}
      </Button>
    </form>
  );
}

function RegisterForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(registerWithEmail, {});
  if (state.sentConfirmation) return (
    <Notice tone="ok">{t.auth.registrationSent}</Notice>
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="register-name">{t.auth.displayName}</Label>
        <Input id="register-name" name="displayName" required maxLength={60} autoComplete="nickname" placeholder={t.auth.namePlaceholder} />
      </div>
      <div>
        <Label htmlFor="register-email">{t.auth.emailLabel}</Label>
        <Input id="register-email" name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
      </div>
      <div>
        <Label htmlFor="register-password">{t.auth.passwordLabel}</Label>
        <Input id="register-password" name="password" type="password" autoComplete="new-password" minLength={8} maxLength={72} required />
        <p className="mt-1 text-xs text-ink-3">{t.auth.passwordHint}</p>
      </div>
      <div>
        <Label htmlFor="register-confirm">{t.auth.confirmPassword}</Label>
        <Input id="register-confirm" name="confirmPassword" type="password" autoComplete="new-password" minLength={8} required />
      </div>
      {state.error ? <Notice tone="error">{t.auth[state.error]}</Notice> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t.auth.sending : t.auth.createAccount}
      </Button>
    </form>
  );
}

function EmailCodeForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(codeReducer, { step: "email" } as LoginState);
  if (state.step === "email") return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <div>
        <Label htmlFor="otp-email">{t.auth.emailLabel}</Label>
        <Input id="otp-email" name="email" type="email" autoComplete="email" placeholder={t.auth.emailPlaceholder} required />
      </div>
      {state.error ? <Notice tone="error">{t.auth[state.error]}</Notice> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t.auth.sending : t.auth.sendCode}
      </Button>
    </form>
  );
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Notice tone="ok">{fmt(t.auth.codeSent, { email: state.email })}</Notice>
      <div>
        <Label htmlFor="otp-code">{t.auth.codeLabel}</Label>
        <Input id="otp-code" name="code" inputMode="numeric" autoComplete="one-time-code"
          pattern="[0-9]*" maxLength={10} className="text-center text-2xl tracking-[0.4em]" required />
      </div>
      {state.error ? <Notice tone="error">{t.auth[state.error]}</Notice> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>{t.auth.verify}</Button>
      <Button type="submit" name="intent" value="reset" variant="ghost" className="w-full" formNoValidate>
        {t.auth.useAnotherEmail}
      </Button>
    </form>
  );
}

export function LoginForm({ next, googleEnabled }: { next: string; googleEnabled: boolean }) {
  const { t } = useI18n();
  const [mode, setMode] = useState<"signin" | "register" | "code">("signin");
  const [oauthError, setOauthError] = useState(false);
  const [oauthPending, setOauthPending] = useState(false);

  async function startGoogle() {
    setOauthError(false);
    setOauthPending(true);
    try {
      const { error } = await getBrowserClient().auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin + "/auth/callback?next=" + encodeURIComponent(next) },
      });
      if (error) setOauthError(true);
    } catch {
      setOauthError(true);
    } finally {
      setOauthPending(false);
    }
  }

  return (
    <div className="space-y-5">
      <div role="tablist" aria-label={t.auth.authMode} className="flex rounded-xl border border-line bg-surface-2 p-1">
        {(["signin", "register"] as const).map(item => (
          <button key={item} type="button" role="tab" aria-selected={mode === item}
            onClick={() => setMode(item)} className={"flex-1 rounded-lg px-3 py-2.5 text-sm font-bold " +
              (mode === item ? "bg-surface text-ink shadow-sm" : "text-ink-2")}>
            {item === "signin" ? t.auth.signInPassword : t.auth.registerTab}
          </button>
        ))}
      </div>
      {mode === "signin" ? <PasswordSignIn next={next} /> : null}
      {mode === "register" ? <RegisterForm next={next} /> : null}
      {mode === "code" ? <EmailCodeForm next={next} /> : null}
      <div className="flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-line"/>{t.auth.or}<span className="h-px flex-1 bg-line"/></div>
      <button type="button" onClick={startGoogle} disabled={!googleEnabled || oauthPending}
        className="flex min-h-12 w-full items-center justify-center gap-3 rounded-xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-ink hover:bg-surface-2 disabled:cursor-not-allowed disabled:opacity-55">
        <span aria-hidden="true" className="font-black text-lg">G</span>
        {t.auth.continueGoogle}
      </button>
      {!googleEnabled ? <p className="text-center text-xs text-ink-3">{t.auth.googlePending}</p> : null}
      {oauthError ? <Notice tone="error">{t.auth.unknownError}</Notice> : null}
      <button type="button" className="w-full text-center text-sm font-semibold text-accent underline underline-offset-4"
        onClick={() => setMode(mode === "code" ? "signin" : "code")}>
        {mode === "code" ? t.auth.backToPassword : t.auth.useEmailCode}
      </button>
      <p className="text-center text-xs leading-relaxed text-ink-3">{t.auth.privacyNotice}</p>
    </div>
  );
}
