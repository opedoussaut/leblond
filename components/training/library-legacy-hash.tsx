"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { libraryHref } from "@/lib/navigation/library-tabs";

/**
 * Old Bibliothèque anchors (/atlas#templates-heading, /atlas#atlas) pointed at
 * blocks that now live in their own section: send bookmarks there.
 */
export function LibraryLegacyHash() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash;
    if (hash === "#templates-heading") router.replace(libraryHref("templates") + hash);
    else if (hash === "#atlas") router.replace(libraryHref("methods"));
  }, [router]);
  return null;
}
