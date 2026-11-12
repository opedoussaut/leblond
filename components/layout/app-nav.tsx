"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { AREAS, activeSubPage, isAreaOverview, pagesFor, sectionForPath } from "@/lib/navigation/sections";
import { AccountMenu } from "./account-menu";
import { AREA_ICONS, PAGE_ICONS } from "./nav-icons";

/**
 * Main navigation. Exactly one area is selected at a time and only that area's
 * pages are listed — the other areas collapse to a single entry.
 *
 * Highlighting: the current page is the only filled item (the area link itself
 * on an area overview, otherwise the sub-page). Its area is shown by colour.
 * aria-current="page" marks the current page, aria-current="true" its area.
 */
export function AppNav({ hasLiveSession, hasLiveTraining, displayName, isAdmin }: {
  hasLiveSession: boolean;
  hasLiveTraining: boolean;
  displayName: string;
  isAdmin: boolean;
}) {
  const pathname = usePathname();
  const currentArea = sectionForPath(pathname);
  const currentPage = activeSubPage(pathname);
  const { t } = useI18n();

  return (
    <>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface md:flex">
        <nav aria-label={t.nav.mainNav} className="flex-1 overflow-y-auto px-3 pb-4 pt-24">
          <ul className="space-y-1">
            {AREAS.map((area) => {
              const { id, href, children } = area;
              const selected = id === currentArea;
              const isPage = selected && isAreaOverview(area, pathname);
              const Icon = AREA_ICONS[id];
              const live = (id === "climbing" && hasLiveSession) || (id === "training" && hasLiveTraining);
              return (
                <li key={id}>
                  <Link href={href}
                    aria-current={isPage ? "page" : selected ? "true" : undefined}
                    data-active-area={selected ? "true" : undefined}
                    className={cn(
                      "flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-bold transition-colors [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0",
                      isPage ? "bg-accent text-accent-ink"
                        : selected ? "text-accent hover:bg-surface-2"
                        : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                    )}>
                    <Icon aria-hidden="true" strokeWidth={selected ? 2.25 : 2} />
                    <span>{t.nav[id]}</span>
                    {live ? <span className="ml-auto h-2 w-2 rounded-full bg-ok" aria-label={t.session.active} /> : null}
                  </Link>
                  {selected && children.length > 0 ? (
                    <ul className="mb-2 ml-[1.375rem] mt-1 space-y-0.5 border-l-2 border-accent/25 pl-2.5">
                      {children.map((child) => {
                        const active = currentPage?.href === child.href;
                        const ChildIcon = PAGE_ICONS[child.key];
                        return <li key={child.href}>
                          <Link href={child.href}
                            aria-current={active ? "page" : undefined}
                            className={cn(
                              "flex min-h-10 items-center gap-2.5 rounded-lg px-2.5 text-sm font-semibold transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
                              active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                            )}>
                            <ChildIcon aria-hidden="true" />
                            <span>{t.nav[child.key]}</span>
                          </Link>
                        </li>;
                      })}
                    </ul>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </nav>
        {/* Account menu: always in the same place, at the foot of the sidebar. */}
        <div className="border-t border-line p-3">
          <AccountMenu displayName={displayName} isAdmin={isAdmin} placement="sidebar" />
        </div>
      </aside>
      <nav aria-label={t.nav.mainNav}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="mx-auto grid max-w-xl grid-cols-5 gap-0.5 px-1 pt-1">
          {AREAS.map((area) => {
            const { id, href } = area;
            const selected = currentArea === id;
            const isPage = selected && isAreaOverview(area, pathname);
            const Icon = AREA_ICONS[id];
            const live = (id === "climbing" && hasLiveSession) || (id === "training" && hasLiveTraining);
            return (
              <li key={id} className="min-w-0">
                <Link href={href} aria-current={isPage ? "page" : selected ? "true" : undefined}
                  data-active-area={selected ? "true" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-center text-[11px] leading-tight transition-colors",
                    selected ? "font-extrabold text-accent" : "font-semibold text-ink-3 hover:text-ink",
                  )}>
                  {selected ? <span aria-hidden="true" className="absolute inset-x-5 top-0 h-[3px] rounded-full bg-accent" /> : null}
                  <Icon aria-hidden="true" className="h-[22px] w-[22px]" strokeWidth={selected ? 2.25 : 1.9} />
                  <span className="max-w-full truncate">{t.nav[id]}</span>
                  {live ? <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-ok" aria-label={t.session.active} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/**
 * Mobile-only secondary navigation: the pages of the current area (or of the
 * account menu), nothing else. Equal-width segments, so every entry stays
 * visible at 375 px — nothing scrolls off-screen.
 */
export function AreaSubNav() {
  const pathname = usePathname();
  const pages = pagesFor(sectionForPath(pathname));
  const currentPage = activeSubPage(pathname);
  const { t } = useI18n();
  if (pages.length === 0) return null;
  return (
    <nav aria-label={t.nav.subNav} className="mb-5 md:hidden">
      <ul className="grid auto-cols-fr grid-flow-col gap-1 rounded-2xl border border-line bg-surface p-1">
        {pages.map((child) => {
          const active = currentPage?.href === child.href;
          const Icon = PAGE_ICONS[child.key];
          return <li key={child.href} className="min-w-0">
            <Link href={child.href} aria-current={active ? "page" : undefined}
              className={cn(
                "flex min-h-12 flex-col items-center justify-center gap-0.5 rounded-xl text-center font-semibold leading-tight transition-colors",
                // Four segments (Progrès once Mobilité lands) still fit "Entraînement" at 375 px.
                pages.length >= 4 ? "px-0.5 text-[11px] tracking-tight" : "px-1 text-xs",
                active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
              )}>
              <Icon aria-hidden="true" className="h-[18px] w-[18px] shrink-0" />
              <span className="max-w-full truncate">{t.nav[child.key]}</span>
            </Link>
          </li>;
        })}
      </ul>
    </nav>
  );
}
