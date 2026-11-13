/**
 * Navigation icons. They come from Lucide (lucide-react, ISC licence,
 * https://lucide.dev/license), a third-party icon set; LEBLOND's own artwork
 * (logo, illustrations) stays in public/brand.
 *
 * One icon per area and per page, used everywhere the page is named: desktop
 * sidebar, mobile bottom bar and chips, page headers and hub cards.
 */
import {
  BookOpen, CalendarDays, ClipboardCheck, Dumbbell, HeartPulse, Layers, List, LogOut, MessageCircle,
  Mountain, PersonStanding, Plus, Plug, Settings, ShieldCheck, Sun, Target, TrendingUp, UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SectionId, SubPageKey } from "@/lib/navigation/sections";

export type { LucideIcon };

export const AREA_ICONS: Record<SectionId, LucideIcon> = {
  today: Sun,
  sessions: Mountain,
  programmes: Layers,
  progress: TrendingUp,
  patrick: MessageCircle,
};

/** Pages named in the navigation, plus a few pages reached from inside an area. */
export const PAGE_ICONS: Record<SubPageKey | "dayCheck" | "newSession" | "training", LucideIcon> = {
  journal: List,
  calendar: CalendarDays,
  projects: Target,
  myProgrammes: Layers,
  library: BookOpen,
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
