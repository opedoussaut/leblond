import type { BoardBest, BoulderBest, HangBest, HipLevels, RouteBest } from "@/lib/analytics/notebook";
import { BOARD_NAMES } from "@/lib/climbing/boards";
import { boulderGrade } from "@/lib/grading/display";
import { gradeLabel } from "@/lib/grading/labels";
import { fmt, intlLocale, type Dictionary, type Locale } from "@/lib/i18n";
import { notebookDictionary } from "@/lib/i18n/notebook";
import { gradeHarmoniseDictionary } from "@/lib/i18n/grade-harmonise";
import { PAGE_ICONS, PROGRESS_SECTION_ICONS } from "@/components/layout/nav-icons";
import { HeadingMark, ToneIcon, type Tone } from "@/components/ui/hero-figure";
import type { LucideIcon } from "lucide-react";

type Tile = { key: string; eyebrow: string; value: string; detail: string; mark: { icon: LucideIcon; tone: Tone } };

/** Each kind of record keeps the icon and tone of its Progrès section. */
const MARKS = {
  boulder: PROGRESS_SECTION_ICONS["boulder-indoor"],
  route: PROGRESS_SECTION_ICONS["route-indoor"],
  board: PROGRESS_SECTION_ICONS.boards,
  hang: { icon: PAGE_ICONS.training, tone: "sky" },
  hips: { icon: PAGE_ICONS.mobility, tone: "green" },
} satisfies Record<string, Tile["mark"]>;

/** Best recorded performance in each area, native grades as logged, each with its date. */
export function NotebookRecords({ t, locale, boulders, route, boards, hang, hips, gymNames = {}, favouritesOnly = false }: {
  t: Dictionary; locale: Locale;
  /** Gym names by id, so each boulder record says where it was climbed (scales differ between gyms). */
  gymNames?: Record<string, string>;
  /** Indoor boulder records count only the favourite gyms. */
  favouritesOnly?: boolean;
  boulders: BoulderBest[]; route: RouteBest | null; boards: BoardBest[]; hang: HangBest | null; hips: HipLevels | null;
}) {
  const n = notebookDictionary(locale);
  const h = gradeHarmoniseDictionary(locale);
  const converted = (b: BoulderBest) => b.conversion && b.conversion.source !== "FONT_NATIVE" ? fmt(n.convertedFrom, {
    grade: gradeLabel(t, b.conversion.native.system, b.conversion.native.grade),
    scale: (t.grades.systems as Record<string, string>)[b.conversion.native.system] ?? b.conversion.native.system,
    source: h.source[b.conversion.source],
  }) : null;
  const short = new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "UTC", day: "numeric", month: "short", year: "numeric" });
  const on = (date: string) => fmt(n.on, { date: short.format(new Date(date + "T12:00:00Z")) });
  const join = (...parts: Array<string | null | false>) => parts.filter(Boolean).join(" · ");
  const styleLabel = { LEAD: n.lead, TOPROPE: n.toprope, AUTOBELAY: n.autobelay } as Record<string, string>;

  const tiles: Tile[] = [
    ...boulders.slice(0, 3).map((b) => ({
      key: `b-${b.system}`, eyebrow: join(n.boulder, gymNames[b.gymId] ?? null, (t.grades.scaleShort as Record<string, string>)[b.system] ?? b.system),
      value: gradeLabel(t, b.system, b.grade), mark: MARKS.boulder,
      detail: join(converted(b), b.flash && n.flashed, fmt(n.sends, { n: b.sends }), on(b.date),
        b.gymIds.length > 1 && fmt(n.otherGyms, { n: b.gymIds.length - 1 })),
    })),
    ...(route ? [{
      key: "route", eyebrow: n.route, value: route.grade.toLowerCase(), mark: MARKS.route,
      detail: join(styleLabel[route.style] ?? null, route.result === "ONSIGHT" && n.onsight, route.result === "FLASH" && n.flashed, on(route.date)),
    }] : []),
    ...boards.slice(0, 2).map((b) => ({
      key: `board-${b.board}`, eyebrow: `${n.board} · ${BOARD_NAMES[b.board]}`,
      value: b.scale === "FONT" ? boulderGrade(b.grade) : b.grade, mark: MARKS.board,
      detail: join(fmt(n.angle, { angle: b.angle }), on(b.date)),
    })),
    ...(hang ? [{
      key: "hang", eyebrow: n.hang, mark: MARKS.hang, value: `${hang.loadKg > 0 ? "+" : ""}${hang.loadKg} kg`,
      detail: join(hang.edgeMm !== null && fmt(n.edge, { mm: hang.edgeMm }), hang.seconds !== null && fmt(n.seconds, { s: hang.seconds }), on(hang.date)),
    }] : []),
    ...(hips ? [{
      key: "hips", eyebrow: n.hips, mark: MARKS.hips,
      value: fmt(n.hipsValue, { a: hips.levels.A ?? "—", b: hips.levels.B ?? "—", c: hips.levels.C ?? "—" }),
      detail: join(n.hipsDetail, on(hips.date)),
    }] : []),
  ];

  return <section aria-labelledby="records-heading" className="space-y-3">
    <div>
      <h2 id="records-heading" className="flex items-center gap-2 text-lg font-bold"><HeadingMark />{n.bestTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{tiles.length ? n.bestHint : n.bestEmpty}</p>
      {boulders.some((b) => converted(b)) ? <p className="mt-1 text-xs text-ink-3">{n.scalesNote}</p> : null}
      {favouritesOnly ? <p className="mt-1 text-xs text-ink-3">{n.favouritesNote}</p> : null}
    </div>
    {tiles.length ? <ul className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {tiles.map((tile) => <li key={tile.key} className="leblond-premium-surface leblond-elevated min-w-0 p-4">
        <ToneIcon icon={tile.mark.icon} tone={tile.mark.tone} size="sm" className="mb-2.5" />
        <p className="line-clamp-2 text-[11px] font-bold uppercase leading-snug tracking-[0.12em] text-ink-3">{tile.eyebrow}</p>
        <p className="leblond-number mt-1.5 break-words text-2xl font-black tracking-tight sm:text-3xl">{tile.value}</p>
        <p className="mt-1 text-xs leading-snug text-ink-2">{tile.detail}</p>
      </li>)}
    </ul> : null}
  </section>;
}
