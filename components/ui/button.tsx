import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";
type Size = "sm" | "md" | "lg" | "xl";

const base =
  "inline-flex items-center justify-center gap-2 text-center font-bold transition-[transform,background-color,border-color] active:scale-[0.98] disabled:opacity-50 disabled:pointer-events-none select-none";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-accent-ink hover:brightness-105",
  secondary: "border border-line bg-surface text-accent hover:bg-accent-soft",
  ghost: "bg-transparent text-ink-2 hover:bg-surface-2",
  danger: "bg-transparent text-danger border border-danger/40 hover:bg-danger/10",
};

// Minimum 44px targets, 48px for main actions; "xl" is for in-session controls used with chalky fingers.
const sizes: Record<Size, string> = {
  sm: "min-h-11 rounded-full px-4 py-1.5 text-sm",
  md: "min-h-12 rounded-full px-6 py-2 text-sm",
  lg: "min-h-14 rounded-full px-6 py-2 text-base",
  xl: "min-h-20 rounded-2xl px-6 py-2 text-xl",
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
