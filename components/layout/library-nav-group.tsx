"use client";

import type { ReactNode } from "react";
import { useI18n } from "@/components/i18n-provider";
import { areasDictionary } from "@/lib/i18n/areas";
import { LIBRARY_TABS, libraryHref } from "@/lib/navigation/library-tabs";
import { PROGRESS_TABS, progressHref } from "@/lib/navigation/progress-tabs";
import { NavTabGroup } from "./nav-tab-group";

type GroupProps = { href: string; active: boolean; label: string; icon: ReactNode; itemClass: (filled: boolean) => string };

/** Bibliothèque in the sidebar, with its sections; the Bibliothèque link itself opens the overview. */
export function LibraryNavGroup(props: GroupProps) {
  const { locale } = useI18n();
  const labels = areasDictionary(locale).library.tabs;
  return <NavTabGroup {...props} path="/atlas"
    tabs={LIBRARY_TABS.filter((tab) => tab !== "overview").map((tab) => ({ id: tab, href: libraryHref(tab), label: labels[tab] }))} />;
}

/** Grimpe in the sidebar: bloc and voie, indoors and outdoors, and boards; the Grimpe link itself shows everything. */
export function ProgressNavGroup(props: GroupProps) {
  const { locale } = useI18n();
  const labels = areasDictionary(locale).climbing.tabs;
  return <NavTabGroup {...props} path="/progress"
    tabs={PROGRESS_TABS.filter((tab) => tab !== "overview").map((tab) => ({ id: tab, href: progressHref(tab), label: labels[tab] }))} />;
}
