"use client";

import { startTransition, useActionState, useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { importTeamTopo, type TopoImportState } from "@/lib/actions/team-topo";
import { fmt } from "@/lib/i18n";

/** Admin: upload a Google My Maps export (KMZ/KML) as the topo of an outdoor site. */
export function TopoImport({
  sites,
  defaultCredit,
}: {
  sites: Array<{ id: string; name: string; topo_problems: number | null }>;
  defaultCredit: string;
}) {
  const { t } = useI18n();
  const [state, dispatch, pending] = useActionState(importTeamTopo, null);
  const form = useRef<HTMLFormElement>(null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  // Sent by hand rather than as the form's action, so the chosen file stays in the form:
  // confirming a replacement sends exactly what was checked.
  const send = (confirm?: string) => {
    if (!form.current) return;
    const data = new FormData(form.current);
    if (confirm) data.set("confirm", confirm);
    startTransition(() => dispatch(data));
  };
  const done = state?.ok && state.step === "done" ? state : null;
  const confirm = state?.ok && state.step === "confirm" && state.token !== dismissed ? state : null;
  useEffect(() => {
    if (done) form.current?.reset();
  }, [done]);
  if (sites.length === 0) return <p className="text-sm text-ink-2">{t.admin.topoNoSite}</p>;
  return (
    <form
      ref={form}
      className="space-y-3"
      aria-label={t.admin.topoTitle}
      onSubmit={(event) => {
        event.preventDefault();
        send();
      }}
    >
      <div>
        <Label htmlFor="topo-site">{t.admin.topoSite}</Label>
        <Select id="topo-site" name="gymId" required defaultValue={sites[0].id}>
          {sites.map((s) => (
            <option key={s.id} value={s.id}>
              {s.topo_problems ? fmt(t.admin.topoSiteWithTopo, { name: s.name, n: s.topo_problems }) : s.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor="topo-file">{t.admin.topoFile}</Label>
        <Input
          id="topo-file"
          name="file"
          type="file"
          accept=".kmz,.kml,application/vnd.google-earth.kmz,application/vnd.google-earth.kml+xml"
        />
      </div>
      <p className="-mt-2 text-xs text-ink-3">{t.admin.topoFileHint}</p>
      <div>
        <Label htmlFor="topo-list" hint={t.common.optional}>{t.admin.topoListLabel}</Label>
        <textarea id="topo-list" name="list" rows={8} maxLength={200000} spellCheck={false}
          className="mt-1 w-full rounded-xl border border-line bg-surface p-3 font-mono text-xs" />
        <p className="mt-1 text-xs text-ink-3">{t.admin.topoListHint}</p>
      </div>
      <div>
        <Label htmlFor="topo-credit" hint={t.common.optional}>{t.admin.topoCredit}</Label>
        <Input id="topo-credit" name="credit" maxLength={200} defaultValue={defaultCredit} autoComplete="off" />
        <p className="mt-1 text-xs text-ink-3">{t.admin.topoCreditHint}</p>
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? t.admin.topoImporting : t.admin.topoImport}
      </Button>
      {state && !state.ok ? (
        <Notice tone="error">
          <p>{fmt(t.admin.topoErrors[state.error], { km: state.km ?? 0, site: state.site ?? "" })}</p>
          {state.mapName ? <p>{fmt(t.admin.topoMapName, { name: state.mapName })}</p> : null}
        </Notice>
      ) : null}
      {confirm ? (
        <div className="space-y-2">
          <Notice tone="warn">
            <p className="font-semibold">
              {fmt(t.admin.topoConfirmTitle, { removed: confirm.removed, current: confirm.current, site: confirm.site })}
            </p>
            {confirm.mapName ? <p>{fmt(t.admin.topoMapName, { name: confirm.mapName })}</p> : null}
            <p>{fmt(t.admin.topoConfirmKept, { problems: confirm.problems, kept: confirm.kept, added: confirm.added })}</p>
            {confirm.unlinked > 0 ? <p>{fmt(t.admin.topoConfirmUnlinked, { n: confirm.unlinked })}</p> : null}
          </Notice>
          <details className="text-sm text-ink-2">
            <summary className="min-h-11 cursor-pointer py-2">{fmt(t.admin.topoConfirmRemoved, { n: confirm.removed })}</summary>
            <ul className="list-disc space-y-1 pl-5">
              {confirm.removedNames.map((name, i) => <li key={i}>{name}</li>)}
              {confirm.removed > confirm.removedNames.length ? (
                <li>{fmt(t.admin.topoConfirmMore, { n: confirm.removed - confirm.removedNames.length })}</li>
              ) : null}
            </ul>
          </details>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="danger" disabled={pending} onClick={() => send(confirm.token)}>
              {fmt(t.admin.topoConfirmButton, { site: confirm.site })}
            </Button>
            <Button type="button" variant="ghost" disabled={pending} onClick={() => setDismissed(confirm.token)}>
              {t.common.cancel}
            </Button>
          </div>
        </div>
      ) : null}
      {done ? (
        <div className="space-y-2">
          <Notice tone="ok">
            {fmt(t.admin.topoDone, {
              problems: done.problems,
              circuits: done.circuits,
              added: done.added,
              updated: done.updated,
              removed: done.removed,
            })}
          </Notice>
          {done.list ? <TopoListReport report={done.list} /> : null}
          {done.unlinked > 0 ? <Notice tone="warn">{fmt(t.admin.topoUnlinked, { n: done.unlinked })}</Notice> : null}
          {done.relinked > 0 ? <Notice tone="ok">{fmt(t.admin.topoRelinked, { n: done.relinked })}</Notice> : null}
          {done.skipped.length > 0 ? (
            <details className="text-sm text-ink-2">
              <summary className="min-h-11 cursor-pointer py-2">{fmt(t.admin.topoSkipped, { n: done.skipped.length })}</summary>
              <ul className="list-disc space-y-1 pl-5">
                {done.skipped.map((s, i) => (
                  <li key={i}>
                    {s.name}
                    {s.folder ? ` (${s.folder})` : ""} — {t.admin.topoSkipReasons[s.reason]}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function TopoListReport({ report }: { report: NonNullable<Extract<NonNullable<TopoImportState>, { step: "done" }>["list"]> }) {
  const { t } = useI18n();
  const groups: Array<[string, string[]]> = [
    [fmt(t.admin.topoNoPosition, { n: report.withoutPosition.length }), report.withoutPosition],
    [fmt(t.admin.topoUnmatched, { n: report.unmatchedPins.length }), report.unmatchedPins],
    [fmt(t.admin.topoUnreadable, { n: report.unreadable.length }), report.unreadable],
  ];
  return (
    <div className="space-y-1 text-sm text-ink-2">
      <p>{fmt(t.admin.topoListDone, { placed: report.placed })}</p>
      {groups.filter(([, items]) => items.length > 0).map(([title, items]) => (
        <details key={title}>
          <summary className="min-h-11 cursor-pointer py-2">{title}</summary>
          <ul className="list-disc space-y-1 pl-5">{items.map((item, i) => <li key={i}>{item}</li>)}</ul>
        </details>
      ))}
    </div>
  );
}
