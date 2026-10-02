import { redirect } from "next/navigation";
import { PageHeader } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { listGymsWithFavourites } from "@/lib/data/gyms";
import { getI18n } from "@/lib/i18n/server";
import { StartSession } from "./start-session";

export const metadata = { title: "Nouvelle séance" };

export default async function NewSessionPage() {
  const viewer = await requireViewer();
  const { data: live } = await viewer.supabase.from("sessions").select("id").is("ended_at", null).maybeSingle();
  if (live) redirect(`/session/${live.id}`);
  const { t } = await getI18n(viewer.profile.preferred_language);
  const { gyms, favouriteIds } = await listGymsWithFavourites(viewer.supabase, viewer.userId);
  return (
    <div>
      <PageHeader title={t.session.newTitle} subtitle={t.session.whereToday} />
      <StartSession gyms={gyms} favouriteIds={favouriteIds} />
    </div>
  );
}
