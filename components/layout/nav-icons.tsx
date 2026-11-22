/**
 * Navigation icons. They come from Lucide (lucide-react, ISC licence,
 * https://lucide.dev/license), a third-party icon set; LEBLOND's own artwork
 * (logo, illustrations) stays in public/brand.
 *
 * One icon per area and per page, used everywhere the page is named: desktop
 * sidebar, mobile bottom bar and chips, page headers and hub cards.
 */
import {
  Activity, ArrowUpToLine, Award, GitCompareArrows, BrickWall, Grid3x3, MapPin, MountainSnow, Sparkles, Trees,
  BookOpen, CalendarDays, ClipboardCheck, Dumbbell, HeartPulse, Layers, List, LogOut, Luggage, MessageCircle,
  Mountain, PersonStanding, Plus, Plug, Settings, ShieldCheck, SlidersHorizontal, Sun, Swords, Target, TrendingUp, UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SectionId, SubPageKey } from "@/lib/navigation/sections";
import type { ProgressTab } from "@/lib/navigation/progress-tabs";
import type { FollowUpTab } from "@/lib/navigation/follow-up-tabs";
import type { Tone } from "@/components/ui/hero-figure";

export type { LucideIcon };

export const AREA_ICONS: Record<SectionId, LucideIcon> = {
  today: Sun,
  sessions: Mountain,
  programmes: Layers,
  rival: Swords,
  progress: TrendingUp,
  patrick: MessageCircle,
};

/** Pages named in the navigation, plus a few pages reached from inside an area. */
export const PAGE_ICONS: Record<SubPageKey | "dayCheck" | "newSession" | "training", LucideIcon> = {
  journal: List,
  calendar: CalendarDays,
  projects: Target,
  myProgrammes: Layers,
  away: Luggage,
  library: BookOpen,
  rivalDuel: Swords,
  rivalSettings: SlidersHorizontal,
  // Under Progrès, the climbing and training pages reuse their domain icon;
  // the area they sit in is shown by colour.
  climbingProgress: Mountain,
  trainingHistory: Dumbbell,
  mobility: PersonStanding,
  assessment: ClipboardCheck,
  profile: UserRound,
  connections: Plug,
  settings: Settings,
  dayCheck: HeartPulse,
  newSession: Plus,
  training: Dumbbell,
};

export const AdminIcon = ShieldCheck;
export const SignOutIcon = LogOut;

/**
 * Progrès › Grimpe sections: one icon and one tone each, shared by the
 * summary's rows and its hero figures, so a section keeps its colour.
 */
export const PROGRESS_SECTION_ICONS: Record<Exclude<ProgressTab, "overview">, { icon: LucideIcon; tone: Tone }> = {
  "boulder-indoor": { icon: BrickWall, tone: "blue" },
  "boulder-outdoor": { icon: Trees, tone: "green" },
  "route-indoor": { icon: ArrowUpToLine, tone: "violet" },
  "route-outdoor": { icon: MountainSnow, tone: "teal" },
  boards: { icon: Grid3x3, tone: "amber" },
  gyms: { icon: MapPin, tone: "sky" },
  styles: { icon: Sparkles, tone: "rose" },
  avatar: { icon: Award, tone: "gold" },
};

/** Progrès › Aperçu: one icon and tone per section its tiles open. */
export const FOLLOW_UP_SECTION_ICONS: Record<Exclude<FollowUpTab, "overview">, { icon: LucideIcon; tone: Tone }> = {
  load: { icon: Activity, tone: "amber" },
  climbing: { icon: Mountain, tone: "blue" },
  training: { icon: Dumbbell, tone: "sky" },
  compare: { icon: GitCompareArrows, tone: "violet" },
};
