import Image from "next/image";
import { cn } from "@/components/ui/cn";

/** LEBLOND wordmark: the artwork mark + set type. */
export function Wordmark({ className, size = 32 }: { className?: string; size?: number }) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/brand/leblond-mark-96.png"
        alt=""
        width={size}
        height={size}
        className="rounded-[28%] ring-1 ring-black/10"
        priority
      />
      <span className="text-lg font-black uppercase tracking-[0.22em]">Leblond</span>
    </span>
  );
}

/** Patrick's identity placeholder: initials in the accent family. */
export function PatrickAvatar({ size = 40, className }: { size?: number; className?: string }) {
  return (
    <span
      aria-hidden
      style={{ width: size, height: size, fontSize: size * 0.38 }}
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-full bg-accent font-black text-accent-ink",
        className,
      )}
    >
      PL
    </span>
  );
}
