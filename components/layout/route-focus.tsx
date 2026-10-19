"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

/** Preserve intuitive keyboard / screen-reader focus as the user moves
 * between major areas. Never steal focus on first load or query-only updates
 * (for example when changing calendar months). */
export function RouteFocus() {
  const pathname = usePathname();
  const previous = useRef(pathname);
  useEffect(() => {
    if (pathname === previous.current) return;
    previous.current = pathname;
    const heading = document.querySelector<HTMLElement>("#app-main h1");
    if (!heading) return;
    heading.setAttribute("tabindex", "-1");
    heading.focus({ preventScroll: true });
  }, [pathname]);
  return null;
}
