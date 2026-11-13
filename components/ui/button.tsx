import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

/*
 * The one button of the app. Pills everywhere, semibold Inter, icons sized to
 * the text. Three heights: 44 px compact (sm), 52 px standard (md, lg) and
 * 64 px during a séance (xl), for chalky fingers. One primary per screen.
 */
const base =
  "inline-flex items-center justify-center gap-2 rounded-full text-center font-semibold leading-tight transition-[transform,background-color,color,filter] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-45 select-none [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.14)] hover:brightness-110",
  secondary: "bg-accent-soft text-accent hover:bg-accent/15",
  ghost: "bg-transparent text-ink hover:bg-surface-2",
  danger: "bg-danger/8 text-danger hover:bg-danger/14",
};

const sizes: Record<Size, string> = {
  sm: "min-h-11 px-4 py-1.5 text-sm [&_svg]:size-4",
  md: "min-h-13 px-6 py-2 text-base [&_svg]:size-[18px]",
  lg: "min-h-13 px-7 py-2 text-base [&_svg]:size-[18px]",
  xl: "min-h-16 px-7 py-2 text-lg [&_svg]:size-5",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cn(base, variants[variant], sizes[size], extra);
}

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: Size }) {
  return <button {...props} className={buttonClass(variant, size, className)} />;
}

export function LinkButton({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link {...props} className={buttonClass(variant, size, className)} />;
}

/**
 * A link inside text or under a card: accent and semibold, underlined on hover.
 * Its icon (components/ui/icons) flows with the words, so long titles wrap.
 */
export const linkClass = "inline-block font-semibold text-accent underline-offset-4 hover:underline";

type Tone = "neutral" | "accent" | "ok" | "warn" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-surface-2 text-ink-2",
  accent: "bg-accent-soft text-accent",
  ok: "bg-ok/12 text-ok",
  warn: "bg-warn/12 text-warn",
  danger: "bg-danger/10 text-danger",
};

/** A small status pill (a result, a state, a count). Not interactive. */
export function chipClass(tone: Tone = "neutral", extra?: string) {
  return cn("inline-flex min-h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold [&_svg]:size-3.5 [&_svg]:shrink-0", tones[tone], extra);
}

/**
 * A selectable pill (filters, single choices, toggles). `on` is the chosen
 * state; 44 px tall so it stays easy to hit.
 */
export function toggleClass(on: boolean, extra?: string) {
  return cn(
    "inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition-colors [&_svg]:size-4 [&_svg]:shrink-0",
    on ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2 hover:border-ink-3 hover:text-ink",
    extra,
  );
}

/** A destructive action written as a link (remove, delete, stop): red text, 44 px tall. */
export const dangerLinkClass =
  "inline-flex min-h-11 items-center gap-1.5 px-1 text-sm font-semibold text-danger underline-offset-4 hover:underline disabled:opacity-45";

/** The track of a segmented control (two or three exclusive views or modes). */
export const segmentGroupClass = "grid gap-1 rounded-full bg-surface-2 p-1";

/** One segment; the chosen one sits on a white pill. */
export function segmentClass(on: boolean, extra?: string) {
  return cn(
    "min-h-11 rounded-full px-3 text-sm font-semibold transition-colors disabled:opacity-45",
    on ? "bg-surface text-ink shadow-[0_1px_2px_rgb(19_36_56/0.12)]" : "text-ink-2 hover:text-ink",
    extra,
  );
}

/** A round button with a symbol or an icon only (−, +, ‹, ›, sound): 48 px. */
export function iconButtonClass(extra?: string) {
  return cn(
    "inline-flex size-12 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-xl font-semibold text-ink transition-colors hover:bg-surface-2 active:scale-[0.97] disabled:opacity-40 [&_svg]:size-5",
    extra,
  );
}

/** A choice shown as a card (a method, a session template, a start option). */
export function tileClass(on: boolean, extra?: string) {
  return cn(
    "rounded-2xl border p-4 text-left transition-colors disabled:opacity-50",
    on ? "border-accent bg-accent-soft" : "border-line bg-surface hover:border-ink-3",
    extra,
  );
}
