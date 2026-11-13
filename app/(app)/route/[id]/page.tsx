import Link from "next/link";
import { notFound } from "next/navigation";
import { GradeChip } from "@/components/climbing/grade-chip";
import { MediaGallery } from "@/components/climbing/media-gallery";
import { MediaUploader } from "@/components/climbing/media-uploader";
import { ResultBadge, routeTone } from "@/components/climbing/result-badge";
import { Card, SectionTitle } from "@/components/ui/card";
import { requireViewer } from "@/lib/auth/viewer";
import { formatDateTime } from "@/lib/format";
import { getI18n } from "@/lib/i18n/server";
import { routeDictionary } from "@/lib/i18n/routes";
import { MEDIA_BUCKET } from "@/lib/media";
import { RouteAscentEditor } from "./route-ascent-editor";
import { IconBack, IconExternal } from "@/components/ui/icons";
import { linkClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";

/** One logged route line: everything about it, editable afterwards, with its photos and videos. */
export default async function RouteAscentPage({ params }: PageProps<"/route/[id]">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const { t, locale } = await getI18n(viewer.profile.preferred_language);
  const r = routeDictionary(locale);
  const { data: ascent } = await viewer.supabase.from("route_ascents").select("*").eq("id", id).maybeSingle();
  if (!ascent) notFound();
  const [{ data: session }, { data: media }] = await Promise.all([
    viewer.supabase.from("sessions").select("id, started_at, gyms(name, brand)").eq("id", ascent.session_id).single(),
    viewer.supabase.from("media").select("*").eq("route_ascent_id", id).order("created_at", { ascending: false }),
  ]);
  const gym = session?.gyms ?? null;
  const outdoor = gym?.brand === "OUTDOOR";
  const signed = media?.length
    ? (await viewer.supabase.storage.from(MEDIA_BUCKET).createSignedUrls(media.map((m) => m.storage_path), 3600)).data
    : [];
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));
  const p = t.problem;

  return (
    <div className="space-y-5">
      <header className="space-y-1">
        <p className="text-sm text-ink-3">
          {gym?.name}{ascent.sector ? ` · ${ascent.sector}` : ""} · {formatDateTime(ascent.created_at, locale)}
        </p>
        <h1 className="text-2xl font-bold tracking-tight md:text-3xl">{ascent.route_name || r.ascentTitle}</h1>
        <div className="flex flex-wrap items-center gap-2">
          {ascent.native_grade && ascent.native_grade_system ? (
            <GradeChip t={t} system={ascent.native_grade_system} grade={ascent.native_grade} size="lg" />
          ) : null}
          <strong className="text-2xl tabular-nums">{ascent.grade}</strong>
          <ResultBadge tone={routeTone(ascent.result)} label={r.results[ascent.result]} />
          <span className="text-sm text-ink-2">{r.styles[ascent.style]}{ascent.tries > 1 ? ` · ×${ascent.tries}` : ""}</span>
        </div>
        {ascent.topo_ref || ascent.topo_url ? (
          <p className="text-sm text-ink-2">
            {p.topoRef} : {ascent.topo_ref ?? ""}{" "}
            {ascent.topo_url ? (
              <a href={ascent.topo_url} target="_blank" rel="noopener noreferrer" className={cn(linkClass, "hover:underline")}>
                {p.topoSource} <IconExternal />
              </a>
            ) : null}
          </p>
        ) : null}
      </header>

      <Card>
        <SectionTitle>{r.media}</SectionTitle>
        <div className="mt-3 space-y-4">
          <MediaUploader userId={viewer.userId} routeAscentId={id} sessionId={ascent.session_id} photoLabel={r.photo} />
          <MediaGallery
            photoLabel={r.photo}
            items={(media ?? []).map((m) => ({ id: m.id, type: m.media_type, mime: m.mime_type, url: urlByPath.get(m.storage_path) ?? null }))}
          />
        </div>
      </Card>

      <RouteAscentEditor
        outdoor={outdoor}
        ascent={{
          id: ascent.id,
          sessionId: ascent.session_id,
          routeName: ascent.route_name ?? "",
          grade: ascent.grade,
          style: ascent.style,
          result: ascent.result,
          falls: ascent.falls,
          tries: ascent.tries,
          wallAngle: ascent.wall_angle,
          sector: ascent.sector ?? "",
          notes: ascent.notes,
          beta: ascent.beta ?? "",
          topoRef: ascent.topo_ref ?? "",
          topoUrl: ascent.topo_url ?? "",
        }}
      />

      <Link href={`/session/${ascent.session_id}`} className={cn(linkClass, "block text-sm hover:underline")}>
        <IconBack /> {r.backToSession}
      </Link>
    </div>
  );
}
