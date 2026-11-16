import { intlLocale, type Locale } from "@/lib/i18n";

/** "1h42", "45 min". */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null) return "—";
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h${String(m).padStart(2, "0")}` : `${m} min`;
}

export function formatDate(date: string | Date, locale: Locale, opts: Intl.DateTimeFormatOptions = { dateStyle: "medium" }) {
  return new Intl.DateTimeFormat(intlLocale(locale), { timeZone: "Europe/Paris", ...opts }).format(new Date(date));
}

export function formatDateTime(date: string | Date, locale: Locale) {
  return formatDate(date, locale, { dateStyle: "medium", timeStyle: "short" });
}

/** A ratio shown WITH its counts, e.g. "62 % (31/50)". Never a bare percentage. */
export function formatRatio(r: { numerator: number; denominator: number; value: number | null }): string {
  if (r.value === null) return "—";
  return `${Math.round(r.value * 100)} % (${r.numerator}/${r.denominator})`;
}

/** The share alone ("89 %"), for a hero figure; the counts go beside it. */
export function formatPercent(r: { value: number | null }): string {
  return r.value === null ? "—" : `${Math.round(r.value * 100)} %`;
}

/** The counts behind a share ("64/72"), or nothing when there is no share. */
export function formatCounts(r: { numerator: number; denominator: number; value: number | null }): string | undefined {
  return r.value === null ? undefined : `${r.numerator}/${r.denominator}`;
}

export function formatNumber(n: number | null | undefined, digits = 1): string {
  if (n == null || !Number.isFinite(n)) return "—";
  return Number.isInteger(n) ? String(n) : n.toFixed(digits);
}
