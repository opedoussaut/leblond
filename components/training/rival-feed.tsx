import { season, type Duel, type FeedItem, type RivalSettings } from "@/lib/analytics/rival";
import { fmt, type Locale } from "@/lib/i18n";
import { rivalDictionary } from "@/lib/i18n/rival";
import { formatDate } from "@/lib/format";
import { RivalPortrait } from "./rival-portrait";

/** The rival's profile, its season and its feed (all derived; nothing stored). */
export function RivalFeed({ locale, name, settings, grade, gym, feed, duels, today, yesterday }: {
  locale: Locale; name: string; settings: RivalSettings; grade: string | null; gym: string | null;
  feed: FeedItem[]; duels: Duel[]; today: string; yesterday: string;
}) {
  const r = rivalDictionary(locale);
  const s = season(duels);
  const when = (date: string, time: string) => (date === today ? r.today : date === yesterday ? r.yesterday
    : formatDate(date + "T12:00:00", locale, { weekday: "short" })) + " · " + time;
  const text = (item: FeedItem): string => {
    switch (item.kind) {
      case "session": return fmt(r.sessionLine, { name, title: item.title, minutes: item.minutes, effort: item.effort });
      case "send": return fmt(r.sendLine, { name, grade: item.grade, tries: item.tries,
        where: item.board ? fmt(r.sendOnBoard, { board: item.board.name, angle: item.board.angle }) : "" });
      case "project": return fmt(r.projectLine, { name, project: item.project });
      case "duel": return fmt(r.duelLine, { week: item.week, a: Math.max(item.you, item.rival), b: Math.min(item.you, item.rival),
        verdict: item.winner === "you" ? r.duelWon : item.winner === "rival" ? fmt(r.duelLost, { name }) : r.duelLevel });
      case "message": return fmt(r.messages[settings.tone][item.message], item.vars);
    }
  };

  return <section aria-labelledby="rival-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex items-center gap-4">
      <RivalPortrait portrait={settings.portrait} size={64} />
      <div className="min-w-0">
        <h2 id="rival-heading" className="flex flex-wrap items-center gap-2 font-display text-2xl font-black">
          {name} <span className="rounded-full bg-surface-2 px-2 py-0.5 font-sans text-xs font-semibold text-ink-3">{r.fictional}</span>
        </h2>
        <p className="text-sm text-ink-2">{grade ? fmt(r.profileLine, { grade }) : r.profileLineNoGrade}{gym ? " · " + gym : ""}</p>
        <p className="text-xs text-ink-3">{r.levelLabel[settings.level]} · {r.toneLabel[settings.tone]}</p>
      </div>
    </div>
    {duels.length ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
      <strong>{r.seasonTitle}</strong> · {fmt(r.seasonScore, { name, rival: s.rival, you: s.you })}
    </p> : null}
    <div>
      <h3 className="text-sm font-bold">{fmt(r.feedTitle, { name })}</h3>
      {feed.length ? <ol className="mt-2 space-y-2" data-testid="rival-feed">
        {feed.map((item, i) => <li key={i} className={"rounded-xl border px-3 py-2 text-sm " + (item.kind === "message" ? "border-accent/30 bg-accent-soft" : "border-line bg-surface")}>
          <span className="block text-xs font-semibold text-ink-3">{when(item.date, item.time)}</span>
          <span className={item.kind === "message" ? "font-semibold" : ""}>{item.kind === "message" ? `${name} · ` : ""}{text(item)}</span>
        </li>)}
      </ol> : <p className="mt-2 text-sm text-ink-3">{fmt(r.feedEmpty, { name })}</p>}
    </div>
    <p className="text-xs leading-relaxed text-ink-3">{fmt(r.safety, { name })}</p>
  </section>;
}
