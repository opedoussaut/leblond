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
  Mountain, Play, Plug, Settings, ShieldCheck, Sun, Target, TrendingUp, UserRound,
  type LucideIcon,
} from "lucide-react";
import type { SectionId, SubPageKey } from "@/lib/navigation/sections";

export type { LucideIcon };

export const AREA_ICONS: Record<SectionId, LucideIcon> = {
  today: Sun,
  climbing: Mountain,
  training: Dumbbell,
  progress: TrendingUp,
  patrick: MessageCircle,
};

export const PAGE_ICONS: Record<SubPageKey, LucideIcon> = {
  dayCheck: HeartPulse,
  calendar: CalendarDays,
  session: List,
  projects: Target,
  trainingSessions: Play,
  trainingPlans: Layers,
  atlas: BookOpen,
  // Under Progrès, the climbing and training pages reuse their domain icon;
  // the area they sit in is shown by colour.
  climbingProgress: Mountain,
  trainingHistory: Dumbbell,
  assessment: ClipboardCheck,
  profile: UserRound,
  connections: Plug,
  settings: Settings,
};

export const AdminIcon = ShieldCheck;
export const SignOutIcon = LogOut;
