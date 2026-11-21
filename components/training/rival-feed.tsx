import { formatDuration } from "@/lib/duration";
import { Flame, Smile, Swords, type LucideIcon } from "lucide-react";
import { season, type Duel, type FeedItem, type RivalSettings, type RivalTone } from "@/lib/analytics/rival";
import { fmt, type Locale } from "@/lib/i18n";
import { rivalDictionary } from "@/lib/i18n/rival";
import { formatDate } from "@/lib/format";
import { boulderGrade } from "@/lib/grading/display";
import { RivalPortrait } from "./rival-portrait";
import { RivalFeedList } from "./rival-feed-list";

const TONE_ICON: Record<RivalTone, LucideIcon> = { SYMPA: Smile, PIQUANT: Flame, SANS_PITIE: Swords };

/** The alter ego's tone as a symbol next to its name, with a text label (never the symbol alone). */
function ToneBadge({ tone, label }: { tone: RivalTone; label: string }) {
  const Icon = TONE_ICON[tone];
  return <span role="img" aria-label={label} title={label} data-tone={tone}
    className="grid size-8 place-items-center rounded-full bg-accent-soft text-accent">
    <Icon aria-hidden="true" className="size-4" strokeWidth={2.25} />
  </span>;
}

/** The alter ego's profile, its season and its feed (all derived; nothing stored). */
export function RivalFeed({ locale, name, settings, feed, duels, today, yesterday, rivalPhoto = null }: {
  locale: Locale; name: string; settings: RivalSettings;
  /** The photo the climber gave the rival, shown instead of its portrait. */
  rivalPhoto?: string | null;
  feed: FeedItem[]; duels: Duel[]; today: string; yesterday: string;
}) {
  const r = rivalDictionary(locale);
  const s = season(duels);
  const when = (date: string, time: string) => (date === today ? r.today : date === yesterday ? r.yesterday
    : formatDate(date + "T12:00:00", locale, { weekday: "short" })) + " · " + time;
  const where = (board: { name: string; angle: number } | null) => (board ? fmt(r.sendOnBoard, { board: board.name, angle: board.angle }) : "");
  const text = (item: FeedItem): string => {
    switch (item.kind) {
      case "session": return fmt(r.sessionLine, { name, title: item.title, minutes: formatDuration(item.minutes), effort: item.effort });
      case "send": return fmt(r.sendLine, { name, grade: boulderGrade(item.grade), tries: item.tries, where: where(item.board) });
      case "attempt": return fmt(r.attemptLine, { name, grade: boulderGrade(item.grade), where: where(item.board) });
      case "project": return fmt(item.sent ? r.projectLine : r.projectTriedLine, { name, project: item.project });
      case "duel": return fmt(r.duelLine, { week: item.week, a: Math.max(item.you, item.rival), b: Math.min(item.you, item.rival),
        verdict: item.winner === "you" ? r.duelWon : item.winner === "rival" ? fmt(r.duelLost, { name }) : r.duelLevel });
      case "message": {
        const wordings = r.messages[settings.tone][item.message];
        const vars = typeof item.vars.grade === "string" ? { ...item.vars, grade: boulderGrade(item.vars.grade) } : item.vars;
        const line = fmt(wordings[item.variant % wordings.length], vars);
        return line.charAt(0).toUpperCase() + line.slice(1);
      }
    }
  };

  return <section aria-labelledby="rival-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <div className="flex items-center gap-4">
      <RivalPortrait portrait={settings.portrait} photoUrl={rivalPhoto} size={64} />
      <div className="flex min-w-0 flex-wrap items-center gap-2">
        <h2 id="rival-heading" className="flex flex-wrap items-center gap-2 font-display text-2xl font-black">
          {name} <span className="rounded-full bg-surface-2 px-2 py-0.5 font-sans text-xs font-semibold text-ink-3">{r.fictional}</span>
        </h2>
        <ToneBadge tone={settings.tone} label={fmt(r.toneSymbol, { tone: r.toneLabel[settings.tone] })} />
      </div>
    </div>
    {duels.length ? <p className="rounded-xl bg-surface-2 px-4 py-3 text-sm">
      <strong>{r.seasonTitle}</strong> · {fmt(r.seasonScore, { name, rival: s.rival, you: s.you })}
    </p> : null}
    <RivalFeedList title={fmt(r.feedTitle, { name })} empty={fmt(r.feedEmpty, { name })}
      labels={{ hide: r.feedHide, show: r.feedShow, all: r.feedAll, fewer: r.feedFewer }}
      lines={feed.map((item) => ({ when: when(item.date, item.time), message: item.kind === "message",
        text: (item.kind === "message" ? `${name} · ` : "") + text(item) }))} />
  </section>;
}
