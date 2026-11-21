"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveBatteryCard } from "@/lib/actions/mobility-battery";
import { fmt, type Locale } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { GONIOMETRY_MOVES, cardSides, type Card, type Side } from "@/lib/training/mobility-battery/cards";
import { CHOSEN_NOT_DONE_REASONS, type EntryInput, type ResultDetails } from "@/lib/training/mobility-battery/results";
import {
  DISTAL_AREAS, NEURO_STATES, RADIATION, STOP_SIGNS, type CardAccess, type Radiation, type StopSign,
} from "@/lib/training/mobility-battery/safety";
import { pick } from "@/lib/training/sessions";
import { buttonClass, toggleClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";
import { IconBack } from "@/components/ui/icons";

/** What the page passes in: the rows already saved for this card. */
export type SavedEntry = {
  side: Side; item: number; trial: number; status: "DONE" | "NOT_DONE"; value: number | null; category: string | null;
  notDoneReason: string | null; painBefore: number | null; painAfter: number | null; radiation: Radiation | null; details: ResultDetails; note: string;
};

type Block = {
  notDone: boolean;
  reason: (typeof CHOSEN_NOT_DONE_REASONS)[number] | null;
  values: string[];
  categories: string[];
};
type SideState = {
  painBefore: string; painAfter: string; radiation: Radiation | null; signs: StopSign[];
  details: Pick<ResultDetails, "handsUsed" | "unilateral" | "compensation" | "limitedByOtherLeg" | "photo">;
};

const PAIN_VALUES = Array.from({ length: 11 }, (_, i) => i);
const num = (v: string) => (v.trim() === "" || !Number.isFinite(Number(v.replace(",", "."))) ? null : Number(v.replace(",", ".")));
const painNum = (v: string) => (v === "" ? null : Number(v));

function initialBlocks(card: Card, saved: readonly SavedEntry[]) {
  const blocks: Record<string, Block> = {};
  for (const side of cardSides(card)) for (const { item } of card.items) {
    const rows = saved.filter((r) => r.side === side && r.item === item);
    const nd = rows.find((r) => r.status === "NOT_DONE");
    blocks[`${side}:${item}`] = {
      notDone: !!nd && nd.notDoneReason !== "STOPPED_SYMPTOM" && nd.notDoneReason !== "LOCKED",
      reason: (CHOSEN_NOT_DONE_REASONS as readonly string[]).includes(nd?.notDoneReason ?? "") ? nd!.notDoneReason as Block["reason"] : null,
      values: Array.from({ length: card.trials }, (_, i) => { const v = rows.find((r) => r.trial === i + 1)?.value; return v === null || v === undefined ? "" : String(v); }),
      categories: Array.from({ length: card.trials }, (_, i) => rows.find((r) => r.trial === i + 1)?.category ?? ""),
    };
  }
  return blocks;
}

function initialSides(card: Card, saved: readonly SavedEntry[]) {
  const sides: Record<string, SideState> = {};
  for (const side of cardSides(card)) {
    const r = saved.find((x) => x.side === side);
    const d = r?.details ?? {};
    sides[side] = {
      painBefore: r?.painBefore?.toString() ?? "", painAfter: r?.painAfter?.toString() ?? "", radiation: r?.radiation ?? null, signs: [],
      details: { handsUsed: d.handsUsed, unilateral: d.unilateral, compensation: d.compensation, limitedByOtherLeg: d.limitedByOtherLeg, photo: d.photo },
    };
  }
  return sides;
}

function PainSelect({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return <label className="block text-sm font-semibold">{label}
    <select className={fieldClass} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">—</option>
      {PAIN_VALUES.map((n) => <option key={n} value={n}>{n}</option>)}
    </select>
  </label>;
}

export function BatteryCardForm({ locale, sessionId, card, access, saved, clinicalReviewOn }: {
  locale: Locale; sessionId: string; card: Card; access: CardAccess; saved: readonly SavedEntry[]; clinicalReviewOn: string | null;
}) {
  const t = batteryDictionary(locale);
  const router = useRouter();
  const [blocks, setBlocks] = useState(() => initialBlocks(card, saved));
  const [sides, setSides] = useState(() => initialSides(card, saved));
  const first = saved[0]?.details ?? {};
  const [m01, setM01] = useState({ neuro: first.neuro ?? null, legSide: first.legSide ?? null, distal: first.distal ?? null });
  const [note, setNote] = useState(saved.find((r) => r.note)?.note ?? "");
  const [angles, setAngles] = useState(first.angles ?? []);
  const [review, setReview] = useState(clinicalReviewOn ?? "");
  const [message, setMessage] = useState<{ tone: "ok" | "warn" | "error"; text: string } | null>(null);
  const [ended, setEnded] = useState<null | "NEURO_WORSE" | "SYMPTOM">(null);
  const [pending, start] = useTransition();

  function send(entries: EntryInput[], extra: { clinicalReviewOn?: string | null } = {}) {
    setMessage(null);
    if (!entries.length) { setMessage({ tone: "error", text: t.errors.invalid }); return; }
    start(async () => {
      const r = await saveBatteryCard({ sessionId, cardId: card.id, entries, note, ...extra });
      if (!r.ok) { setMessage({ tone: "error", text: t.errors[r.error] }); return; }
      if (r.data.endSession) setEnded(r.data.endSession);
      setMessage(r.data.stopped.length ? { tone: "warn", text: t.savedStopped } : { tone: "ok", text: t.saved });
      // A stopped bilan is closed: keep the stop message on screen instead of reloading into the result.
      if (!r.data.endSession) router.refresh();
    });
  }

  const endedAlert = ended ? <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-5">
    <h2 className="text-base font-bold text-danger">{t.sessionStopped}</h2>
    <p className="mt-1 text-sm text-ink">{ended === "NEURO_WORSE" ? t.neuroStopText : t.symptomStopText}</p>
    <Link href={`/train/mobility/battery/${sessionId}`} className={buttonClass("secondary", "md", "mt-3")}><IconBack /> {t.backToSession}</Link>
  </div> : null;

  // ── Clinician cards: a transcription of what the clinician said, never a tutorial ──
  if (access.state === "CLINICIAN") {
    return <div className="space-y-4">
      <section className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-ink-2">{t.reportedBy}</p>
        {card.id === "M20" ? <label className="block text-sm font-semibold">{t.reviewDate}
          <input type="date" className={fieldClass} value={review} onChange={(e) => setReview(e.target.value)} />
          <span className="mt-1 block text-xs font-normal text-ink-3">{t.clinicalReviewHint}</span>
        </label> : null}
        {card.id === "M19" ? <fieldset className="space-y-3">
          <legend className="text-sm font-semibold">{t.angles}</legend>
          {angles.map((a, i) => <div key={i} className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <select aria-label={t.angles} className={fieldClass} value={a.move} onChange={(e) => setAngles(angles.map((x, j) => j === i ? { ...x, move: e.target.value as typeof a.move } : x))}>
              {GONIOMETRY_MOVES.map((mv) => <option key={mv} value={mv}>{t.moves[mv]}</option>)}
            </select>
            <select aria-label={t.sides.LEFT + " / " + t.sides.RIGHT} className={fieldClass} value={a.side} onChange={(e) => setAngles(angles.map((x, j) => j === i ? { ...x, side: e.target.value as typeof a.side } : x))}>
              <option value="LEFT">{t.sides.LEFT}</option><option value="RIGHT">{t.sides.RIGHT}</option>
            </select>
            <select aria-label={t.modes.ACTIVE + " / " + t.modes.PASSIVE} className={fieldClass} value={a.mode} onChange={(e) => setAngles(angles.map((x, j) => j === i ? { ...x, mode: e.target.value as typeof a.mode } : x))}>
              <option value="ACTIVE">{t.modes.ACTIVE}</option><option value="PASSIVE">{t.modes.PASSIVE}</option>
            </select>
            <input aria-label="°" type="number" inputMode="numeric" min={-30} max={200} className={fieldClass} value={a.degrees}
              onChange={(e) => setAngles(angles.map((x, j) => j === i ? { ...x, degrees: Number(e.target.value) } : x))} />
            <button type="button" className={buttonClass("ghost", "sm")} onClick={() => setAngles(angles.filter((_, j) => j !== i))}>{t.removeAngle}</button>
          </div>)}
          <button type="button" className={buttonClass("secondary", "sm")} disabled={angles.length >= 20}
            onClick={() => setAngles([...angles, { move: "FLEXION", side: "LEFT", mode: "ACTIVE", degrees: 0 }])}>{t.addAngle}</button>
        </fieldset> : null}
        <label className="block text-sm font-semibold">{t.reportNote}
          <textarea className={fieldClass} rows={4} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
        <p className="text-xs text-ink-3">{t.privateNote}</p>
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
        <button type="button" disabled={pending} className={buttonClass("primary", "md")}
          onClick={() => send([{ side: "BOTH", status: "DONE", details: card.id === "M19" ? { angles } : {} }], card.id === "M20" ? { clinicalReviewOn: review || null } : {})}>
          {pending ? t.saving : t.save}
        </button>
      </section>
    </div>;
  }

  // ── Locked cards: can only be marked "not done (card closed)" ──
  if (access.state === "LOCKED") {
    return <div className="space-y-4">
      <section role="status" className="space-y-2 rounded-2xl border border-warn/40 bg-warn/10 p-5">
        <h2 className="text-base font-bold">{t.lockedTitle}</h2>
        <ul className="list-disc pl-5 text-sm">{access.reasons.map((r) => <li key={r}>{t.lockReasons[r]}</li>)}</ul>
        <p className="text-sm text-ink-2">{t.lockedText}</p>
        {access.reasons.includes("SESSION_CLOSED") ? null : <button type="button" disabled={pending} className={buttonClass("secondary", "md")}
          onClick={() => send(cardSides(card).flatMap((side) => card.items.map(({ item }) => ({ side, item, status: "NOT_DONE" as const, notDoneReason: "OTHER" as const }))))}>
          {t.markLocked}
        </button>}
        {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
      </section>
    </div>;
  }

  // ── Open cards ──
  function entries(): EntryInput[] {
    const out: EntryInput[] = [];
    for (const side of cardSides(card)) {
      const s = sides[side];
      for (const { item } of card.items) {
        const b = blocks[`${side}:${item}`];
        const details: ResultDetails = { ...s.details, ...(card.id === "M01" && item === 1 ? {
          ...(m01.neuro ? { neuro: m01.neuro } : {}), ...(m01.legSide ? { legSide: m01.legSide } : {}), ...(m01.distal ? { distal: m01.distal } : {}),
        } : {}) };
        const shared = { side, item, painBefore: painNum(s.painBefore), painAfter: painNum(s.painAfter), radiation: s.radiation, signs: s.signs, details };
        if (b.notDone) { out.push({ ...shared, trial: 1, status: "NOT_DONE", notDoneReason: b.reason }); continue; }
        for (let i = 0; i < card.trials; i++) {
          const value = num(b.values[i] ?? "");
          const category = b.categories[i] || null;
          if (value === null && !category && !s.signs.length) continue;
          out.push({ ...shared, trial: i + 1, status: "DONE", value: category ? null : value, category });
        }
        // A stop sign with no value typed still records the stopped trial.
        if (s.signs.length && !out.some((e) => e.side === side && e.item === item)) out.push({ ...shared, trial: 1, status: "DONE", value: null });
      }
    }
    return out;
  }
  const setBlock = (key: string, patch: Partial<Block>) => setBlocks({ ...blocks, [key]: { ...blocks[key], ...patch } });
  const setSide = (side: string, patch: Partial<SideState>) => setSides({ ...sides, [side]: { ...sides[side], ...patch } });
  const unit = card.measure?.unit ? t.units[card.measure.unit] : "";

  return <div className="space-y-4">
    {endedAlert}
    {card.trials > 1 ? <p className="text-sm text-ink-2">{t.familiarisation}</p> : null}

    {card.id === "M01" ? <section className="grid gap-4 rounded-2xl border border-line bg-surface p-5 sm:grid-cols-3">
      <label className="block text-sm font-semibold">{t.legSide}
        <select className={fieldClass} value={m01.legSide ?? ""} onChange={(e) => setM01({ ...m01, legSide: (e.target.value || null) as typeof m01.legSide })}>
          <option value="">—</option>
          {(["NONE", "LEFT", "RIGHT", "BOTH"] as const).map((k) => <option key={k} value={k}>{t.legSideOptions[k]}</option>)}
        </select>
      </label>
      <label className="block text-sm font-semibold">{t.distal}
        <select className={fieldClass} value={m01.distal ?? ""} onChange={(e) => setM01({ ...m01, distal: (e.target.value || null) as typeof m01.distal })}>
          <option value="">—</option>
          {DISTAL_AREAS.map((k) => <option key={k} value={k}>{t.distalOptions[k]}</option>)}
        </select>
      </label>
      <div role="radiogroup" aria-label={t.neuro} className="sm:col-span-3">
        <p className="text-sm font-semibold">{t.neuro}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {NEURO_STATES.map((k) => <button key={k} type="button" role="radio" aria-checked={m01.neuro === k} onClick={() => setM01({ ...m01, neuro: k })}
            className={toggleClass(m01.neuro === k, (k === "WORSE" || k === "NEW") && m01.neuro === k ? "border-danger bg-danger" : undefined)}>{t.neuroOptions[k]}</button>)}
        </div>
      </div>
    </section> : null}

    {cardSides(card).map((side) => {
      const s = sides[side];
      return <fieldset key={side} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
        <legend className="px-1 text-base font-extrabold">{t.sides[side]}</legend>
        {card.items.map(({ item, label }) => {
          const key = `${side}:${item}`;
          const b = blocks[key];
          const itemLabel = pick(label, locale);
          return <div key={key} className="space-y-3">
            {itemLabel ? <p className="text-sm font-bold">{itemLabel}</p> : null}
            <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
              <input type="checkbox" className="h-5 w-5 accent-accent" checked={b.notDone}
                onChange={(e) => setBlock(key, { notDone: e.target.checked, reason: e.target.checked ? b.reason : null })} />
              {t.notDone}{itemLabel ? ` — ${itemLabel}` : side !== "BOTH" ? ` — ${t.sides[side]}` : ""}
            </label>
            {b.notDone ? <div className="flex flex-wrap gap-2" role="group" aria-label={t.notDone}>
              {CHOSEN_NOT_DONE_REASONS.map((r) => <button key={r} type="button" aria-pressed={b.reason === r} onClick={() => setBlock(key, { reason: r })}
                className={toggleClass(b.reason === r)}>{t.notDoneReasons[r]}</button>)}
            </div> : <div className="grid gap-3 sm:grid-cols-2">
              {Array.from({ length: card.trials }, (_, i) => <div key={i} className="space-y-2">
                {card.measure?.unit ? <label className="block text-sm font-semibold">
                  {(card.trials > 1 ? fmt(t.trial, { n: i + 1 }) : itemLabel || t.value) + (unit ? ` (${unit.replace("/", "0–")})` : "")}
                  <input type="number" inputMode="decimal" min={card.measure.min} max={card.measure.max} step={card.measure.step} className={fieldClass}
                    value={b.values[i]} disabled={!!b.categories[i]}
                    onChange={(e) => setBlock(key, { values: b.values.map((v, j) => (j === i ? e.target.value : v)) })} />
                </label> : null}
                {card.measure?.categories ? <label className="block text-sm font-semibold">{t.orCategory}
                  <select className={fieldClass} value={b.categories[i]} onChange={(e) => setBlock(key, { categories: b.categories.map((v, j) => (j === i ? e.target.value : v)) })}>
                    <option value="">{t.noCategory}</option>
                    {card.measure.categories.map((c) => <option key={c.id} value={c.id}>{pick(c.label, locale)}</option>)}
                  </select>
                </label> : null}
              </div>)}
            </div>}
          </div>;
        })}

        {card.painCheck ? <>
          <div className="grid gap-3 sm:grid-cols-2">
            <PainSelect label={t.painBefore} value={s.painBefore} onChange={(v) => setSide(side, { painBefore: v })} />
            <PainSelect label={t.painAfter} value={s.painAfter} onChange={(v) => setSide(side, { painAfter: v })} />
          </div>
          <div role="radiogroup" aria-label={`${t.radiation} — ${t.sides[side]}`}>
            <p className="text-sm font-semibold">{t.radiation}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {RADIATION.map((r) => <button key={r} type="button" role="radio" aria-checked={s.radiation === r} onClick={() => setSide(side, { radiation: r })}
                className={toggleClass(s.radiation === r, r === "LOWER_OR_STRONGER" && s.radiation === r ? "border-danger bg-danger" : undefined)}>{t.radiationOptions[r]}</button>)}
            </div>
          </div>
          <div role="group" aria-label={`${t.stopSignsTitle} — ${t.sides[side]}`}>
            <p className="text-sm font-semibold">{t.stopSignsTitle}</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {STOP_SIGNS.filter((x) => x !== "RADIATION_LOWER_STRONGER").map((x) => {
                const on = s.signs.includes(x);
                return <button key={x} type="button" aria-pressed={on} onClick={() => setSide(side, { signs: on ? s.signs.filter((y) => y !== x) : [...s.signs, x] })}
                  className={toggleClass(on, on ? "border-danger bg-danger" : undefined)}>{t.stopSigns[x]}</button>;
              })}
            </div>
            <p className="mt-1 text-xs text-ink-3">{t.stopSignNote}</p>
          </div>
        </> : null}

        {card.details.map((d) => <label key={d} className="flex items-start gap-3 text-sm">
          <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={!!s.details[d]}
            onChange={(e) => setSide(side, { details: { ...s.details, [d]: e.target.checked } })} />
          {t.details[d]}
        </label>)}
      </fieldset>;
    })}

    <label className="block text-sm font-semibold">{t.note}
      <textarea className={fieldClass} rows={2} maxLength={2000} value={note} onChange={(e) => setNote(e.target.value)} />
    </label>
    {message ? <Notice tone={message.tone}>{message.text}</Notice> : null}
    {ended ? null : <button type="button" disabled={pending} className={buttonClass("primary", "lg", "w-full sm:w-auto")} onClick={() => send(entries())}>
      {pending ? t.saving : t.save}
    </button>}
  </div>;
}
