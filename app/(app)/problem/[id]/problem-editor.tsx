"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, Notice, SectionTitle } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { deleteProblem, updateProblem } from "@/lib/actions/sessions";
import { STYLE_TAGS, WALL_ANGLES, type GradeSystem, type StyleTag, type WallAngle } from "@/lib/climbing/types";
import { ESTIMATE_CONFIDENCE_PRESETS, FONT_SCALE, RELIABLE_CONFIDENCE, type EstimateConfidencePreset } from "@/lib/grading";

const URL_PATTERN = String.raw`https://\S+`;

function presetFor(confidence: number): EstimateConfidencePreset {
  const entries = Object.entries(ESTIMATE_CONFIDENCE_PRESETS) as Array<[EstimateConfidencePreset, number]>;
  return entries.reduce((best, cur) => (Math.abs(cur[1] - confidence) < Math.abs(best[1] - confidence) ? cur : best))[0];
}

export function ProblemEditor({
  problem,
}: {
  problem: {
    id: string;
    system: GradeSystem;
    name: string;
    wallAngle: WallAngle;
    wallZone: string;
    setter: string;
    notes: string;
    beta: string;
    topoRef: string;
    topoUrl: string;
    nativeGrade: string;
    /** Outdoor: sector instead of wall zone, topo reference and link. */
    outdoor: boolean;
    /** Picked from the topo catalogue: its grade comes from the topo. */
    catalogue: boolean;
    tags: StyleTag[];
    estimate: { grade: string; confidence: number } | null;
  };
}) {
  const { t } = useI18n();
  const router = useRouter();
  const [tags, setTags] = useState<StyleTag[]>(problem.tags);
  const [estimateGrade, setEstimateGrade] = useState(problem.estimate?.grade ?? "");
  const [preset, setPreset] = useState<EstimateConfidencePreset>(
    problem.estimate ? presetFor(problem.estimate.confidence) : "fairly_sure",
  );
  const [saved, setSaved] = useState<"ok" | "error" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pending, start] = useTransition();
  const canEstimate = problem.system !== "FONT";
  const canRegrade = problem.system === "FONT" && !problem.catalogue;

  return (
    <Card>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          start(async () => {
            const res = await updateProblem({
              problemId: problem.id,
              name: String(fd.get("name") ?? ""),
              wallAngle: fd.get("wallAngle") as WallAngle,
              wallZone: String(fd.get("wallZone") ?? ""),
              setter: String(fd.get("setter") ?? ""),
              notes: String(fd.get("notes") ?? ""),
              beta: String(fd.get("beta") ?? ""),
              ...(problem.outdoor
                ? { topoRef: String(fd.get("topoRef") ?? ""), topoUrl: String(fd.get("topoUrl") ?? "").trim() }
                : {}),
              ...(canRegrade ? { nativeGrade: String(fd.get("nativeGrade") ?? problem.nativeGrade) } : {}),
              tags,
              ...(canEstimate
                ? {
                    estimate: estimateGrade
                      ? { grade: estimateGrade, confidence: ESTIMATE_CONFIDENCE_PRESETS[preset] }
                      : null,
                  }
                : {}),
            });
            setSaved(res.ok ? "ok" : "error");
            router.refresh();
          });
        }}
      >
        <SectionTitle>{t.problem.details}</SectionTitle>
        <div className={canRegrade ? "grid grid-cols-[1fr_7rem] gap-3" : undefined}>
          <div>
            <Label htmlFor="p-name">{t.problem.name}</Label>
            <Input id="p-name" name="name" defaultValue={problem.name} maxLength={120} />
          </div>
          {canRegrade ? (
            <div>
              <Label htmlFor="p-grade">{t.problem.grade}</Label>
              <Select id="p-grade" name="nativeGrade" defaultValue={problem.nativeGrade}>
                {FONT_SCALE.map((g) => <option key={g} value={g}>{g}</option>)}
              </Select>
            </div>
          ) : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="p-angle">{t.session.wallAngle}</Label>
            <Select id="p-angle" name="wallAngle" defaultValue={problem.wallAngle}>
              {WALL_ANGLES.map((a) => (
                <option key={a} value={a}>
                  {t.wallAngles[a]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="p-zone">{problem.outdoor ? t.problem.sector : t.problem.zone}</Label>
            <Input id="p-zone" name="wallZone" defaultValue={problem.wallZone} maxLength={80} />
          </div>
        </div>
        <fieldset>
          <legend className="mb-1.5 text-sm font-semibold">{t.session.styles}</legend>
          <div className="flex flex-wrap gap-1.5">
            {STYLE_TAGS.map((s) => {
              const on = tags.includes(s);
              return (
                <button
                  key={s}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setTags((cur) => (on ? cur.filter((x) => x !== s) : [...cur, s]))}
                  className={cn(
                    "min-h-11 rounded-full border px-3 text-sm",
                    on ? "border-accent bg-accent-soft font-semibold" : "border-line text-ink-2",
                  )}
                >
                  {t.styles[s]}
                </button>
              );
            })}
          </div>
        </fieldset>

        {canEstimate ? (
          <fieldset className="rounded-xl bg-surface-2 p-3">
            <legend className="px-1 text-sm font-semibold">{t.grades.estimateTitle}</legend>
            <p className="mb-2 text-xs text-ink-3">{t.grades.estimateHelp}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label htmlFor="p-est">Font</Label>
                <Select id="p-est" value={estimateGrade} onChange={(e) => setEstimateGrade(e.target.value)}>
                  <option value="">{t.common.none}</option>
                  {FONT_SCALE.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
              <div>
                <Label htmlFor="p-conf">{t.grades.confidence}</Label>
                <Select
                  id="p-conf"
                  value={preset}
                  disabled={!estimateGrade}
                  onChange={(e) => setPreset(e.target.value as EstimateConfidencePreset)}
                >
                  <option value="rough">{t.grades.confidenceRough}</option>
                  <option value="fairly_sure">{t.grades.confidenceFairly}</option>
                  <option value="confident">{t.grades.confidenceConfident}</option>
                </Select>
              </div>
            </div>
            {estimateGrade && ESTIMATE_CONFIDENCE_PRESETS[preset] < RELIABLE_CONFIDENCE ? (
              <p className="mt-2 text-xs text-warn">{t.grades.uncertainEstimate}</p>
            ) : null}
          </fieldset>
        ) : null}

        <div>
          <Label htmlFor="p-setter" hint={t.common.optional}>
            {t.problem.setter}
          </Label>
          <Input id="p-setter" name="setter" defaultValue={problem.setter} maxLength={80} />
        </div>
        <div>
          <Label htmlFor="p-notes">{t.problem.notes}</Label>
          <Textarea id="p-notes" name="notes" defaultValue={problem.notes} maxLength={2000} />
        </div>
        <div>
          <Label htmlFor="p-beta" hint={t.common.optional}>{t.problem.beta}</Label>
          <Textarea id="p-beta" name="beta" defaultValue={problem.beta} maxLength={2000} placeholder={t.problem.betaPlaceholder} />
        </div>
        {problem.outdoor ? (
          <fieldset className="space-y-3 rounded-xl bg-surface-2 p-3">
            <legend className="px-1 text-sm font-semibold">{t.problem.topoTitle}</legend>
            <p className="text-xs text-ink-3">{t.problem.topoNote}</p>
            <div>
              <Label htmlFor="p-topo-ref" hint={t.common.optional}>{t.problem.topoRef}</Label>
              <Input id="p-topo-ref" name="topoRef" defaultValue={problem.topoRef} maxLength={160} placeholder={t.problem.topoRefPlaceholder} />
            </div>
            <div>
              <Label htmlFor="p-topo-url" hint={t.common.optional}>{t.problem.topoUrl}</Label>
              <Input id="p-topo-url" name="topoUrl" type="url" inputMode="url" defaultValue={problem.topoUrl} maxLength={500}
                pattern={URL_PATTERN} placeholder="https://" />
            </div>
          </fieldset>
        ) : null}
        {saved === "ok" ? <Notice tone="ok">✓</Notice> : saved === "error" ? <Notice tone="error">{t.common.unknownError}</Notice> : null}
        <Button type="submit" disabled={pending}>
          {pending ? t.common.saving : t.common.save}
        </Button>
      </form>

      <div className="mt-6 border-t border-line pt-4">
        {confirmDelete ? (
          <form action={deleteProblem.bind(null, problem.id)} className="space-y-2">
            <p className="text-sm">{t.problem.deleteProblemConfirm}</p>
            <div className="flex gap-2">
              <Button type="submit" variant="danger">
                {t.common.confirmDelete}
              </Button>
              <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
                {t.common.cancel}
              </Button>
            </div>
          </form>
        ) : (
          <Button type="button" variant="ghost" onClick={() => setConfirmDelete(true)}>
            {t.problem.deleteProblem}
          </Button>
        )}
      </div>
    </Card>
  );
}
