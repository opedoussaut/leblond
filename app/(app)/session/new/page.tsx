import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { listGymsWithFavourites } from "@/lib/data/gyms";
import { listOutdoorAreas, listOutdoorSites } from "@/lib/data/outdoor";
import { getI18n } from "@/lib/i18n/server";
import { StartSession } from "./start-session";

export const metadata = { title: "Nouvelle séance" };

export default async function NewSessionPage({ searchParams }: PageProps<"/session/new">) {
  const viewer = await requireViewer();
  const { data: live } = await viewer.supabase.from("sessions").select("id").is("ended_at", null).maybeSingle();
  if (live) redirect(`/session/${live.id}`);
  const { t } = await getI18n(viewer.profile.preferred_language);
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
  const { where } = await searchParams;
  const initialTab =
    where === "past" ? "past"
    : where === "outdoor" || (where !== "gym" && last?.gyms?.external_provider) ? "outdoor" : "gym";
  return (
    <div>
      <PageHeader title={t.session.newTitle} subtitle={t.session.whereToday} />
      <StartSession gyms={gyms} favouriteIds={favouriteIds} areas={areas} sites={sites} initialTab={initialTab} />
    </div>
  );
}
