"use client";

import { useActionState } from "react";
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
  const [state, action, pending] = useActionState(importTeamTopo, null);
  if (sites.length === 0) return <p className="text-sm text-ink-2">{t.admin.topoNoSite}</p>;
  return (
    <form action={action} className="space-y-3" aria-label={t.admin.topoTitle}>
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
      {state && !state.ok ? <Notice tone="error">{t.admin.topoErrors[state.error]}</Notice> : null}
      {state?.ok ? (
        <div className="space-y-2">
          <Notice tone="ok">
            {fmt(t.admin.topoDone, {
              problems: state.problems,
              circuits: state.circuits,
              added: state.added,
              updated: state.updated,
              removed: state.removed,
            })}
          </Notice>
          {state.list ? <TopoListReport report={state.list} /> : null}
          {state.unlinked > 0 ? <Notice tone="warn">{fmt(t.admin.topoUnlinked, { n: state.unlinked })}</Notice> : null}
          {state.skipped.length > 0 ? (
            <details className="text-sm text-ink-2">
              <summary className="min-h-11 cursor-pointer py-2">{fmt(t.admin.topoSkipped, { n: state.skipped.length })}</summary>
              <ul className="list-disc space-y-1 pl-5">
                {state.skipped.map((s, i) => (
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

function TopoListReport({ report }: { report: NonNullable<Extract<NonNullable<TopoImportState>, { ok: true }>["list"]> }) {
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
