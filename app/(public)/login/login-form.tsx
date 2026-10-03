"use client";

import { useActionState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/field";
import { fmt } from "@/lib/i18n";
import { resetLogin, sendCode, verifyCode, type LoginState } from "./actions";

async function loginReducer(prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");
  if (intent === "reset") return resetLogin();
  return prev.step === "email" ? sendCode(prev, formData) : verifyCode(prev, formData);
}

export function LoginForm({ next }: { next: string }) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(loginReducer, { step: "email" } as LoginState);

  if (state.step === "email") {
    return (
      <form action={action} className="space-y-4">
        <input type="hidden" name="next" value={next} />
        <div>
          <Label htmlFor="email">{t.auth.emailLabel}</Label>
          <Input
            id="email"
            name="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder={t.auth.emailPlaceholder}
            required
          />
        </div>
        {state.error ? <Notice tone="error">{t.auth[state.error]}</Notice> : null}
        <Button type="submit" size="lg" className="w-full" disabled={pending}>
          {pending ? t.auth.sending : t.auth.sendCode}
        </Button>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <Notice tone="ok">{fmt(t.auth.codeSent, { email: state.email })}</Notice>
      <div>
        <Label htmlFor="code">{t.auth.codeLabel}</Label>
        <Input
          id="code"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]*"
          maxLength={10}
          className="text-center text-2xl tracking-[0.4em]"
          required
        />
      </div>
      {state.error ? <Notice tone="error">{t.auth[state.error]}</Notice> : null}
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? t.auth.verifying : t.auth.verify}
      </Button>
      <Button type="submit" name="intent" value="reset" variant="ghost" className="w-full" formNoValidate>
        {t.auth.useAnotherEmail}
      </Button>
    </form>
  );
}
