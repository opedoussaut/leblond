"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ChevronsUpDown } from "lucide-react";
import { signOut } from "@/app/(public)/login/actions";
import { useI18n } from "@/components/i18n-provider";
import { cn } from "@/components/ui/cn";
import { fmt } from "@/lib/i18n";
import { ACCOUNT_PAGES, activeSubPage, sectionForPath } from "@/lib/navigation/sections";
import { AdminIcon, PAGE_ICONS, SignOutIcon } from "./nav-icons";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const letters = parts.length === 1 ? parts[0].slice(0, 2) : parts[0][0] + parts[parts.length - 1][0];
  return letters.toUpperCase();
}

export function Avatar({ name, size = 32 }: { name: string; size?: number }) {
  return <span aria-hidden="true" style={{ width: size, height: size, fontSize: size * 0.38 }}
    className="inline-flex shrink-0 items-center justify-center rounded-full bg-accent-soft font-black text-accent ring-1 ring-accent/20">
    {initials(name)}
  </span>;
}

/**
 * Account menu behind the avatar: Profil, Connexions, Réglages (and
 * Administration for admins), then Déconnexion. A disclosure button —
 * aria-expanded / aria-controls — with keyboard support: Enter, Space or
 * ArrowDown opens it, arrows move between items, Esc closes it and returns
 * focus to the button. Clicking outside or tabbing away closes it too.
 *
 * `placement="sidebar"` opens upwards from the foot of the desktop sidebar;
 * `placement="header"` drops down from the mobile header.
 */
export function AccountMenu({ displayName, isAdmin, placement }: {
  displayName: string;
  isAdmin: boolean;
  placement: "sidebar" | "header";
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const root = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const inAccount = sectionForPath(pathname) === "account";
  const current = inAccount ? activeSubPage(pathname) : null;
  const onAdmin = pathname === "/settings/admin" || pathname.startsWith("/settings/admin/");

  // Close on a pointer press outside the menu.
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (root.current && !root.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", onPointer);
    return () => document.removeEventListener("pointerdown", onPointer);
  }, [open]);

  const items = () => Array.from(root.current?.querySelectorAll<HTMLElement>("[data-menu-item]") ?? []);
  const focusItem = (index: number) => {
    const list = items();
    if (list.length) list[(index + list.length) % list.length].focus();
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "Escape" && open) {
      e.preventDefault();
      setOpen(false);
      button.current?.focus();
      return;
    }
    const list = items();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!open) {
        setOpen(true);
        // Wait for the panel to be shown before moving focus into it.
        requestAnimationFrame(() => focusItem(e.key === "ArrowDown" ? 0 : -1));
        return;
      }
      focusItem(index === -1 ? (e.key === "ArrowDown" ? 0 : -1) : index + (e.key === "ArrowDown" ? 1 : -1));
    } else if (open && index !== -1 && (e.key === "Home" || e.key === "End")) {
      e.preventDefault();
      focusItem(e.key === "Home" ? 0 : -1);
    }
  };

  const itemClass = (active: boolean) => cn(
    "flex min-h-11 w-full items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
    active ? "bg-accent text-accent-ink" : "text-ink-2 hover:bg-surface-2 hover:text-ink focus-visible:bg-surface-2",
  );
  const sidebar = placement === "sidebar";

  return (
    <div ref={root} className="relative" onKeyDown={onKeyDown}
      onBlur={(e) => {
        // Tabbing out closes the menu. A null relatedTarget (e.g. Safari, which
        // does not focus links on click) is left to the pointerdown handler,
        // otherwise the menu would vanish before the click lands.
        const next = e.relatedTarget as Node | null;
        if (open && next && !root.current?.contains(next)) setOpen(false);
      }}>
      <button ref={button} type="button" aria-expanded={open} aria-controls={panelId}
        aria-label={sidebar ? undefined : fmt(t.nav.accountMenuOf, { name: displayName })}
        data-active-area={inAccount ? "true" : undefined}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex items-center rounded-xl transition-colors",
          sidebar ? "min-h-14 w-full gap-3 px-2.5 text-left hover:bg-surface-2" : "h-11 w-11 justify-center hover:bg-surface-2",
          open && "bg-surface-2",
        )}>
        <Avatar name={displayName} size={sidebar ? 34 : 32} />
        {sidebar ? <>
          <span className="min-w-0 flex-1">
            <span className={cn("block truncate text-sm font-bold", inAccount ? "text-accent" : "text-ink")}>{displayName}</span>
            <span className="block text-xs font-semibold text-ink-3">{t.nav.accountMenu}</span>
          </span>
          <ChevronsUpDown aria-hidden="true" className="h-4 w-4 shrink-0 text-ink-3" />
        </> : null}
      </button>
      <div id={panelId} hidden={!open}
        className={cn(
          "absolute z-50 rounded-2xl border border-line bg-surface p-1.5 shadow-[0_12px_40px_rgba(19,36,56,0.16)]",
          sidebar ? "inset-x-0 bottom-full mb-2" : "right-0 top-full mt-2 w-64",
        )}>
        <p className="truncate px-3 pb-1.5 pt-2 text-xs font-bold uppercase tracking-[0.1em] text-ink-3">{displayName}</p>
        <ul className="space-y-0.5">
          {ACCOUNT_PAGES.map((page) => {
            const Icon = PAGE_ICONS[page.key];
            const active = current?.href === page.href && !onAdmin;
            return <li key={page.href}>
              <Link href={page.href} data-menu-item aria-current={active ? "page" : undefined}
                onClick={() => setOpen(false)} className={itemClass(active)}>
                <Icon aria-hidden="true" />{t.nav[page.key]}
              </Link>
            </li>;
          })}
          {isAdmin ? <li>
            <Link href="/settings/admin" data-menu-item aria-current={onAdmin ? "page" : undefined}
              onClick={() => setOpen(false)} className={itemClass(onAdmin)}>
              <AdminIcon aria-hidden="true" />{t.nav.admin}
            </Link>
          </li> : null}
        </ul>
        <form action={signOut} className="mt-1 border-t border-line pt-1">
          <button type="submit" data-menu-item className={itemClass(false)}>
            <SignOutIcon aria-hidden="true" />{t.nav.signOut}
          </button>
        </form>
      </div>
    </div>
  );
}
