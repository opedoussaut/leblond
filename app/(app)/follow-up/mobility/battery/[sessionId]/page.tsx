import Link from "next/link";
import { notFound } from "next/navigation";
import { BatteryD1Form } from "@/components/training/battery-session-actions";
import { rawText, SelfReportedBadge } from "@/components/training/battery-parts";
import { buttonClass, chipClass, linkClass } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/card";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { IconBack, IconNext } from "@/components/ui/icons";
import { d1Open, sessionProgress } from "@/lib/analytics/mobility-battery";
import { requireViewer } from "@/lib/auth/viewer";
import { loadBatterySession } from "@/lib/data/mobility-battery";
import { formatDate } from "@/lib/format";
import { fmt } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { getI18n } from "@/lib/i18n/server";
import { CARDS, cardSides } from "@/lib/training/mobility-battery/cards";
import { localDate_, pick } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Mobility assessment result" };

/** Result screen: every card's raw values, not-done reasons, symptoms and the D+1 check. No score. */
export default async function BatteryResultPage({ params }: PageProps<"/follow-up/mobility/battery/[sessionId]">) {
  const { sessionId } = await params;
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const t = batteryDictionary(locale);
  const loaded = await loadBatterySession(viewer.supabase, sessionId);
  if (!loaded) notFound();
  const { session, results } = loaded;
  const date = formatDate(session.startedOn + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" });
  const progress = sessionProgress(results);
  const c = session.conditions;
  const conditions = [
    c.chairHeightCm !== null ? `${t.chairShort} ${c.chairHeightCm} cm` : null,
    c.shoes ? t.shoesOptions[c.shoes] : null, c.warmUp ? t.warmUpOptions[c.warmUp] : null, c.timeOfDay ? t.timeOptions[c.timeOfDay] : null,
    c.framing || null, session.kneePainToday ? t.kneePain : null,
  ].filter(Boolean);
  const d1Alert = session.d1 && (session.d1.radiationLower || session.d1.newSymptoms);

  return <div className="space-y-6">
    <p className="text-sm"><Link href="/follow-up/mobility/battery" className={linkClass}><IconBack /> {t.historyTitle}</Link></p>
    <PageHeader icon={<PAGE_ICONS.mobility />} title={`${t.resultTitle} — ${date}`} subtitle={fmt(t.progress, progress)} action={<SelfReportedBadge locale={locale} />} />

    <div className="flex flex-wrap items-center gap-2">
      <span className={chipClass(session.status === "STOPPED" ? "warn" : session.status === "COMPLETED" ? "ok" : "accent")}>{t.statuses[session.status]}</span>
      {session.stopReason ? <span className="text-sm text-ink-2">{t.stopReasons[session.stopReason]}</span> : null}
    </div>
    {session.status === "IN_PROGRESS" ? <Link href={`/train/mobility/battery/${session.id}`} className={buttonClass("primary", "md")}>{t.resume} <IconNext /></Link> : null}
    {session.stopReason === "NEURO_WORSE" || session.stopReason === "SYMPTOM" ? <div role="alert" className="rounded-2xl border border-danger/40 bg-danger/10 p-4 text-sm">
      {session.stopReason === "NEURO_WORSE" ? t.neuroStopText : t.symptomStopText}
    </div> : null}
    <p className="text-sm text-ink-2">{t.notDiagnosis} {t.noScore}</p>

    <section aria-labelledby="cond-heading" className="rounded-2xl border border-line bg-surface p-5">
      <h2 id="cond-heading" className="text-base font-bold">{t.conditionsTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{conditions.length ? conditions.join(" · ") : t.notRecorded}</p>
      {session.clinicalReviewOn ? <p className="mt-1 text-sm text-ink-2">{t.clinicalReviewShort}{t.colon}{formatDate(session.clinicalReviewOn + "T12:00:00", locale, { day: "numeric", month: "long", year: "numeric" })}</p> : null}
    </section>

    <section aria-labelledby="cards-heading" className="space-y-3">
      <h2 id="cards-heading" className="text-lg font-bold">{t.cardsTitle}</h2>
      {CARDS.map((card) => {
        const rows = results.filter((r) => r.cardId === card.id);
        return <article key={card.id} aria-label={`${card.id} · ${pick(card.name, locale)}`} className="rounded-2xl border border-line bg-surface p-4">
          <h3 className="text-sm font-bold"><span className="tabular-nums text-ink-3">{card.id}</span> · {pick(card.name, locale)}</h3>
          {!rows.length ? <p className="mt-1 text-sm text-ink-3">{t.notTouched}</p>
            : card.access === "clinician_only" ? <div className="mt-1 space-y-1 text-sm">
              <p className="text-xs text-ink-3">{t.reportedBy}</p>
              {rows[0].details.angles?.length ? <ul className="list-disc pl-5">{rows[0].details.angles.map((a, i) => <li key={i}>
                {t.moves[a.move]} · {t.sides[a.side]} · {t.modes[a.mode]}{t.colon}{a.degrees}°</li>)}</ul> : null}
              {rows[0].note ? <p className="whitespace-pre-line">{rows[0].note}</p> : null}
            </div>
            : <ul className="mt-1 space-y-1 text-sm">
              {cardSides(card).flatMap((side) => card.items.map(({ item, label }) => {
                const rs = rows.filter((r) => r.side === side && r.item === item).sort((a, b) => a.trial - b.trial);
                if (!rs.length) return null;
                const head = [card.sides === "LR" ? t.sides[side] : "", pick(label, locale)].filter(Boolean).join(" · ");
                const pain = rs.find((r) => r.painBefore !== null || r.painAfter !== null);
                const stops = rs.flatMap((r) => r.details.stopSigns ?? []);
                return <li key={`${side}:${item}`}>
                  {head ? <strong>{head}{t.colon}</strong> : null}
                  {rs.map((r) => rawText(t, locale, card, { kind: r.status === "NOT_DONE" ? "NOT_DONE" : r.category ? "CATEGORY" : "VALUE", value: r.value, unit: r.unit, category: r.category, notDoneReason: r.notDoneReason })).join(" / ")}
                  {pain ? <span className="text-ink-3"> · {t.painBeforeAfter} {pain.painBefore ?? "—"} → {pain.painAfter ?? "—"}</span> : null}
                  {rs[0].radiation && rs[0].radiation !== "NONE" ? <span className="text-ink-3"> · {t.radiation}{t.colon}{t.radiationOptions[rs[0].radiation].toLowerCase()}</span> : null}
                  {stops.length ? <span className="text-danger"> · {[...new Set(stops)].map((s) => t.stopSigns[s]).join(", ")}</span> : null}
                  {rs[0].details.handsUsed ? <span className="text-ink-3"> · {t.details.handsUsed}</span> : null}
                </li>;
              }))}
              {rows.find((r) => r.note) ? <li className="text-ink-3">{rows.find((r) => r.note)!.note}</li> : null}
            </ul>}
        </article>;
      })}
    </section>

    <section aria-labelledby="d1-heading" className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <h2 id="d1-heading" className="text-lg font-bold">{t.d1Title}</h2>
      {session.d1 ? <p className="text-sm">
        {t.backShort} {session.d1.backPain}/10 · {t.legShort} {session.d1.legPain}/10
        {session.d1.radiationLower ? ` · ${t.d1RadiationLower}` : ""}{session.d1.newSymptoms ? ` · ${t.d1NewSymptoms}` : ""}
      </p> : d1Open(session, localDate_(new Date())) ? <>
        <p className="text-sm text-ink-2">{t.d1Hint}</p>
        <BatteryD1Form locale={locale} sessionId={session.id} />
      </> : <p className="text-sm text-ink-2">{session.status === "IN_PROGRESS" ? t.d1Hint : t.d1NotYet}</p>}
      {d1Alert ? <div role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-3 text-sm">{t.d1Alert}</div> : null}
    </section>
    <p className="text-xs text-ink-3">{t.privateNote}</p>
  </div>;
}
