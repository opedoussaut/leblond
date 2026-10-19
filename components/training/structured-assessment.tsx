"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";
import { addCalendarEntry } from "@/lib/actions/calendar";
import { createTrainingAssessment } from "@/lib/actions/training-assessments";
import type { Locale } from "@/lib/i18n";
import { trainingDictionary } from "@/lib/i18n/training";
import { DEFAULT_SKILLS, methodMatches, type SavedAssessment, type SkillRatings } from "@/lib/training/assessment";
import {
  EVIDENCE_LABELS, OBSERVED_LABELS, PROTOCOL_TESTS, PROTOCOL_VERSION, measurementQuality, reassessmentDate, testAllowed,
  type AssessmentContext, type EvidenceLevel, type Measurement, type ObservedEvidence,
} from "@/lib/training/assessment-protocol";
import { METHODS_FOR_PLANS, TRAINING_AXES } from "@/lib/training/catalogue";
import { SkillSliders } from "./assessment-workspace";

const field = "mt-1 block w-full rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-ink";
const OPTIONS = [4, 8, 12, 16, 24];

export function EvidenceBadge({ level, locale }: { level: EvidenceLevel; locale: Locale }) {
  const tone = level === "measured" ? "bg-accent text-accent-ink" : level === "observed" ? "bg-accent-soft text-accent"
    : level === "insufficient" ? "border border-dashed border-line text-ink-3" : "bg-surface-2 text-ink-2";
  return <span title={EVIDENCE_LABELS[level].hint[locale]} className={"inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold " + tone}>
    {EVIDENCE_LABELS[level][locale]}
  </span>;
}

type Props = {
  locale: Locale; today: string; observed: ObservedEvidence[];
  defaults: { discipline: "BOULDER" | "ROUTE" | "BOTH"; sessionsPerWeekNow: number };
  onSaved: (record: SavedAssessment) => void; onCancel?: () => void;
};

