"use client";

import { useEffect } from "react";
import { forgetOfflinePages } from "@/lib/offline/service-worker";
import { forgetSentSessions } from "@/lib/offline/session-store";

/**
 * On the sign-in page (after signing out): no private page or session stays on
 * the phone, except changes never sent, which go out when the same climber
 * signs in again.
 */
export function ForgetOfflineData() {
  useEffect(() => {
    forgetOfflinePages();
    try {
      forgetSentSessions(window.localStorage);
    } catch {
      /* storage unavailable: nothing kept */
    }
  }, []);
  return null;
}
