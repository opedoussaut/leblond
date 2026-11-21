import type { TrendPoint } from "@/lib/analytics/mobility-battery";
import type { Locale } from "@/lib/i18n";
import { batteryDictionary, type BatteryDictionary } from "@/lib/i18n/mobility-battery";
import type { Card, Unit } from "@/lib/training/mobility-battery/cards";
import { pick } from "@/lib/training/sessions";
import { chipClass } from "@/components/ui/button";

/** The four mandatory stop conditions, shown before and during every bilan. */
export function BatteryStopConditions({ locale }: { locale: Locale }) {
  const t = batteryDictionary(locale);
  return <section aria-labelledby="stop-heading" className="rounded-2xl border border-danger/30 bg-danger/5 p-5">
    <h2 id="stop-heading" className="text-base font-bold text-danger">{t.stopTitle}</h2>
    <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink">{t.stopList.map((s) => <li key={s}>{s}</li>)}</ul>
  </section>;
}

export function SelfReportedBadge({ locale }: { locale: Locale }) {
  return <span className={chipClass("neutral")}>{batteryDictionary(locale).selfReported}</span>;
}

export function unitText(t: BatteryDictionary, unit: Unit) { return t.units[unit]; }

export function numberText(v: number, locale: Locale) {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 1 }).format(v);
}

/** A raw value with its unit, a category label, or "not done (reason)" — never a zero for not done. */
export function rawText(t: BatteryDictionary, locale: Locale, card: Card, r: { kind: TrendPoint["kind"]; value: number | null; unit: Unit; category: string | null; notDoneReason: string | null }) {
  if (r.kind === "NOT_DONE" && r.notDoneReason === "STOPPED_SYMPTOM") return t.notDoneReasons.STOPPED_SYMPTOM;
  if (r.kind === "NOT_DONE") return `${t.notDone}${r.notDoneReason ? ` (${t.notDoneReasons[r.notDoneReason as keyof typeof t.notDoneReasons].toLowerCase()})` : ""}`;
  if (r.kind === "CATEGORY") return pick(card.measure?.categories?.find((c) => c.id === r.category)?.label, locale) || r.category || "";
  if (r.value === null) return "";
  const u = unitText(t, r.unit);
  return `${numberText(r.value, locale)}${u === "/10" ? "/10" : u ? ` ${u}` : ""}`;
}

export function signedText(v: number, locale: Locale) {
  return `${v > 0 ? "+" : v < 0 ? "−" : "±"}${numberText(Math.abs(v), locale)}`;
}
