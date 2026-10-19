"use client";

import type { Locale } from "@/lib/i18n";

/**
 * A deliberate two-language choice is clearer than a country flag or a
 * dropdown. Labels and descriptions remain in their own language so the
 * first screen makes sense regardless of the default locale.
 */
const LANGUAGES = [
  {
    value: "fr",
    code: "FR",
    name: "Français",
    description: "L’expérience LeBlond en français",
  },
  {
    value: "en",
    code: "EN",
    name: "English",
    description: "Explore LeBlond in English",
  },
] as const;

export function LanguagePicker({
  value,
  onChange,
  legend,
}: {
  value: Locale;
  onChange: (value: Locale) => void;
  legend: string;
}) {
  return (
    <fieldset aria-label={legend}>
      <legend className="sr-only">{legend}</legend>
      <div className="grid grid-cols-2 gap-3">
        {LANGUAGES.map((option) => {
          const selected = value === option.value;
          return (
            <label
              key={option.value}
              lang={option.value}
              className={[
                "relative flex min-h-40 cursor-pointer flex-col items-start rounded-2xl border p-4",
                "transition-colors duration-150 focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent",
                selected
                  ? "border-accent bg-accent-soft shadow-[0_8px_26px_-20px_rgba(23,105,185,0.7)]"
                  : "border-line bg-surface hover:border-accent/50 hover:bg-surface-2",
              ].join(" ")}
            >
              <input
                type="radio"
                className="sr-only"
                name="language"
                value={option.value}
                checked={selected}
                onChange={() => onChange(option.value)}
              />
              <div className="mb-4 flex w-full items-center justify-between gap-2">
                <span aria-hidden="true" className="rounded-lg border border-line/70 bg-surface/80 px-2.5 py-1.5 text-xs font-bold tracking-[0.15em] text-ink-2">
                  {option.code}
                </span>
                <span
                  aria-hidden="true"
                  className={[
                    "flex h-5 w-5 items-center justify-center rounded-full border text-xs",
                    selected ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface",
                  ].join(" ")}
                >
                  {selected ? "✓" : null}
                </span>
              </div>
              <span className="text-lg font-bold tracking-tight text-ink">{option.name}</span>
              <span className="mt-1.5 text-xs leading-relaxed text-ink-2">{option.description}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}
