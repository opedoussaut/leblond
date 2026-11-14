"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { OutdoorDetailsFields, type DetailsValue } from "@/components/climbing/outdoor-project-fields";
import { Button } from "@/components/ui/button";
import { Card, Notice, SectionTitle } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { IconCheck } from "@/components/ui/icons";
import { updateProblem } from "@/lib/actions/sessions";
import { FONT_SCALE } from "@/lib/grading/systems";
import { boulderGrade } from "@/lib/grading/display";
import { outdoorProjectsDictionary } from "@/lib/i18n/outdoor-projects";

/** Edit an outdoor boulder project's boulder: name, native Font grade, sector, angle, beta, topo. */
export function OutdoorBoulderEditor({ problem }: {
  problem: { id: string; name: string; grade: string; details: DetailsValue };
}) {
  const { locale } = useI18n();
  const d = outdoorProjectsDictionary(locale);
  const router = useRouter();
  const [name, setName] = useState(problem.name);
  const [grade, setGrade] = useState(problem.grade);
  const [details, setDetails] = useState(problem.details);
  const [state, setState] = useState<"ok" | string | null>(null);
  const [pending, start] = useTransition();
  const fontGrade = (FONT_SCALE as readonly string[]).includes(problem.grade);

  return <Card>
    <form className="space-y-3" onSubmit={(e) => {
      e.preventDefault(); setState(null);
      start(async () => {
        const res = await updateProblem({
          problemId: problem.id, name, ...(fontGrade ? { nativeGrade: grade } : {}),
          wallAngle: details.wallAngle, wallZone: details.sector, beta: details.beta,
          topoRef: details.topoRef, topoUrl: details.topoUrl,
        });
        setState(res.ok ? "ok" : (d.errors[res.error] ?? d.errors.unknownError));
        if (res.ok) router.refresh();
      });
    }}>
      <SectionTitle>{d.details}</SectionTitle>
      <div className={fontGrade ? "grid grid-cols-[1fr_7rem] gap-3" : undefined}>
        <div>
          <Label htmlFor="obe-name">{d.boulderName}</Label>
          <Input id="obe-name" maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        {fontGrade ? <div>
          <Label htmlFor="obe-grade">{d.gradeFont}</Label>
          <Select id="obe-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
            {FONT_SCALE.map((g) => <option key={g} value={g}>{boulderGrade(g)}</option>)}
          </Select>
        </div> : null}
      </div>
      <OutdoorDetailsFields id="obe" value={details} onChange={setDetails} />
      {state === "ok" ? <Notice tone="ok"><IconCheck /> {d.saved}</Notice> : state ? <Notice tone="error">{state}</Notice> : null}
      <Button type="submit" disabled={pending}>{d.save}</Button>
    </form>
  </Card>;
}
