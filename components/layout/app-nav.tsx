"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { HomeIcon, PatrickIcon, ProfileIcon, ProgressIcon, SessionIcon } from "./nav-icons";

const ITEMS = [
  { href: "/home", key: "home", Icon: HomeIcon },
  { href: "/progress", key: "progress", Icon: ProgressIcon },
  { href: "/session", key: "session", Icon: SessionIcon, primary: true },
  { href: "/patrick", key: "patrick", Icon: PatrickIcon },
  { href: "/profile", key: "profile", Icon: ProfileIcon },
] as const;

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(`${href}/`) ||
    (href === "/session" && pathname.startsWith("/problem")) ||
    (href === "/profile" && (pathname.startsWith("/settings") || pathname.startsWith("/projects")));
}

/** Bottom tab bar on mobile, sidebar on desktop. Session is the central action. */
export function AppNav({ hasLiveSession }: { hasLiveSession: boolean }) {
  const pathname = usePathname();
  const { t } = useI18n();
  return (
    <nav
      aria-label={t.nav.mainNav}
      className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur md:inset-y-0 md:left-0 md:right-auto md:w-56 md:border-r md:border-t-0 md:pb-0"
    >
      <ul className="mx-auto flex max-w-md items-end justify-around px-2 pt-1.5 md:mt-20 md:max-w-none md:flex-col md:items-stretch md:gap-1 md:px-3">
        {ITEMS.map(({ href, key, Icon, ...rest }) => {
          const active = isActive(pathname, href);
          const primary = "primary" in rest && rest.primary;
          return (
            <li key={href} className="md:w-full">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex min-h-14 min-w-14 flex-col items-center justify-center gap-0.5 rounded-xl px-2 text-[11px] font-semibold md:flex-row md:justify-start md:gap-3 md:px-3 md:text-sm",
                  active ? "text-accent" : "text-ink-3 hover:text-ink",
                  primary && "md:bg-accent md:text-accent-ink md:hover:text-accent-ink",
                )}
              >
                {primary ? (
                  <span
                    className={cn(
                      "-mt-6 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-ink shadow-lg md:mt-0 md:h-auto md:w-auto md:bg-transparent md:shadow-none",
                    )}
                  >
                    <Icon />
                  </span>
                ) : (
                  <Icon />
                )}
                <span>{t.nav[key]}</span>
                {primary && hasLiveSession ? (
                  <span className="absolute right-2 top-0 h-2.5 w-2.5 rounded-full bg-ok ring-2 ring-surface md:right-3 md:top-1/2 md:-translate-y-1/2" aria-label={t.session.active} />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
