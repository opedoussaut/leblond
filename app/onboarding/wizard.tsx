"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { PatrickAvatar } from "@/components/brand/wordmark";
import { GradeSelect } from "@/components/climbing/grade-select";
import { GymPicker } from "@/components/climbing/gym-picker";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { ChoiceChips, Input, Label } from "@/components/ui/field";
import { completeOnboarding } from "@/lib/actions/profile";
import type { GradeSystem } from "@/lib/climbing/types";
import { fmt, getDictionary, type Locale } from "@/lib/i18n";
import type { Tables } from "@/lib/supabase/database.types";

const TOTAL = 7;

export function OnboardingWizard({
  profile,
  gyms,
  favouriteIds,
}: {
  profile: { displayName: string; language: Locale; targetGrade: string; targetSystem: GradeSystem };
  gyms: Tables<"gyms">[];
  favouriteIds: string[];
}) {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [name, setName] = useState(profile.displayName);
  const [language, setLanguage] = useState<Locale>(profile.language);
  const [levelSystem, setLevelSystem] = useState<GradeSystem>("FONT");
  const [level, setLevel] = useState("");
  const [targetSystem, setTargetSystem] = useState<GradeSystem>(profile.targetSystem);
  const [targetGrade, setTargetGrade] = useState(profile.targetGrade);
  const [selectedGyms, setSelectedGyms] = useState<string[]>(favouriteIds);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  // Preview the chosen language immediately.
  const t = getDictionary(language);

  const next = () => setStep((s) => Math.min(TOTAL, s + 1));
  const prev = () => setStep((s) => Math.max(1, s - 1));

  const finish = (destination: "/session/new" | "/home") => {
    setError(null);
    start(async () => {
      const res = await completeOnboarding({
        displayName: name,
        language,
        levelSystem: level ? levelSystem : null,
        level: level || null,
        targetSystem,
        targetGrade,
        favouriteGymIds: selectedGyms,
      });
      if (res.ok) router.replace(destination);
      else setError(t.common.unknownError);
    });
  };

  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-[0.14em] text-ink-3">
        {fmt(t.onboarding.stepOf, { n: step, total: TOTAL })}
      </p>
      <div className="mt-1 h-1 rounded-full bg-surface-2" aria-hidden>
        <div className="h-1 rounded-full bg-accent transition-all" style={{ width: `${(step / TOTAL) * 100}%` }} />
      </div>

      <div className="mt-8 space-y-5">
        {step === 1 ? (
          <>
            <h1 className="text-2xl font-black">{t.onboarding.whoTitle}</h1>
            <div>
              <Label htmlFor="ob-name">{t.onboarding.displayName}</Label>
              <Input id="ob-name" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} autoFocus />
            </div>
          </>
        ) : null}

        {step === 2 ? (
          <>
            <h1 className="text-2xl font-black">{t.onboarding.languageTitle}</h1>
            <ChoiceChips<Locale>
              name="language"
              legend={t.onboarding.languageTitle}
              value={language}
              onChange={setLanguage}
              options={[
                { value: "fr", label: t.settings.languageFr },
                { value: "en", label: t.settings.languageEn },
              ]}
            />
          </>
        ) : null}

        {step === 3 ? (
          <>
            <h1 className="text-2xl font-black">{t.onboarding.levelTitle}</h1>
            <p className="text-sm text-ink-2">{t.onboarding.levelHelp}</p>
            <GradeSelect
              idPrefix="ob-level"
              system={levelSystem}
              grade={level}
              allowEmpty
              emptyLabel={t.onboarding.levelUnknown}
              onChange={(s, g) => {
                setLevelSystem(s);
                setLevel(g);
              }}
            />
          </>
        ) : null}

        {step === 4 ? (
          <>
            <h1 className="text-2xl font-black">{t.onboarding.targetTitle}</h1>
            <p className="text-sm text-ink-2">{t.onboarding.targetHelp}</p>
            <GradeSelect
              idPrefix="ob-target"
              system={targetSystem}
              grade={targetGrade}
              onChange={(s, g) => {
                setTargetSystem(s);
                setTargetGrade(g);
              }}
            />
          </>
        ) : null}

        {step === 5 ? (
          <>
            <h1 className="text-2xl font-black">{t.onboarding.gymsTitle}</h1>
            <p className="text-sm text-ink-2">{t.onboarding.gymsHelp}</p>
            <GymPicker
              mode="multi"
              gyms={gyms}
              favouriteIds={favouriteIds}
              selected={selectedGyms}
              onToggle={(g) =>
                setSelectedGyms((s) => (s.includes(g.id) ? s.filter((x) => x !== g.id) : [...s, g.id]))
              }
            />
          </>
        ) : null}

        {step === 6 ? (
          <>
            <h1 className="text-2xl font-black">{t.onboarding.wearableTitle}</h1>
            <p className="text-ink-2">{t.onboarding.wearableHelp}</p>
          </>
        ) : null}

        {step === 7 ? (
          <div className="space-y-5">
            <div className="flex items-start gap-3 rounded-2xl border border-line bg-surface p-4">
              <PatrickAvatar />
              <p className="whitespace-pre-line text-ink">{fmt(t.onboarding.patrickIntro, { name: name || "" })}</p>
            </div>
            {error ? <Notice tone="error">{error}</Notice> : null}
            <Button size="lg" className="w-full" disabled={pending} onClick={() => finish("/session/new")}>
              {pending ? t.common.saving : t.onboarding.startFirstSession}
            </Button>
            <Button variant="ghost" className="w-full" disabled={pending} onClick={() => finish("/home")}>
              {t.onboarding.goHome}
            </Button>
          </div>
        ) : null}
      </div>

      {step < TOTAL ? (
        <div className="mt-10 flex gap-2">
          {step > 1 ? (
            <Button variant="ghost" onClick={prev}>
              {t.common.back}
            </Button>
          ) : null}
          <Button className="flex-1" size="lg" onClick={next} disabled={step === 1 && name.trim().length === 0}>
            {t.common.continue}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
