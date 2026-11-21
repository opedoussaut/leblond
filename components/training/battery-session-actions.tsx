"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { finishBattery, saveBatteryD1, stopBattery } from "@/lib/actions/mobility-battery";
import type { Locale } from "@/lib/i18n";
import { batteryDictionary } from "@/lib/i18n/mobility-battery";
import { buttonClass, dangerLinkClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { Notice } from "@/components/ui/card";

/** Finish or stop an open bilan. */
export function BatterySessionActions({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const t = batteryDictionary(locale);
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const run = (fn: typeof finishBattery) => start(async () => {
    const r = await fn(sessionId);
    if (r.ok) router.push(`/follow-up/mobility/battery/${sessionId}`);
    else setError(t.errors[r.error]);
  });
  return <div className="space-y-3">
    <p className="text-sm text-ink-2">{t.finishHint}</p>
    {error ? <Notice tone="error">{error}</Notice> : null}
    <div className="flex flex-wrap items-center gap-3">
      <button type="button" disabled={pending} className={buttonClass("primary", "md")} onClick={() => run(finishBattery)}>{pending ? t.finishing : t.finish}</button>
      <button type="button" disabled={pending} className={dangerLinkClass} onClick={() => { if (window.confirm(t.stopConfirm)) run(stopBattery); }}>{t.stopSession}</button>
    </div>
  </div>;
}

/** The next-day symptom check. */
export function BatteryD1Form({ locale, sessionId }: { locale: Locale; sessionId: string }) {
  const t = batteryDictionary(locale);
  const router = useRouter();
  const [v, setV] = useState({ backPain: "", legPain: "", radiationLower: false, newSymptoms: false, note: "" });
  const [msg, setMsg] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const pains = Array.from({ length: 11 }, (_, i) => i);
  function save() {
    if (v.backPain === "" || v.legPain === "") { setMsg({ tone: "error", text: t.errors.invalid }); return; }
    start(async () => {
      const r = await saveBatteryD1({ sessionId, backPain: Number(v.backPain), legPain: Number(v.legPain), radiationLower: v.radiationLower, newSymptoms: v.newSymptoms, note: v.note });
      setMsg(r.ok ? { tone: "ok", text: t.d1Saved } : { tone: "error", text: t.errors[r.error] });
      if (r.ok) router.refresh();
    });
  }
  return <div className="space-y-3">
    <div className="grid gap-3 sm:grid-cols-2">
      {(["backPain", "legPain"] as const).map((k) => <label key={k} className="block text-sm font-semibold">{k === "backPain" ? t.d1BackPain : t.d1LegPain}
        <select className={fieldClass} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}>
          <option value="">—</option>{pains.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>)}
    </div>
    {(["radiationLower", "newSymptoms"] as const).map((k) => <label key={k} className="flex items-start gap-3 text-sm">
      <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-accent" checked={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.checked })} />
      {k === "radiationLower" ? t.d1RadiationLower : t.d1NewSymptoms}
    </label>)}
    {msg ? <Notice tone={msg.tone}>{msg.text}</Notice> : null}
    <button type="button" disabled={pending} className={buttonClass("secondary", "md")} onClick={save}>{t.d1Save}</button>
  </div>;
}
