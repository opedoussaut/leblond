import { en } from "./en";
import { fr, type Dictionary } from "./fr";

export type { Dictionary };
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";
export const LOCALE_COOKIE = "lb_locale";

const dictionaries: Record<Locale, Dictionary> = { fr, en };

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}

/** Replace {placeholders} in a dictionary string. */
export function fmt(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m));
}

/**
 * "{n} séance" / "{n} séances" with the language's plural rule (in French 0 and 1
 * are singular). `forms.other` is used for every non-"one" category.
 */
export function plural(locale: Locale, n: number, forms: { one: string; other: string }): string {
  const rule = new Intl.PluralRules(intlLocale(locale)).select(n);
  return fmt(rule === "one" ? forms.one : forms.other, { n });
}

export function intlLocale(locale: Locale): string {
  return locale === "fr" ? "fr-FR" : "en-GB";
}
