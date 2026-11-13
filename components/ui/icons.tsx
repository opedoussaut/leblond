import { ArrowRight, ArrowUpRight, Check, ChevronLeft, Camera, CircleDashed, History, MessageCircle, Pencil, TriangleAlert, Undo2, Pause, Play, RotateCcw, Square, Star, Zap } from "lucide-react";

/*
 * The small icons that sit inside words: after a link ("Voir →"), before a
 * back link, on a start button. They replace typed symbols (→ ↗ ← ▶ ✓), so
 * every icon in the app comes from one set with one stroke. They flow inline
 * with the text, at the text's size, whatever the parent's layout.
 */
const inline = "inline-block size-[1.05em] shrink-0 align-[-0.17em]";

export const IconNext = () => <ArrowRight aria-hidden="true" className={inline} strokeWidth={2.25} />;
export const IconExternal = () => <ArrowUpRight aria-hidden="true" className={inline} strokeWidth={2.25} />;
export const IconBack = () => <ChevronLeft aria-hidden="true" className={inline} strokeWidth={2.5} />;
export const IconPlay = () => <Play aria-hidden="true" className={inline} fill="currentColor" strokeWidth={0} />;
export const IconPause = () => <Pause aria-hidden="true" className={inline} fill="currentColor" strokeWidth={0} />;
export const IconStop = () => <Square aria-hidden="true" className={inline} fill="currentColor" strokeWidth={0} />;
export const IconAgain = () => <RotateCcw aria-hidden="true" className={inline} strokeWidth={2.25} />;
export const IconPast = () => <History aria-hidden="true" className={inline} strokeWidth={2.25} />;
export const IconCheck = () => <Check aria-hidden="true" className={inline} strokeWidth={2.75} />;
/** Flash and onsight. */
export const IconFlash = () => <Zap aria-hidden="true" className={inline} fill="currentColor" strokeWidth={0} />;
/** A project. */
export const IconStar = () => <Star aria-hidden="true" className={inline} fill="currentColor" strokeWidth={0} />;
/** Tried, not sent yet. */
export const IconTry = () => <CircleDashed aria-hidden="true" className={inline} strokeWidth={2.5} />;

/** Undo the last action. */
export const IconUndo = () => <Undo2 aria-hidden="true" className={inline} strokeWidth={2.25} />;
/** Edit (a séance, a time). */
export const IconEdit = () => <Pencil aria-hidden="true" className={inline} strokeWidth={2.25} />;
/** A comment. */
export const IconComment = () => <MessageCircle aria-hidden="true" className={inline} strokeWidth={2.25} />;
/** A photo. */
export const IconPhoto = () => <Camera aria-hidden="true" className={inline} strokeWidth={2.25} />;
/** A warning (a closed area, a risky plan). */
export const IconWarn = () => <TriangleAlert aria-hidden="true" className={inline} strokeWidth={2.25} />;

/** The "live" dot of a séance in progress; it pulses unless the phone asks for reduced motion. */
export const LiveDot = () => (
  <span aria-hidden="true" className="relative inline-flex size-2 shrink-0 align-middle">
    <span className="absolute inset-0 animate-ping rounded-full bg-current opacity-50" />
    <span className="relative inline-block size-2 rounded-full bg-current" />
  </span>
);
