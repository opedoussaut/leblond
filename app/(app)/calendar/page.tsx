import { PageHeader } from "@/components/ui/card";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { monthBounds, type CalendarEvent, type LoggedSession } from "@/lib/calendar/schema";
import { calendarDictionary } from "@/lib/i18n/calendar";
import { METHODS_FOR_PLANS } from "@/lib/training/catalogue";
import { localDate_ } from "@/lib/training/sessions";
import type { CalendarTraining } from "@/components/calendar/calendar-workspace";

export const metadata = { title: "LEBLOND — Calendrier" };
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  // Local (Europe/Paris) month, so the first/last hours of a month never land in the wrong one.
  const thisMonth = localDate_(new Date()).slice(0,7);
  const raw = typeof sp.month === "string" ? sp.month : thisMonth;
  const month = monthBounds(raw) ? raw : thisMonth;
  const range = monthBounds(month)!;
  const [{ data: events, error }, { data: sessions }, { data: training }] = await Promise.all([
    viewer.supabase.from("calendar_entries")
      .select("id,event_date,start_time,title,kind,discipline,duration_minutes,method_id,notes,status")
      .gte("event_date", range.first).lte("event_date", range.last)
      .order("event_date").order("start_time").limit(300),
    viewer.supabase.from("sessions")
      .select("id,started_at,gyms(name)")
      .gte("started_at", range.first + "T00:00:00")
      .lt("started_at", month === "2100-12" ? "2101-01-01T00:00:00" :
        new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),1)).toISOString())
      .order("started_at").limit(200),
    viewer.supabase.from("training_sessions")
      .select("id,title,status,scheduled_date,scheduled_time,planned_minutes,actual_minutes,calendar_entry_id,completed_at,created_at")
      .or(`and(scheduled_date.gte.${range.first},scheduled_date.lte.${range.last}),and(scheduled_date.is.null,created_at.gte.${range.first}T00:00:00,created_at.lte.${range.last}T23:59:59)`)
      .limit(300),
  ]);
  const transformed: CalendarEvent[] = (events ?? []).map((e) => ({
    id:e.id, eventDate:e.event_date, startTime:e.start_time?.slice(0,5) ?? "",
    title:e.title, kind:e.kind, discipline:e.discipline, minutes:e.duration_minutes,
    methodId:e.method_id, notes:e.notes, status:e.status,
  }));
  const recorded: LoggedSession[] = (sessions ?? []).map((s) => ({
    id:s.id, eventDate:s.started_at.slice(0,10),
    startedAt:s.started_at, title:s.gyms?.name ?? "Climbing",
  }));
  const trainings: CalendarTraining[] = (training ?? []).map((s) => ({
    id: s.id, title: s.title, status: s.status, eventDate: s.scheduled_date ?? localDate_(new Date(s.created_at)),
    startTime: s.scheduled_time?.slice(0,5) ?? "", minutes: s.actual_minutes ?? s.planned_minutes, calendarEntryId: s.calendar_entry_id,
  }));
  const t=calendarDictionary(locale);
  const presetMethod = typeof sp.method === "string" && METHODS_FOR_PLANS.some(m=>m.id===sp.method) ? sp.method : "";
  return <div className="space-y-5">
    <PageHeader title={t.title} subtitle={t.subtitle}/>
    {error ? <p role="alert" className="text-sm text-danger">{t.error}</p> : null}
    <CalendarWorkspace month={month} locale={locale} events={transformed} sessions={recorded} trainings={trainings} presetMethod={presetMethod}/>
  </div>;
}