export function StructuredAssessment({ locale, today, observed, defaults, onSaved, onCancel }: Props) {
  const fr = locale === "fr";
  const t = trainingDictionary(locale);
  const [step, setStep] = useState(0);
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);
  const [ctx, setCtx] = useState<Omit<AssessmentContext, "observed">>({
    discipline: defaults.discipline, experienceMonths: 24, sessionsPerWeekNow: defaults.sessionsPerWeekNow,
    currentPain: false, rested24h: true, warmedUp: false, venue: "", notes: "",
  });
  const [goal, setGoal] = useState("");
  const [horizon, setHorizon] = useState(12);
  const [frequency, setFrequency] = useState(Math.max(1, Math.min(5, defaults.sessionsPerWeekNow || 2)));
  const [values, setValues] = useState<Record<string, string>>({});
  const [conditions, setConditions] = useState<Record<string, string>>({});
  const [ratings, setRatings] = useState<SkillRatings>({ ...DEFAULT_SKILLS });
  const [methodId, setMethodId] = useState("");
  const [addReassessment, setAddReassessment] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  useEffect(() => {
    if (first.current) { first.current = false; return; }
    heading.current?.focus();
  }, [step]);

  const set = <K extends keyof typeof ctx>(k: K, v: (typeof ctx)[K]) => setCtx((c) => ({ ...c, [k]: v }));
  const measurements: Measurement[] = PROTOCOL_TESTS.flatMap((test) => {
    const raw = values[test.id];
    if (!testAllowed(test, ctx) || raw === undefined || raw.trim() === "" || !Number.isFinite(Number(raw))) return [];
    const value = Math.max(test.min, Math.min(test.max, Number(raw)));
    const cond = conditions[test.id] ?? "";
    return [{ id: test.id, value, unit: test.unit, evidence: "measured" as const, protocolVersion: PROTOCOL_VERSION,
      date: today, conditions: cond, quality: measurementQuality(cond, ctx) }];
  });
  const matches = methodMatches(ratings);
  const chosen = methodId || matches[0]?.method.id || "technique";
  const nextCheck = reassessmentDate(today, horizon);

  const steps = [
    fr ? "Préparation et sécurité" : "Preparation and safety",
    fr ? "Objectif et temps disponible" : "Goal and available time",
    fr ? "Conditions de référence" : "Reference conditions",
    fr ? "Tests mesurés" : "Measured tests",
    fr ? "Auto-évaluation" : "Self-evaluation",
    fr ? "Résultats et qualité des données" : "Results and data quality",
    fr ? "Priorités de progression" : "Development priorities",
    fr ? "Options d’entraînement" : "Training options",
    fr ? "Prochain bilan" : "Reassessment",
  ];

  function save() {
    if (!confirmed) return;
    setError("");
    start(async () => {
      const context: AssessmentContext = { ...ctx, observed };
      const input = {
        methodId: chosen, ratings, horizonWeeks: horizon, sessionsPerWeek: frequency, goal,
        kind: measurements.length ? "STRUCTURED" as const : "BASIC" as const, measurements, context,
      };
      const r = await createTrainingAssessment(input);
      if (!r.ok) { setError(fr ? "Impossible d’enregistrer le bilan." : "Could not save the assessment."); return; }
      if (addReassessment) {
        await addCalendarEntry({
          eventDate: nextCheck, startTime: "", title: fr ? "Bilan de suivi LEBLOND" : "LEBLOND follow-up assessment",
          kind: "ASSESS", discipline: ctx.discipline, minutes: 60, methodId: null,
          notes: fr ? "Reprendre le même protocole et les mêmes conditions." : "Repeat the same protocol and conditions.",
        });
      }
      onSaved({ id: r.id, ...input, createdAt: new Date().toISOString() });
    });
  }

  const yesNo = (name: string, value: boolean, onChange: (v: boolean) => void, label: string) =>
    <fieldset className="rounded-xl border border-line bg-surface p-3">
      <legend className="px-1 text-sm font-semibold">{label}</legend>
      <div className="mt-1 flex gap-2">
        {[true, false].map((v) => <label key={String(v)} className={"flex min-h-11 flex-1 cursor-pointer items-center justify-center rounded-lg border text-sm font-bold " +
          (value === v ? "border-accent bg-accent-soft text-accent" : "border-line")}>
          <input type="radio" className="sr-only" name={name} checked={value === v} onChange={() => onChange(v)} />
          {v ? (fr ? "Oui" : "Yes") : (fr ? "Non" : "No")}
        </label>)}
      </div>
    </fieldset>;

  return <section aria-labelledby="protocol-step" className="space-y-5">
    <div className="rounded-[1.5rem] border border-accent/25 bg-accent-soft p-4">
      <p className="text-xs font-extrabold uppercase tracking-[0.13em] text-accent">
        {fr ? `Protocole LEBLOND v${PROTOCOL_VERSION} · étape ${step + 1} sur ${steps.length}` : `LEBLOND protocol v${PROTOCOL_VERSION} · step ${step + 1} of ${steps.length}`}
      </p>
      <ol className="mt-3 flex gap-1" aria-hidden="true">
        {steps.map((_, i) => <li key={i} className={"h-1.5 flex-1 rounded-full " + (i <= step ? "bg-accent" : "bg-accent/15")} />)}
      </ol>
    </div>
    <h2 id="protocol-step" ref={heading} tabIndex={-1} className="text-2xl font-black tracking-tight focus:outline-none">{steps[step]}</h2>

    {step === 0 ? <div className="space-y-4">
      <p className="text-sm leading-relaxed text-ink-2">{fr
        ? "Ce bilan combine trois sources clairement séparées : quelques tests simples et sûrs (mesurés), tes séances enregistrées (observées) et ton auto-évaluation (déclarative). Aucun test maximal n’est demandé ; chaque test est facultatif."
        : "This assessment combines three clearly separated sources: a few simple, safe tests (measured), your logged sessions (observed) and your self-evaluation (self-reported). No maximal test is required; every test is optional."}</p>
      <label className="block text-sm font-semibold">{fr ? "Depuis combien de mois grimpes-tu régulièrement ?" : "How many months have you climbed regularly?"}
        <input className={field} type="number" min={0} max={900} value={ctx.experienceMonths} onChange={(e) => set("experienceMonths", Math.max(0, Math.round(Number(e.target.value))))} />
      </label>
      {yesNo("pain", ctx.currentPain, (v) => set("currentPain", v), fr ? "As-tu actuellement une douleur ou une blessure (doigts, coudes, épaules) ?" : "Do you currently have pain or an injury (fingers, elbows, shoulders)?")}
      {ctx.currentPain ? <p role="note" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">{fr
        ? "Les tests sollicitant les doigts et les tractions sont désactivés. Consulte un professionnel de santé si la douleur persiste."
        : "Finger-loading and pulling tests are disabled. See a health professional if the pain persists."}</p> : null}
      {yesNo("rested", ctx.rested24h, (v) => set("rested24h", v), fr ? "Es-tu reposé (pas d’entraînement intense depuis 24 h) ?" : "Are you rested (no hard training in the last 24 h)?")}
      {yesNo("warm", ctx.warmedUp, (v) => set("warmedUp", v), fr ? "As-tu fait un échauffement complet (général + doigts) ?" : "Have you completed a full warm-up (general + fingers)?")}
    </div> : null}

    {step === 1 ? <div className="grid gap-4 sm:grid-cols-2">
      <label className="block text-sm font-semibold">{fr ? "Discipline" : "Discipline"}
        <select className={field} value={ctx.discipline} onChange={(e) => set("discipline", e.target.value as AssessmentContext["discipline"])}>
          <option value="BOULDER">{fr ? "Bloc" : "Bouldering"}</option>
          <option value="ROUTE">{fr ? "Voie" : "Sport climbing"}</option>
          <option value="BOTH">{fr ? "Les deux" : "Both"}</option>
        </select>
      </label>
      <label className="block text-sm font-semibold">{fr ? "Séances de grimpe par semaine actuellement" : "Climbing sessions per week now"}
        <input className={field} type="number" min={0} max={14} value={ctx.sessionsPerWeekNow} onChange={(e) => set("sessionsPerWeekNow", Math.max(0, Math.min(14, Math.round(Number(e.target.value)))))} />
      </label>
      <label className="block text-sm font-semibold sm:col-span-2">{fr ? "Objectif (ex. réussir un 7A en bloc)" : "Goal (e.g. send a 7A boulder)"}
        <input className={field} maxLength={300} value={goal} onChange={(e) => setGoal(e.target.value)} />
      </label>
      <label className="block text-sm font-semibold">{fr ? "Séances d’entraînement possibles / semaine" : "Training sessions available / week"}
        <select className={field} value={frequency} onChange={(e) => setFrequency(Number(e.target.value))}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
      <label className="block text-sm font-semibold">{fr ? "Période (semaines)" : "Period (weeks)"}
        <select className={field} value={horizon} onChange={(e) => setHorizon(Number(e.target.value))}>{OPTIONS.map((n) => <option key={n} value={n}>{n}</option>)}</select>
      </label>
    </div> : null}

    {step === 2 ? <div className="space-y-4">
      <p className="text-sm text-ink-2">{fr
        ? "Pour comparer deux bilans, garde les mêmes conditions : lieu, matériel, moment de la journée, état de repos. Note-les ici."
        : "To compare two assessments, keep the same conditions: venue, equipment, time of day, rest. Record them here."}</p>
      <label className="block text-sm font-semibold">{fr ? "Lieu" : "Venue"}
        <input className={field} maxLength={120} value={ctx.venue} onChange={(e) => set("venue", e.target.value)} />
      </label>
      <label className="block text-sm font-semibold">{fr ? "Conditions (matériel, heure, ressenti)" : "Conditions (equipment, time, how you feel)"}
        <textarea className={field} rows={3} maxLength={500} value={ctx.notes} onChange={(e) => set("notes", e.target.value)} />
      </label>
      <p className="text-xs text-ink-3">{fr ? "Date du bilan" : "Assessment date"} : {today}</p>
    </div> : null}

    {step === 3 ? <div className="space-y-4">
      <p className="text-sm text-ink-2">{fr
        ? "Tests facultatifs. Laisse vide pour ne pas tester. Seuls les tests adaptés à ton expérience et à ton état sont proposés."
        : "Optional tests. Leave blank to skip. Only tests suited to your experience and condition are offered."}</p>
      {PROTOCOL_TESTS.map((test) => {
        const allowed = testAllowed(test, ctx);
        return <article key={test.id} className={"rounded-2xl border p-4 " + (allowed ? "border-line bg-surface" : "border-dashed border-line bg-surface-2")}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-base font-extrabold">{test.name[locale]}</h3>
            <span className="text-xs font-semibold text-ink-3">{t.axis[test.dimension]} · {test.unit}</span>
          </div>
          <p className="mt-1 text-sm text-ink-2">{test.rationale[locale]}</p>
          <details className="mt-2"><summary className="min-h-10 cursor-pointer text-sm font-bold text-accent">{fr ? "Procédure" : "Procedure"}</summary>
            <p className="mt-1 text-xs text-ink-2"><strong>{fr ? "Matériel" : "Equipment"} :</strong> {test.equipment[locale]}</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-ink-2">{test.procedure.map((p, i) => <li key={i}>{p[locale]}</li>)}</ol>
            <p className="mt-2 text-sm"><strong>{fr ? "Arrêt / contre-indications" : "Stop rules"} :</strong> {test.stopRules[locale]}</p>
            {test.reference ? <a className="mt-2 inline-block text-xs font-semibold text-accent underline" href={test.reference.url} target="_blank" rel="noopener noreferrer">{test.reference.label} ↗</a> : null}
          </details>
          {allowed ? <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-sm font-semibold">{fr ? "Résultat" : "Result"} ({test.unit}, {test.min}–{test.max})
              <input className={field} type="number" inputMode="decimal" min={test.min} max={test.max} value={values[test.id] ?? ""}
                onChange={(e) => setValues((v) => ({ ...v, [test.id]: e.target.value }))} />
            </label>
            <label className="text-sm font-semibold">{fr ? "Conditions du test" : "Test conditions"}
              <input className={field} maxLength={300} value={conditions[test.id] ?? ""} placeholder={fr ? "ex. Beastmaker 20 mm, 18 h" : "e.g. Beastmaker 20 mm, 6 pm"}
                onChange={(e) => setConditions((c) => ({ ...c, [test.id]: e.target.value }))} />
            </label>
          </div> : <p className="mt-3 text-sm font-semibold text-ink-3">{test.stopRules[locale]}</p>}
        </article>;
      })}
    </div> : null}

    {step === 4 ? <div className="space-y-3">
      <p className="text-sm text-ink-2">{fr
        ? "Pour les qualités qui ne sont pas mesurées ici (lecture, gestion de l’engagement, régularité), ton ressenti reste utile. Il est enregistré comme déclaratif, jamais comme une mesure."
        : "For qualities not measured here (reading, commitment, consistency), your own judgement is useful. It is stored as self-reported, never as a measurement."}</p>
      <SkillSliders locale={locale} ratings={ratings} onChange={setRatings} />
    </div> : null}

    {step === 5 ? <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
        <table className="w-full min-w-[560px] text-left text-sm">
          <caption className="sr-only">{steps[5]}</caption>
          <thead className="text-xs uppercase tracking-wider text-ink-3"><tr>
            <th className="px-4 py-3">{fr ? "Dimension" : "Dimension"}</th><th className="px-4 py-3">{fr ? "Valeur" : "Value"}</th>
            <th className="px-4 py-3">{fr ? "Source" : "Source"}</th><th className="px-4 py-3">{fr ? "Qualité" : "Quality"}</th></tr></thead>
          <tbody>
            {measurements.map((m) => { const def = PROTOCOL_TESTS.find((d) => d.id === m.id)!; return <tr key={m.id} className="border-t border-line">
              <td className="px-4 py-3 font-semibold">{def.name[locale]}</td><td className="px-4 py-3 tabular-nums">{m.value} {m.unit}</td>
              <td className="px-4 py-3"><EvidenceBadge level="measured" locale={locale} /></td>
              <td className="px-4 py-3 text-xs">{m.quality === "complete" ? (fr ? "Conditions complètes" : "Complete conditions") : (fr ? "Conditions partielles" : "Partial conditions")}</td>
            </tr>; })}
            {observed.map((o) => <tr key={o.id} className="border-t border-line">
              <td className="px-4 py-3 font-semibold">{OBSERVED_LABELS[o.id]?.[locale] ?? o.id}</td><td className="px-4 py-3 tabular-nums">{o.value}</td>
              <td className="px-4 py-3"><EvidenceBadge level={o.evidence} locale={locale} /></td>
              <td className="px-4 py-3 text-xs">n = {o.sample}</td>
            </tr>)}
            {TRAINING_AXES.map((axis) => <tr key={axis} className="border-t border-line">
              <td className="px-4 py-3 font-semibold">{t.axis[axis]}</td><td className="px-4 py-3 tabular-nums">{ratings[axis].toFixed(1)} / 5</td>
              <td className="px-4 py-3"><EvidenceBadge level="self" locale={locale} /></td><td className="px-4 py-3 text-xs">{fr ? "Échelle ancrée 1–5" : "Anchored 1–5 scale"}</td>
            </tr>)}
          </tbody>
        </table>
      </div>
      {measurements.length === 0 ? <p className="text-sm text-ink-2">{fr ? "Aucun test mesuré : ce bilan sera enregistré comme bilan de base." : "No measured test: this will be saved as a basic assessment."}</p> : null}
      <p className="text-xs text-ink-3">{fr
        ? "Les valeurs ne sont pas additionnées en un score unique : chaque source garde son niveau de preuve."
        : "Values are not combined into a single score: each source keeps its own evidence level."}</p>
    </div> : null}

    {step === 6 ? <div className="space-y-3">
      <p className="text-sm text-ink-2">{fr
        ? "Priorités proposées à partir de tes écarts déclarés (plus la note est basse, plus la qualité ressort). C’est une heuristique d’orientation, pas un diagnostic."
        : "Priorities suggested from your self-reported gaps (lower ratings stand out more). This is a guidance heuristic, not a diagnosis."}</p>
      <ul className="space-y-2">
        {[...TRAINING_AXES].sort((a, b) => ratings[a] - ratings[b]).slice(0, 3).map((axis) => <li key={axis} className="rounded-xl border border-line bg-surface p-3 text-sm">
          <strong>{t.axis[axis]}</strong> — {ratings[axis].toFixed(1)} / 5
          {measurements.filter((m) => PROTOCOL_TESTS.find((d) => d.id === m.id)?.dimension === axis).map((m) =>
            <span key={m.id} className="ml-2 text-xs text-ink-2">· {PROTOCOL_TESTS.find((d) => d.id === m.id)!.name[locale]} : {m.value} {m.unit}</span>)}
        </li>)}
      </ul>
    </div> : null}

    {step === 7 ? <div className="space-y-3">
      <p className="text-sm text-ink-2">{fr
        ? `Méthodes qui correspondent à tes priorités, compte tenu de ${frequency} séance(s) par semaine. Choisis celle qui servira de scénario.`
        : `Methods matching your priorities, given ${frequency} session(s) per week. Choose the one used for the scenario.`}</p>
      <div className="grid gap-3 sm:grid-cols-3">
        {matches.map(({ method, priority }) => {
          const finger = ["max-hangs", "repeaters", "campus"].includes(method.id);
          const caution = finger && (ctx.experienceMonths < 24 || ctx.currentPain);
          return <button type="button" key={method.id} onClick={() => setMethodId(method.id)} aria-pressed={chosen === method.id}
            className={"rounded-2xl border p-4 text-left " + (chosen === method.id ? "border-accent bg-accent-soft" : "border-line bg-surface")}>
            <strong className="block">{method.title}</strong>
            <span className="mt-1 block text-xs text-ink-2">{fr ? "Cible" : "Targets"} : {t.axis[priority]}</span>
            {caution ? <span className="mt-1 block text-xs font-semibold text-danger">{fr ? "Prudence : peu adapté à ton expérience ou ton état actuel." : "Caution: not well suited to your experience or current condition."}</span> : null}
          </button>;
        })}
      </div>
      <label className="block text-sm font-semibold">{fr ? "Ou une autre méthode" : "Or another method"}
        <select className={field} value={chosen} onChange={(e) => setMethodId(e.target.value)}>
          {METHODS_FOR_PLANS.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
        </select>
      </label>
      <Link href={"/atlas/" + chosen} className="inline-block text-sm font-bold text-accent underline underline-offset-4">{fr ? "Lire la fiche Atlas" : "Read the Atlas sheet"} ↗</Link>
    </div> : null}

    {step === 8 ? <div className="space-y-4">
      <p className="text-sm text-ink-2">{fr
        ? `Prochain bilan conseillé : ${nextCheck}. Reprends le même protocole, les mêmes tests et des conditions similaires pour que la comparaison ait un sens.`
        : `Suggested next assessment: ${nextCheck}. Repeat the same protocol, tests and similar conditions so the comparison is meaningful.`}</p>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={addReassessment} onChange={(e) => setAddReassessment(e.target.checked)} />
        <span>{fr ? "Ajouter ce bilan de suivi à mon calendrier" : "Add this follow-up assessment to my calendar"}</span>
      </label>
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface p-3 text-sm">
        <input type="checkbox" className="mt-1 h-4 w-4 accent-accent" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} />
        <span>{fr ? "J’ai suivi le protocole. Je comprends que le scénario affiché ensuite est illustratif et ne prédit pas une cotation."
          : "I followed the protocol. I understand the scenario shown next is illustrative and does not predict a grade."}</span>
      </label>
      {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
      <button type="button" disabled={!confirmed || pending} onClick={save}
        className="min-h-14 w-full rounded-2xl bg-accent px-6 text-base font-black text-accent-ink disabled:opacity-50 sm:w-auto">
        {pending ? "…" : fr ? "Enregistrer mon bilan" : "Save my assessment"}
      </button>
    </div> : null}

    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-4">
      <div className="flex gap-2">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0}
          className="min-h-12 rounded-full border border-line bg-surface px-5 text-sm font-bold disabled:opacity-40">← {fr ? "Précédent" : "Back"}</button>
        {onCancel ? <button type="button" onClick={onCancel} className="min-h-12 rounded-full px-4 text-sm font-bold text-ink-2">{fr ? "Annuler" : "Cancel"}</button> : null}
      </div>
      {step < steps.length - 1 ? <button type="button" onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))}
        className="min-h-12 rounded-full bg-accent px-6 text-sm font-extrabold text-accent-ink">{fr ? "Suivant" : "Next"} →</button> : null}
    </div>
  </section>;
}
