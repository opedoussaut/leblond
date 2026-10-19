"use client";

import { useActionState, useState } from "react";
import { GradeSelect } from "@/components/climbing/grade-select";
import { RouteGradeSelect } from "@/components/climbing/route-grade-select";
import { GoalSelect } from "@/components/climbing/goal-select";
import type { TargetDiscipline } from "@/lib/climbing/goals";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, Notice } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { updateProfile } from "@/lib/actions/profile";
import type { GradeSystem } from "@/lib/climbing/types";

export function ProfileForm({
  initial,
}: {
  initial: {
    displayName: string;
    language: "fr" | "en";
    targetSystem: GradeSystem;
    targetGrade: string;
    targetDiscipline: TargetDiscipline;
    targetRouteGrade: string;
    boulderGrade: string;
    boulderSystem: GradeSystem;
    routeGrade: string;
    heightCm: string;
    weightKg: string;
    climbingSince: string;
    bio: string;
  };
}) {
  const { t } = useI18n();
  const [state, action, pending] = useActionState(updateProfile, null);
  const [target, setTarget] = useState({ system: initial.targetSystem, grade: initial.targetGrade });
  const [targetDiscipline, setTargetDiscipline] = useState(initial.targetDiscipline);
  const [targetRouteGrade, setTargetRouteGrade] = useState(initial.targetRouteGrade);
  const [boulder, setBoulder] = useState({ system: initial.boulderSystem, grade: initial.boulderGrade });
  const [routeGrade, setRouteGrade] = useState(initial.routeGrade);
  return (
    <Card>
      <form action={action} className="space-y-4">
        <div>
          <Label htmlFor="pf-name">{t.profile.displayName}</Label>
          <Input id="pf-name" name="displayName" defaultValue={initial.displayName} required maxLength={60} />
        </div>
        <div>
          <Label htmlFor="pf-lang">{t.profile.language}</Label>
          <Select id="pf-lang" name="language" defaultValue={initial.language}>
            <option value="fr">{t.settings.languageFr}</option>
            <option value="en">{t.settings.languageEn}</option>
          </Select>
        </div>
        <fieldset className="rounded-2xl border border-line p-4">
          <legend className="px-2 font-bold">{t.onboarding.boulderLevel}</legend>
          <GradeSelect idPrefix="pf-boulder" system={boulder.system} grade={boulder.grade}
            systemName="boulderSystem" gradeName="boulderGrade"
            allowEmpty emptyLabel={t.onboarding.levelUnknown}
            onChange={(system, grade) => setBoulder({ system, grade })}/>
        </fieldset>
        <fieldset className="rounded-2xl border border-line p-4">
          <legend className="px-2 font-bold">{t.onboarding.routeLevel}</legend>
          <p className="mb-3 text-xs text-ink-2">{t.onboarding.routeScaleHelp}</p>
          <RouteGradeSelect id="pf-route" grade={routeGrade} onChange={setRouteGrade}
            name="routeGrade" label={t.onboarding.routeGrade} emptyLabel={t.onboarding.levelUnknown}/>
        </fieldset>
        <fieldset>
          <legend className="mb-2 font-semibold">{t.profile.target}</legend>
          <GoalSelect idPrefix="pf-target" named
            discipline={targetDiscipline} onDisciplineChange={setTargetDiscipline}
            boulderSystem={target.system} boulderGrade={target.grade}
            onBoulderChange={(system, grade) => setTarget({ system, grade })}
            routeGrade={targetRouteGrade} onRouteChange={setTargetRouteGrade}
            labels={{
              discipline: t.onboarding.goalDiscipline,
              boulder: t.onboarding.goalBoulder,
              route: t.onboarding.goalRoute,
              both: t.onboarding.goalBoth,
              boulderTarget: t.onboarding.boulderTarget,
              routeTarget: t.onboarding.routeTarget,
              selectRouteGrade: t.onboarding.selectRouteTarget,
            }}/>
        </fieldset>
        {targetDiscipline !== "BOULDER" ? <p className="text-xs text-ink-2">{t.onboarding.routeProgressPending}</p> : null}
        <p className="text-xs text-ink-3">{t.profile.privacyNote}</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="pf-h" hint={t.common.optional}>
              {t.profile.height}
            </Label>
            <Input id="pf-h" name="heightCm" inputMode="decimal" defaultValue={initial.heightCm} />
          </div>
          <div>
            <Label htmlFor="pf-w" hint={t.common.optional}>
              {t.profile.weight}
            </Label>
            <Input id="pf-w" name="weightKg" inputMode="decimal" defaultValue={initial.weightKg} />
          </div>
        </div>
        <div>
          <Label htmlFor="pf-since" hint={t.common.optional}>
            {t.profile.climbingSince}
          </Label>
          <Input id="pf-since" name="climbingSince" type="date" defaultValue={initial.climbingSince} />
        </div>
        <div>
          <Label htmlFor="pf-bio" hint={t.common.optional}>
            {t.profile.bio}
          </Label>
          <Textarea id="pf-bio" name="bio" defaultValue={initial.bio} maxLength={1000} />
        </div>
        {state?.ok ? <Notice tone="ok">{t.profile.saved}</Notice> : state ? <Notice tone="error">{t.common.unknownError}</Notice> : null}
        <Button type="submit" size="lg" disabled={pending} className="w-full">
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>
    </Card>
  );
}
