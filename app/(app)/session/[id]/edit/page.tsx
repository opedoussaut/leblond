import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireViewer } from "@/lib/auth/viewer";
import { loadSessionView } from "@/lib/data/session";
import { getI18n } from "@/lib/i18n/server";
import { sessionEditDictionary } from "@/lib/i18n/session-edit";
import { utcToZoned } from "@/lib/time";
import { SessionLogger } from "../session-logger";
import { DeleteSessionButton, SessionMetaForm } from "./session-meta-form";

export const metadata = { title: "Modifier la séance" };

/** Edit a finished session: when it happened, what was climbed, or delete it. */
export default async function EditSessionPage({ params }: PageProps<"/session/[id]/edit">) {
  const { id } = await params;
  const viewer = await requireViewer();
  const view = await loadSessionView(viewer.supabase, id);
  if (!view) notFound();
  if (!view.session.ended_at) redirect(`/session/${id}`);
  const { locale } = await getI18n(viewer.profile.preferred_language);
  const e = sessionEditDictionary(locale);
  const start = utcToZoned(view.session.started_at);
  const minutes = view.session.duration_minutes
    ?? Math.max(1, Math.round((new Date(view.session.ended_at).getTime() - new Date(view.session.started_at).getTime()) / 60_000));

  return <div className="space-y-6">
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">{e.editing}</p>
        <h1 className="mt-1 text-2xl font-black tracking-tight">{e.editTitle}</h1>
        <p className="text-sm text-ink-2">{view.gym.name}</p>
      </div>
      <Link href={`/session/${id}`} className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-sm font-extrabold text-surface">
        ✓ {e.done}
      </Link>
    </header>
    <SessionMetaForm sessionId={id} initial={{ date: start.date, time: start.time, minutes, title: view.session.title ?? "" }} today={utcToZoned(new Date()).date} />
    <section aria-label={e.logTitle} className="space-y-3">
      <SessionLogger viewer={viewer} view={view} mode="edit" />
    </section>
    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
      <Link href={`/session/${id}`} className="inline-flex min-h-12 items-center rounded-full bg-ink px-5 text-sm font-extrabold text-surface">
        ✓ {e.done}
      </Link>
      <DeleteSessionButton sessionId={id} />
    </div>
  </div>;
}
