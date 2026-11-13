"use client";

import { useEffect, useId, useRef, useState } from "react";
import { useI18n } from "@/components/i18n-provider";
import { fmt } from "@/lib/i18n";
import { durationPresets, durationProblem, durationSuggestions, formatDuration, parseDuration } from "@/lib/duration";
import { cn } from "./cn";
import { Input } from "./field";
import { toggleClass } from "@/components/ui/button";

/**
 * Duration stored in minutes, typed the way people say it ("1h30", "1:30",
 * "90") or picked: from the field's drop-down list, or one tap on a common
 * duration. `value` null means "not set" (only allowed when `optional`).
 */
export function DurationField({ label, value, onChange, min = 0, max = 1440, optional = false, className }: {
  label: string;
  value: number | null;
  onChange: (minutes: number | null) => void;
  min?: number;
  max?: number;
  optional?: boolean;
  className?: string;
}) {
  const { t } = useI18n();
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [text, setText] = useState(value == null ? "" : formatDuration(value));
  // The last value this field sent: a different incoming value comes from the
  // parent (a reset, a preset elsewhere) and replaces the text.
  const [sent, setSent] = useState(value);
  if (value !== sent) {
    setSent(value);
    setText(value == null ? "" : formatDuration(value));
  }

  const parsed = parseDuration(text);
  const unreadable = parsed === undefined;
  const problem = parsed == null ? null : durationProblem(parsed, min, max);
  const message = unreadable ? t.common.durationUnreadable
    : problem === "tooShort" ? fmt(t.common.durationTooShort, { n: formatDuration(min) })
    : problem === "tooLong" ? fmt(t.common.durationTooLong, { n: formatDuration(max) }) : "";

  // Native validation blocks the submit and names the problem on the field.
  useEffect(() => { inputRef.current?.setCustomValidity(message); }, [message]);

  function send(next: number | null) {
    setSent(next);
    onChange(next);
  }

  function type(raw: string) {
    setText(raw);
    const minutes = parseDuration(raw);
    // An unreadable text, or an emptied required field, keeps the last value:
    // native validation blocks the submit until it is fixed.
    if (minutes === undefined || (minutes === null && !optional)) return;
    send(minutes);
  }

  function pick(minutes: number) {
    setText(formatDuration(minutes));
    send(minutes);
  }

  const presets = durationPresets(min, max);
  const listId = `${id}-list`;

  return (
    <div className={cn("min-w-0", className)}>
      <label htmlFor={id} className="text-sm font-semibold">{label}</label>
      <Input ref={inputRef} id={id} className="mt-1" type="text" inputMode="text" autoComplete="off" enterKeyHint="done"
        list={listId} required={!optional} placeholder={t.common.durationPlaceholder}
        aria-invalid={message ? true : undefined} aria-describedby={message ? `${id}-msg` : undefined}
        value={text} onChange={(e) => type(e.target.value)}
        onBlur={() => { if (parsed != null && !unreadable) setText(formatDuration(parsed)); }} />
      <datalist id={listId}>
        {durationSuggestions(min, max).map((d) => <option key={d} value={formatDuration(d)} />)}
      </datalist>
      {message ? <p id={`${id}-msg`} className="mt-1 text-xs font-semibold text-danger">{message}</p> : null}
      {presets.length ? (
        <div role="group" aria-label={fmt(t.common.durationPresets, { label })} className="mt-2 flex flex-wrap gap-1.5">
          {presets.map((d) => (
            <button key={d} type="button" aria-pressed={parsed === d} onClick={() => pick(d)}
              className={toggleClass(parsed === d, "px-3")}>
              {formatDuration(d)}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
