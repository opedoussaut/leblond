"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";

const TIMEOUT_MS = 4000;

/**
 * Moves keyboard / screen-reader focus to the destination page's <h1> after a
 * pathname change — but only once the DESTINATION heading is in the DOM.
 *
 * During streamed or suspended transitions the outgoing heading can still be
 * mounted when the pathname updates, so we remember the heading (element and
 * text) seen on the previous page and wait, via a MutationObserver, for a
 * different one. Never steals focus on first load or on query-only updates
 * (for example calendar month changes). Scroll is left to the router, so
 * back/forward navigation keeps its restored position.
 */
export function RouteFocus() {
  const pathname = usePathname();
  const previousPath = useRef(pathname);
  const previousHeading = useRef<{ el: HTMLElement | null; text: string }>({ el: null, text: "" });

  // Snapshot the outgoing heading when a navigation starts (link click or
  // history traversal), in case it streamed in after our last effect ran.
  useEffect(() => {
    const record = () => {
      const h = document.querySelector<HTMLElement>("#app-main h1");
      previousHeading.current = { el: h, text: h?.textContent ?? "" };
    };
    document.addEventListener("click", record, true);
    window.addEventListener("popstate", record, true);
    return () => {
      document.removeEventListener("click", record, true);
      window.removeEventListener("popstate", record, true);
    };
  }, []);

  useEffect(() => {
    const main = document.getElementById("app-main");
    const current = () => main?.querySelector<HTMLElement>("h1") ?? null;

    if (pathname === previousPath.current) {
      const h = current();
      previousHeading.current = { el: h, text: h?.textContent ?? "" };
      return;
    }
    previousPath.current = pathname;
    const old = previousHeading.current;

    const isDestination = (h: HTMLElement | null): h is HTMLElement =>
      !!h && h.isConnected && (h !== old.el || (h.textContent ?? "") !== old.text);

    const focus = (h: HTMLElement) => {
      h.setAttribute("tabindex", "-1");
      h.setAttribute("data-route-focus", pathname);
      h.focus({ preventScroll: true });
      previousHeading.current = { el: h, text: h.textContent ?? "" };
    };

    const ready = current();
    if (isDestination(ready)) {
      focus(ready);
      return;
    }
    if (!main) return;
    let done = false;
    const observer = new MutationObserver(() => {
      const h = current();
      if (!done && isDestination(h)) {
        done = true;
        observer.disconnect();
        window.clearTimeout(timer);
        focus(h);
      }
    });
    observer.observe(main, { childList: true, subtree: true, characterData: true });
    const timer = window.setTimeout(() => {
      // Same component re-rendered with identical text (e.g. two similar
      // detail pages): fall back to whatever heading is now displayed.
      observer.disconnect();
      const h = current();
      if (!done && h) focus(h);
      done = true;
    }, TIMEOUT_MS);
    return () => {
      done = true;
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [pathname]);

  return null;
}
