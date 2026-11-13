import Link from "next/link";
import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { cn } from "@/components/ui/cn";
import { buttonClass, linkClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { IconNext } from "@/components/ui/icons";
import { PAGE_ICONS } from "@/components/layout/nav-icons";
import { QuickSessionForm } from "@/components/training/session-actions";
import { PastTrainingForm } from "@/components/training/training-free-forms";
import { requireViewer } from "@/lib/auth/viewer";
import { listCoachSessions } from "@/lib/data/coach-sessions";
import { listGymsWithFavourites } from "@/lib/data/gyms";
import { listOutdoorAreas, listOutdoorSites } from "@/lib/data/outdoor";
import { listTrainingSessions } from "@/lib/data/training-sessions";
import { formatDate } from "@/lib/format";
import { areasDictionary } from "@/lib/i18n/areas";
import { getI18n } from "@/lib/i18n/server";
import { trainingSessionDictionary } from "@/lib/i18n/training-session";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { localDate_ } from "@/lib/training/sessions";
import { StartSession } from "./start-session";

export const metadata = { title: "Nouvelle séance" };

/**
 * Nouvelle séance: one entry point for both kinds. Grimpe opens the venue
 * picker (or the live climbing séance); Entraînement offers the programme's
 * next séances, then a one-off séance (template, method or none).
 */
export default async function NewSessionPage({ searchParams }: PageProps<"/session/new">) {
  const viewer = await requireViewer();
  const sp = await searchParams;
  const { t: common, locale } = await getI18n(viewer.profile.preferred_language);
  const a = areasDictionary(locale).newSession;
  const kind = sp.kind === "train" || typeof sp.coach === "string" || typeof sp.method === "string" ? "train" : "climb";

  const kindSwitch = (
    <nav aria-label={a.kind} className={cn(segmentGroupClass, "mb-5 grid-cols-2")}>
      {(["climb", "train"] as const).map((k) => (
        <Link key={k} href={k === "climb" ? "/session/new" : "/session/new?kind=train"} aria-current={kind === k ? "page" : undefined}
          className={segmentClass(kind === k, "inline-flex items-center justify-center")}>
          {k === "climb" ? a.climb : a.training}
        </Link>
      ))}
    </nav>
  );

  if (kind === "climb") {
    const { data: live } = await viewer.supabase.from("sessions").select("id").is("ended_at", null).maybeSingle();
    if (live) redirect(`/session/${live.id}`);
    const [{ gyms, favouriteIds }, areas, sites, { data: last }] = await Promise.all([
      listGymsWithFavourites(viewer.supabase, viewer.userId),
      listOutdoorAreas(viewer.supabase),
      listOutdoorSites(viewer.supabase),
      viewer.supabase
        .from("sessions")
        .select("gyms(external_provider)")
        .order("started_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const where = sp.where;
    const initialTab =
      where === "past" ? "past" : where === "board" ? "board"
      : where === "outdoor" || (where !== "gym" && last?.gyms?.external_provider) ? "outdoor" : "gym";
    return (
      <div>
        <PageHeader icon={<PAGE_ICONS.newSession />} title={common.session.newTitle} subtitle={common.session.whereToday} />
        {kindSwitch}
        <StartSession gyms={gyms} favouriteIds={favouriteIds} areas={areas} sites={sites} initialTab={initialTab} />
      </div>
    );
  }

  const t = trainingSessionDictionary(locale);
  const today = localDate_(new Date());
  const [sessions, coachSessions] = await Promise.all([listTrainingSessions(viewer.supabase, 100), listCoachSessions(viewer.supabase)]);
  const presetMethod = typeof sp.coach === "string" && coachSessions.some((s) => s.id === sp.coach) ? "coach:" + sp.coach
    : typeof sp.method === "string" && METHODS_FOR_PLANS.some((m) => m.id === sp.method) ? sp.method : "";
  const live = (sessions ?? []).filter((s) => s.status === "IN_PROGRESS" || s.status === "INTERRUPTED");
  const fromProgramme = (sessions ?? []).filter((s) => s.status === "PLANNED" && s.planId && (s.scheduledDate ?? today) >= today)
    .sort((x, y) => (x.scheduledDate ?? "").localeCompare(y.scheduledDate ?? "") || (x.scheduledTime ?? "").localeCompare(y.scheduledTime ?? ""))
    .slice(0, 3);
  const row = "flex min-h-16 items-center justify-between gap-3 rounded-2xl border border-line bg-surface p-4 transition-colors hover:border-accent";

  return (
    <div className="space-y-6">
      <div>
        <PageHeader icon={<PAGE_ICONS.newSession />} title={a.title} subtitle={a.subtitle} />
        {kindSwitch}
      </div>
      {sessions === null ? <p role="alert" className="rounded-xl border border-warn p-4 text-sm">{t.error}</p> : null}

      {live.length ? <section aria-labelledby="live-heading" className="space-y-3">
        <h2 id="live-heading" className="text-lg font-bold">{t.inProgress}</h2>
        <ul className="space-y-2">{live.map((s) => <li key={s.id}>
          <Link href={"/train/sessions/" + s.id} className={row}>
            <strong className="line-clamp-2 min-w-0">{s.title}</strong>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-accent">{t.resume} <IconNext /></span>
          </Link>
        </li>)}</ul>
      </section> : null}

      {fromProgramme.length ? <section aria-labelledby="programme-heading" className="space-y-3">
        <div>
          <h2 id="programme-heading" className="text-lg font-bold">{a.fromProgramme}</h2>
          <p className="text-sm text-ink-2">{a.fromProgrammeHint}</p>
        </div>
        <ul className="space-y-2">{fromProgramme.map((s) => <li key={s.id}>
          <Link href={"/train/sessions/" + s.id} className={row}>
            <span className="min-w-0">
              <strong className="line-clamp-2 block">{s.title}</strong>
              <span className="text-xs text-ink-2">
                {s.scheduledDate ? formatDate(s.scheduledDate + "T12:00:00", locale, { weekday: "short", day: "numeric", month: "short" }) : ""}
                {s.scheduledTime ? " · " + s.scheduledTime : ""}
                {s.plannedMinutes ? ` · ${s.plannedMinutes} ${t.minutesShort}` : ""}
              </span>
            </span>
            <span className="shrink-0 whitespace-nowrap text-sm font-bold text-accent">{t.open} <IconNext /></span>
          </Link>
        </li>)}</ul>
      </section> : null}

      <section aria-labelledby="new-heading" className="leblond-premium-surface p-5 sm:p-6">
        <h2 id="new-heading" className="text-lg font-bold">{a.oneOff}</h2>
        <p className="mt-1 text-sm text-ink-2">{a.oneOffHint}</p>
        <div className="mt-4"><QuickSessionForm key={presetMethod} locale={locale} today={today} presetMethod={presetMethod}
          coachSessions={coachSessions.map((s) => ({ id: s.id, title: s.title, minutes: s.minutes }))} /></div>
        <p className="mt-4 text-sm"><Link href="/atlas#templates-heading" className={linkClass}>{a.templates} <IconNext /></Link></p>
      </section>

      <section aria-labelledby="past-training" className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
        <h2 id="past-training" className="text-lg font-bold">{a.pastTraining}</h2>
        <p className="mt-1 text-sm text-ink-2">{t.pastHint}</p>
        <div className="mt-4"><PastTrainingForm locale={locale} today={today} /></div>
      </section>

      <section aria-labelledby="mobility-link" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 id="mobility-link" className="flex items-center gap-2 text-base font-bold"><PAGE_ICONS.mobility aria-hidden="true" className="size-5 text-accent" />{a.mobility}</h2>
          <p className="mt-1 text-sm text-ink-2">{a.mobilityHint}</p>
        </div>
        <Link href="/train/mobility" className={buttonClass("secondary", "md", "shrink-0")}>{a.mobility} <IconNext /></Link>
      </section>
    </div>
  );
}
