"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createProgrammeForAssessment } from "@/lib/actions/training-assessments";
import type { Locale } from "@/lib/i18n";
import { journeyDictionary } from "@/lib/i18n/training-journey";
import { buttonClass } from "@/components/ui/button";

/** Builds the weekly template of an assessment saved before programmes were linked to it. */
export function CreateProgrammeButton({ locale, assessmentId }: { locale: Locale; assessmentId: string }) {
  const j = journeyDictionary(locale);
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, start] = useTransition();
  return <div className="space-y-2">
    <button type="button" disabled={pending} className={buttonClass("primary", "sm")}
      onClick={() => start(async () => {
        setError("");
        const r = await createProgrammeForAssessment(assessmentId);
        if (!r.ok) { setError(r.error === "limit" ? j.full.planLimit : j.hub.createPlanError); return; }
        router.refresh();
      })}>{pending ? "…" : j.hub.createPlan}</button>
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{error}</p> : null}
  </div>;
}
