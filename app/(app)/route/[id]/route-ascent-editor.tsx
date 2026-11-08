"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Card, Notice, SectionTitle } from "@/components/ui/card";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { deleteRouteAscent, updateRouteAscent } from "@/lib/actions/routes";
import { isClean, isFirstGoOnly, ROUTE_RESULTS, ROUTE_STYLES, type RouteResult, type RouteStyle } from "@/lib/climbing/routes";
import { WALL_ANGLES, type WallAngle } from "@/lib/climbing/types";
import { FRENCH_ROUTE_GRADES } from "@/lib/grading/route-grades";
import { routeDictionary } from "@/lib/i18n/routes";

const URL_PATTERN = String.raw`https://\S+`;

export type EditableAscent = {
  id: string;
  sessionId: string;
  routeName: string;
  grade: string;
  style: RouteStyle;
  result: RouteResult;
  falls: number | null;
  tries: number;
  wallAngle: WallAngle;
  sector: string;
  notes: string;
  beta: string;
  topoRef: string;
  topoUrl: string;
};

/** Every detail of a logged route line, editable afterwards. Topo fields for outdoor crags. */
export function RouteAscentEditor({ ascent, outdoor }: { ascent: EditableAscent; outdoor: boolean }) {
  const { t, locale } = useI18n();
  const r = routeDictionary(locale);
  const router = useRouter();
  const [result, setResult] = useState<RouteResult>(ascent.result);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [pending, start] = useTransition();
  const firstGo = isFirstGoOnly(result);
  const clean = isClean(result);

  return (
    <Card>
      <form
        aria-label={r.editTitle}
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const fd = new FormData(e.currentTarget);
          const num = (k: string) => (fd.get(k) === null || fd.get(k) === "" ? null : Number(fd.get(k)));
          setMessage(null);
          start(async () => {
            const res = await updateRouteAscent({
              id: ascent.id,
              routeName: String(fd.get("routeName") ?? ""),
              grade: String(fd.get("grade")),
              style: String(fd.get("style")),
              result,
              ...(clean ? {} : { falls: num("falls") }),
              ...(firstGo ? {} : { tries: num("tries") ?? 1 }),
              wallAngle: String(fd.get("wallAngle")),
              sector: String(fd.get("sector") ?? ""),
              notes: String(fd.get("notes") ?? ""),
              beta: String(fd.get("beta") ?? ""),
              ...(outdoor ? { topoRef: String(fd.get("topoRef") ?? ""), topoUrl: String(fd.get("topoUrl") ?? "").trim() } : {}),
            });
            setMessage(res.ok ? { ok: true, text: r.saved } : { ok: false, text: res.error === "notFirstAscent" ? r.notFirst : t.common.unknownError });
            if (res.ok) router.refresh();
          });
        }}
      >
        <SectionTitle>{r.editTitle}</SectionTitle>
        <div>
          <Label htmlFor="ra-name" hint={t.common.optional}>{r.nameLabel}</Label>
          <Input id="ra-name" name="routeName" defaultValue={ascent.routeName} maxLength={120} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ra-grade">{r.grade}</Label>
            <Select id="ra-grade" name="grade" defaultValue={ascent.grade}>
              {FRENCH_ROUTE_GRADES.map((g) => <option key={g} value={g}>{g}</option>)}
            </Select>
          </div>
          <div>
            <Label htmlFor="ra-style">{r.style}</Label>
            <Select id="ra-style" name="style" defaultValue={ascent.style}>
              {ROUTE_STYLES.map((s) => <option key={s} value={s}>{r.styles[s]}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="ra-result">{r.resultLabel}</Label>
          <Select id="ra-result" value={result} onChange={(e) => setResult(e.target.value as RouteResult)}>
            {ROUTE_RESULTS.map((x) => <option key={x} value={x}>{r.results[x]} — {r.resultHints[x]}</option>)}
          </Select>
          {firstGo ? <p className="mt-1 text-xs text-ink-3">{r.firstGoOnly}</p> : null}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ra-tries">{r.tries}</Label>
            <Input id="ra-tries" name="tries" type="number" inputMode="numeric" min={1} max={100}
              defaultValue={ascent.tries} disabled={firstGo} />
          </div>
          <div>
            <Label htmlFor="ra-falls">{r.falls}</Label>
            <Input id="ra-falls" name="falls" type="number" inputMode="numeric" min={0} max={50}
              defaultValue={ascent.falls ?? ""} disabled={clean} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="ra-sector" hint={t.common.optional}>{r.sector}</Label>
            <Input id="ra-sector" name="sector" defaultValue={ascent.sector} maxLength={120} />
          </div>
          <div>
            <Label htmlFor="ra-angle">{r.wallAngle}</Label>
            <Select id="ra-angle" name="wallAngle" defaultValue={ascent.wallAngle}>
              {WALL_ANGLES.map((a) => <option key={a} value={a}>{t.wallAngles[a]}</option>)}
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="ra-notes">{r.comment}</Label>
          <Textarea id="ra-notes" name="notes" defaultValue={ascent.notes} maxLength={2000} />
        </div>
        <div>
          <Label htmlFor="ra-beta" hint={t.common.optional}>{t.problem.beta}</Label>
          <Textarea id="ra-beta" name="beta" defaultValue={ascent.beta} maxLength={2000} placeholder={t.problem.betaPlaceholder} />
        </div>
        {outdoor ? (
          <fieldset className="space-y-3 rounded-xl bg-surface-2 p-3">
            <legend className="px-1 text-sm font-semibold">{t.problem.topoTitle}</legend>
            <p className="text-xs text-ink-3">{t.problem.topoNote}</p>
            <div>
              <Label htmlFor="ra-topo-ref" hint={t.common.optional}>{t.problem.topoRef}</Label>
              <Input id="ra-topo-ref" name="topoRef" defaultValue={ascent.topoRef} maxLength={160} placeholder={t.problem.topoRefPlaceholder} />
            </div>
            <div>
              <Label htmlFor="ra-topo-url" hint={t.common.optional}>{t.problem.topoUrl}</Label>
              <Input id="ra-topo-url" name="topoUrl" type="url" inputMode="url" defaultValue={ascent.topoUrl} maxLength={500}
                pattern={URL_PATTERN} placeholder="https://" />
            </div>
          </fieldset>
        ) : null}
        {message ? <Notice tone={message.ok ? "ok" : "error"}>{message.text}</Notice> : null}
        <Button type="submit" disabled={pending}>{pending ? t.common.saving : r.save}</Button>
      </form>
      <div className="mt-6 border-t border-line pt-4">
        <Button
          type="button"
          variant="ghost"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(r.deleteAscentConfirm)) return;
            start(async () => {
              const res = await deleteRouteAscent(ascent.id);
              if (res.ok) router.push(`/session/${ascent.sessionId}`);
              else setMessage({ ok: false, text: t.common.unknownError });
            });
          }}
        >
          {r.deleteAscent}
        </Button>
      </div>
    </Card>
  );
}
