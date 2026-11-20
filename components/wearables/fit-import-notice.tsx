import { fmt, type Locale } from "@/lib/i18n";
import { fitImportDictionary } from "@/lib/i18n/fit-import";
import { activityNameOf, readImportedAs } from "@/lib/integrations/wearables/fit/import-flow";
import { FitRefile } from "./fit-refile";

/**
 * On a séance created by the one-step FIT import: what it was recognised as
 * and why, where the venue came from, and — while nothing is logged in it yet —
 * buttons to file it as something else.
 */
export function FitImportNotice({ activity, empty, locale }: {
  activity: { id: string; raw_metadata: unknown } | null;
  empty: boolean;
  locale: Locale;
}) {
  const imported = activity ? readImportedAs(activity.raw_metadata) : null;
  if (!activity || !imported) return null;
  const d = fitImportDictionary(locale);
  const name = activityNameOf(activity.raw_metadata);
  const why = imported.by === "sport" ? d.bySport
    : imported.by === "name" ? `${d.byName}${name ? (locale === "en" ? ` “${name}”` : ` « ${name} »`) : ""}`
      : imported.by === "duration" ? d.byDuration : d.byClimber;
  const via = imported.via === "gps" ? d.viaGps : imported.via === "recent" ? d.viaRecent : imported.via === "favourite" ? d.viaFavourite : null;
  return (
    <section aria-label={d.bannerTitle} data-testid="fit-import-notice"
      className="rounded-2xl border border-accent/30 bg-accent-soft p-4 text-sm text-ink">
      <p className="text-xs font-bold uppercase tracking-[0.12em] text-accent">⌚ {d.bannerTitle}</p>
      <p className="mt-1">
        <strong>{fmt(d.recognisedAs, { what: d.what[imported.what] })}</strong> — {why}.
        {via ? ` ${via}` : ""}
      </p>
      {empty ? <FitRefile activityId={activity.id} current={imported.what} /> : null}
    </section>
  );
}
