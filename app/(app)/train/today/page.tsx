import Link from "next/link";
import { DayCheck } from "@/components/training/day-check";
import { ReplanBanner } from "@/components/training/programme-card";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { loadProgramme } from "@/lib/data/programme";
import { HIP_PROGRAMME } from "@/lib/training/hip-mobility/content";
import { getI18n } from "@/lib/i18n/server";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { painDefaults, type DayCheckInput, type DayRecommendation, type DayReason } from "@/lib/training/day-check";
import { localDate_ } from "@/lib/training/sessions";

export const metadata = { title: "LEBLOND — Daily check-in" };

export default async function DayCheckPage() {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const j = journeyDictionary(locale);
  const today = localDate_(new Date());
  const [state, { data: mobility }] = await Promise.all([
    loadProgramme(viewer.supabase, today),
    viewer.supabase.from("mobility_enrollments").select("status").eq("programme", HIP_PROGRAMME).maybeSingle(),
  ]);
  const view = state.view && !state.view.finished ? state.view : null;
  const prefill = view ? painDefaults(view.health) : [];
  const discipline = view?.discipline ?? viewer.profile.target_discipline;
  const initial: DayCheckInput = state.todayCheck?.input ?? {
    sleep: 3, fatigue: 1, soreness: 0, pain: prefill,
    minutes: 90, place: view?.next?.place === "HOME" ? "HOME" : discipline === "ROUTE" ? "ROUTE_GYM" : "BOULDER_GYM",
  };
  const saved: DayRecommendation | null = state.todayCheck ? {
    outcome: state.todayCheck.outcome, methodId: state.todayCheck.methodId, minutes: state.todayCheck.recommendedMinutes,
    place: state.todayCheck.input.place, planned: null, reasons: state.todayCheck.reasons as DayReason[],
  } : null;

  return <div className="space-y-6 pb-12">
    <Link href="/train" className="text-sm font-bold text-accent underline underline-offset-4">← {j.day.back}</Link>
    <PageHeader title={j.day.title} subtitle={j.day.subtitle} />
    {state.replan.suggested ? <ReplanBanner locale={locale} replan={state.replan} /> : null}
    <DayCheck locale={locale} today={today} initial={initial} saved={saved} hasProgramme={!!view}
      prefilledPain={!state.todayCheck && prefill.length > 0} scheduledId={state.scheduledToday?.id ?? null}
      mobilityEnrolled={!!mobility && mobility.status === "ACTIVE"} />
    <p className="text-sm text-ink-2">{j.hub.fullText} <Link href="/train/assess" className="font-bold text-accent underline underline-offset-4">{j.hub.fullTitle} →</Link></p>
  </div>;
}
