"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { sectionForPath, type SectionId } from "@/lib/navigation/sections";
import { AtlasIcon, CalendarIcon, HomeIcon, PatrickIcon, ProfileIcon, ProgressIcon, SessionIcon } from "./nav-icons";

const AREAS = [
  { id: "home", href: "/home", Icon: HomeIcon, children: [] },
  {
    id: "climbing", href: "/climbing", Icon: SessionIcon,
    children: [
      { href: "/session", key: "session", Icon: SessionIcon },
      { href: "/projects", key: "projects", Icon: ProgressIcon },
    ],
  },
  {
    id: "training", href: "/train", Icon: AtlasIcon,
    children: [
      { href: "/calendar", key: "calendar", Icon: CalendarIcon },
      { href: "/atlas", key: "atlas", Icon: AtlasIcon },
      { href: "/training-plans", key: "trainingPlans", Icon: ProgressIcon },
      { href: "/patrick", key: "patrick", Icon: PatrickIcon },
    ],
  },
  {
    id: "followUp", href: "/follow-up", Icon: ProgressIcon,
    children: [
      { href: "/progress", key: "progress", Icon: ProgressIcon },
      { href: "/training-assessment", key: "assessment", Icon: ProgressIcon },
    ],
  },
  { id: "profile", href: "/profile", Icon: ProfileIcon, children: [] },
] as const;

function childIsActive(pathname: string, href: string) {
  if (href === "/session") {
    return pathname.startsWith("/session") || pathname.startsWith("/problem");
  }
  if (href === "/atlas") {
    return pathname.startsWith("/atlas") ||
      (pathname.startsWith("/training") && !pathname.startsWith("/training/evaluate") &&
       !pathname.startsWith("/training-assessment") && !pathname.startsWith("/training-plans"));
  }
  if (href === "/training-assessment") {
    return pathname.startsWith("/training-assessment") || pathname.startsWith("/training/evaluate");
  }
  return pathname === href || pathname.startsWith(href + "/");
}

/**
 * The active highlight tracks the current AREA and the selected subpage.
 * Session is no longer permanently emphasized while browsing other areas.
 */
export function AppNav({ hasLiveSession }: { hasLiveSession: boolean }) {
  const pathname = usePathname();
  const currentArea = sectionForPath(pathname);
  const { t } = useI18n();

  return (
    <>
      <nav aria-label={t.nav.mainNav}
        className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r border-line bg-surface px-3 pb-6 pt-24 md:block">
        <div className="space-y-2">
          {AREAS.map(({ id, href, Icon, children }) => {
            const selected = id === currentArea;
            const onHub = pathname === href;
            return (
              <div key={id} className="border-b border-line/60 pb-2 last:border-0">
                <Link href={href}
                  aria-current={onHub ? "page" : undefined}
                  data-active-area={selected ? "true" : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-extrabold transition-colors",
                    selected ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-2",
                  )}>
                  <Icon />
                  <span>{t.nav[id]}</span>
                </Link>
                {children.length > 0 && (
                  <ul className="ml-5 mt-1 space-y-0.5 border-l border-line pl-3">
                    {children.map(({ href: subHref, key, Icon: SubIcon }) => {
                      const active = childIsActive(pathname, subHref);
                      return <li key={subHref}>
                        <Link href={subHref}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-10 items-center gap-2.5 rounded-lg px-2 text-xs font-semibold transition-colors",
                            active ? "bg-accent-soft text-accent" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                          )}>
                          <span className="[&_svg]:h-4 [&_svg]:w-4"><SubIcon /></span>
                          {t.nav[key]}
                          {subHref === "/session" && hasLiveSession ? (
                            <span className="ml-auto h-2 w-2 rounded-full bg-ok" aria-label={t.session.active}/>
                          ) : null}
                        </Link>
                      </li>;
                    })}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      </nav>
      <nav aria-label={t.nav.mainNav}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-1 px-1.5 pt-1.5">
          {AREAS.map(({ id, href, Icon }) => {
            const selected = currentArea === id;
            return (
              <li key={id} className="min-w-0 flex-1">
                <Link href={href} aria-current={selected ? "page" : undefined}
                  className={cn(
                    "flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-semibold",
                    selected ? "bg-accent-soft text-accent" : "text-ink-3",
                  )}>
                  <span className="[&_svg]:h-5 [&_svg]:w-5"><Icon /></span>
                  <span className="truncate">{t.nav[id]}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}
