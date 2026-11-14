"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { useI18n } from "@/components/i18n-provider";
import {
  emptyDetails, emptySite, isNewSite, OutdoorDetailsFields, OutdoorSitePicker, siteInput,
  type DetailsValue, type SiteOptions,
} from "@/components/climbing/outdoor-project-fields";
import { buttonClass } from "@/components/ui/button";
import { Input, Label, Select, Textarea } from "@/components/ui/field";
import { createOutdoorBoulderProject, searchTopoBoulders, type TopoBoulderHit } from "@/lib/actions/projects";
import { FONT_SCALE } from "@/lib/grading/systems";
import { fontSpelling } from "@/lib/climbing/outdoor-projects";
import { boulderGrade } from "@/lib/grading/display";
import { fmt } from "@/lib/i18n";
import { outdoorProjectsDictionary } from "@/lib/i18n/outdoor-projects";

/** Create a boulder project outdoors: site, topo boulder or free entry, Font grade, details. */
export function OutdoorBoulderProjectForm({ sites }: { sites: SiteOptions }) {
  const { t, locale } = useI18n();
  const d = outdoorProjectsDictionary(locale);
  const router = useRouter();
  const [site, setSite] = useState(() => emptySite(sites));
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<TopoBoulderHit[] | null>(null);
  const [picked, setPicked] = useState<TopoBoulderHit | null>(null);
  const [name, setName] = useState("");
  const [grade, setGrade] = useState("6C");
  const [details, setDetails] = useState<DetailsValue>(emptyDetails);
  const [notes, setNotes] = useState("");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  const newSite = isNewSite(site);

  // Topo search (existing sites only), debounced.
  useEffect(() => {
    if (newSite || picked || query.trim().length < 2) return;
    let live = true;
    const timer = setTimeout(async () => {
      const res = await searchTopoBoulders(site.gymId, query);
      if (live) setHits(res);
    }, 250);
    return () => { live = false; clearTimeout(timer); };
  }, [site.gymId, newSite, picked, query]);

  function choose(h: TopoBoulderHit) {
    setPicked(h); setName(h.name); setGrade(fontSpelling(h.grade)); setHits(null);
  }
  function clearPick() { setPicked(null); setQuery(""); setHits(null); }

  return <form aria-label={d.newBoulderProject} className="space-y-3" onSubmit={(e) => {
    e.preventDefault(); setError("");
    start(async () => {
      const res = await createOutdoorBoulderProject({
        site: siteInput(site), outdoorProblemId: picked?.id ?? null, name, grade, notes, ...details,
      });
      if (!res.ok || !res.data) { setError(d.errors[res.ok ? "unknownError" : res.error] ?? d.errors.unknownError); return; }
      router.push("/projects/" + res.data.id);
    });
  }}>
    <OutdoorSitePicker id="obp-site" sites={sites} value={site} onChange={(v) => { setSite(v); clearPick(); }} />

    {!newSite ? <div>
      <Label htmlFor="obp-topo" hint={t.common.optional}>{d.boulderFromTopo}</Label>
      {picked ? <p className="mt-1 flex flex-wrap items-center gap-2 text-sm">
        <span className="font-semibold">{fmt(d.topoPicked, { name: picked.name })} · {boulderGrade(picked.grade)}</span>
        <button type="button" onClick={clearPick} className="font-semibold text-accent hover:underline">{d.clearTopo}</button>
      </p> : <>
        <Input id="obp-topo" type="search" maxLength={60} placeholder={d.boulderSearchPlaceholder} value={query}
          onChange={(e) => { setQuery(e.target.value); if (e.target.value.trim().length < 2) setHits(null); }} />
        <p className="mt-1 text-xs text-ink-3">{d.boulderFromTopoHint}</p>
        {hits?.length ? <ul className="mt-2 divide-y divide-line rounded-xl border border-line">
          {hits.map((h) => <li key={h.id}>
            <button type="button" onClick={() => choose(h)} className="flex min-h-11 w-full items-center justify-between gap-3 px-3 text-left text-sm hover:bg-surface-2">
              <span>{h.name}{h.circuit_number ? <span className="text-ink-3"> · n° {h.circuit_number}</span> : null}</span>
              <strong className="tabular-nums">{boulderGrade(h.grade)}</strong>
            </button>
          </li>)}
        </ul> : hits ? <p className="mt-1 text-xs text-ink-3">{d.noTopoHit}</p> : null}
      </>}
    </div> : null}

    <div className="grid grid-cols-[1fr_7rem] gap-3">
      <div>
        <Label htmlFor="obp-name">{d.boulderName}</Label>
        <Input id="obp-name" required={!picked} maxLength={120} value={name} onChange={(e) => setName(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="obp-grade">{d.gradeFont}</Label>
        <Select id="obp-grade" value={grade} onChange={(e) => setGrade(e.target.value)}>
          {FONT_SCALE.map((g) => <option key={g} value={g}>{boulderGrade(g)}</option>)}
        </Select>
      </div>
    </div>
    <p className="text-xs text-ink-3">{d.gradeNote}</p>
    <OutdoorDetailsFields id="obp" value={details} onChange={setDetails} />
    <div>
      <Label htmlFor="obp-notes" hint={t.common.optional}>{d.notes}</Label>
      <Textarea id="obp-notes" rows={2} maxLength={4000} value={notes} onChange={(e) => setNotes(e.target.value)} />
    </div>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
    <button type="submit" disabled={pending || (!picked && !name.trim()) || (newSite && site.newName.trim().length < 2)}
      className={buttonClass("primary", "md")}>{d.create}</button>
  </form>;
}
