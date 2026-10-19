import { PageHeader } from "@/components/ui/card";
import { CalendarWorkspace } from "@/components/calendar/calendar-workspace";
import { requireViewer } from "@/lib/auth/viewer";
import { getI18n } from "@/lib/i18n/server";
import { monthBounds, type CalendarEvent, type LoggedSession } from "@/lib/calendar/schema";
import { calendarDictionary } from "@/lib/i18n/calendar";

export const metadata = { title: "LEBLOND — Calendrier" };
export default async function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  const viewer = await requireViewer();
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const sp = await searchParams;
  const raw = typeof sp.month === "string" ? sp.month : new Date().toISOString().slice(0,7);
  const month = monthBounds(raw) ? raw : new Date().toISOString().slice(0,7);
  const range = monthBounds(month)!;
  const [{ data: events, error }, { data: sessions }] = await Promise.all([
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
  const t=calendarDictionary(locale);
  return <div className="space-y-5">
    <PageHeader title={t.title} subtitle={t.subtitle}/>
    {error ? <p role="alert" className="text-sm text-danger">{t.error}</p> : null}
    <CalendarWorkspace month={month} locale={locale} events={transformed} sessions={recorded}/>
  </div>;
}
