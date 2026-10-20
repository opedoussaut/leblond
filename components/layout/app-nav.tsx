"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { AREAS, activeSubPage, sectionForPath, type SectionId } from "@/lib/navigation/sections";
import { AtlasIcon, HomeIcon, ProfileIcon, ProgressIcon, SessionIcon } from "./nav-icons";

const AREA_ICONS: Record<SectionId, () => React.JSX.Element> = {
  home: HomeIcon,
  climbing: SessionIcon,
  training: AtlasIcon,
  followUp: ProgressIcon,
  profile: ProfileIcon,
};

/**
 * Main navigation. Exactly one area is selected at a time and only that area's
 * pages are listed — the other areas collapse to a single entry. The selected
 * area carries aria-current="true"; the selected page carries aria-current="page".
 */
export function AppNav({ hasLiveSession, hasLiveTraining }: { hasLiveSession: boolean; hasLiveTraining: boolean }) {
  const pathname = usePathname();
  const currentArea = sectionForPath(pathname);
  const currentPage = activeSubPage(pathname);
  const { t } = useI18n();

  return (
    <>
      <nav aria-label={t.nav.mainNav}
        className="fixed inset-y-0 left-0 z-30 hidden w-64 overflow-y-auto border-r border-line bg-surface px-3 pb-6 pt-24 md:block">
        <ul className="space-y-1">
          {AREAS.map(({ id, href, children }) => {
            const selected = id === currentArea;
            const Icon = AREA_ICONS[id];
            const live = (id === "climbing" && hasLiveSession) || (id === "training" && hasLiveTraining);
            return (
              <li key={id}>
                <Link href={href}
                  aria-current={selected ? (children.length === 0 ? "page" : "true") : undefined}
                  data-active-area={selected ? "true" : undefined}
                  aria-expanded={children.length > 0 ? selected : undefined}
                  className={cn(
                    "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-extrabold transition-colors",
                    selected ? "bg-accent-soft text-accent" : "text-ink hover:bg-surface-2",
                  )}>
                  <Icon />
                  <span>{t.nav[id]}</span>
                  {live ? <span className="ml-auto h-2 w-2 rounded-full bg-ok" aria-label={t.session.active} /> : null}
                </Link>
                {selected && children.length > 0 ? (
                  <ul className="mb-2 ml-5 mt-1 space-y-0.5 border-l border-line pl-3">
                    {children.map((child) => {
                      const active = currentPage?.href === child.href;
                      return <li key={child.href}>
                        <Link href={child.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-10 items-center rounded-lg px-2.5 text-[13px] font-semibold transition-colors",
                            active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink",
                          )}>
                          {t.nav[child.key]}
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
      <nav aria-label={t.nav.mainNav}
        className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:hidden">
        <ul className="mx-auto flex max-w-xl items-stretch justify-around gap-1 px-1.5 pt-1.5">
          {AREAS.map(({ id, href }) => {
            const selected = currentArea === id;
            const Icon = AREA_ICONS[id];
            const live = (id === "climbing" && hasLiveSession) || (id === "training" && hasLiveTraining);
            return (
              <li key={id} className="min-w-0 flex-1">
                <Link href={href} aria-current={selected ? "true" : undefined}
                  data-active-area={selected ? "true" : undefined}
                  className={cn(
                    "relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-center text-[11px] font-semibold",
                    selected ? "bg-accent-soft text-accent" : "text-ink-3",
                  )}>
                  <span className="[&_svg]:h-5 [&_svg]:w-5"><Icon /></span>
                  <span className="truncate">{t.nav[id]}</span>
                  {live ? <span className="absolute right-3 top-2 h-2 w-2 rounded-full bg-ok" aria-label={t.session.active} /> : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </>
  );
}

/** Mobile-only secondary navigation: the pages of the current area, nothing else. */
export function AreaSubNav() {
  const pathname = usePathname();
  const area = AREAS.find((a) => a.id === sectionForPath(pathname));
  const currentPage = activeSubPage(pathname);
  const { t } = useI18n();
  if (!area || area.children.length === 0) return null;
  return (
    <nav aria-label={t.nav.subNav} className="-mx-4 mb-5 overflow-x-auto px-4 sm:-mx-6 sm:px-6 md:hidden">
      <ul className="flex w-max gap-2">
        {area.children.map((child) => {
          const active = currentPage?.href === child.href;
          return <li key={child.href}>
            <Link href={child.href} aria-current={active ? "page" : undefined}
              className={cn(
                "inline-flex min-h-10 items-center whitespace-nowrap rounded-full border px-4 text-[13px] font-semibold",
                active ? "border-accent bg-accent text-accent-ink" : "border-line bg-surface text-ink-2",
              )}>
              {t.nav[child.key]}
            </Link>
          </li>;
        })}
      </ul>
    </nav>
  );
}
