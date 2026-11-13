"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Minus, Plus } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass, iconButtonClass, linkClass, segmentClass, segmentGroupClass } from "@/components/ui/button";
import { cn } from "@/components/ui/cn";
import { fieldClass } from "@/components/ui/field";
import { startBoardSession } from "@/lib/actions/boards";
import { ANGLE_STEP, BOARD_LAYOUTS, BOARD_SHORT, BOARDS, DEFAULT_ANGLE, boardAngles, clampAngle, type Board } from "@/lib/climbing/boards";
import { fmt } from "@/lib/i18n";
import { boardsDictionary } from "@/lib/i18n/boards";
import { localDate_ } from "@/lib/training/sessions";

/** Angle picker in 5° steps, limited to what the board offers. */
export function AngleStepper({ board, angle, onChange, disabled }: { board: Board; angle: number; onChange: (a: number) => void; disabled?: boolean }) {
  const { locale } = useI18n();
  const b = boardsDictionary(locale);
  const angles = boardAngles(board);
  const i = angles.indexOf(angle);
  return <div className="flex items-center gap-3">
    <button type="button" aria-label={b.angleDown} disabled={disabled || i <= 0} onClick={() => onChange(angles[i - 1])} className={iconButtonClass()}>
      <Minus aria-hidden="true" className="size-5" />
    </button>
    <output aria-live="polite" className="min-w-16 text-center font-display text-2xl font-black tabular-nums" data-testid="board-angle">{fmt(b.angleValue, { a: angle })}</output>
    <button type="button" aria-label={b.angleUp} disabled={disabled || i >= angles.length - 1} onClick={() => onChange(angles[i + 1])} className={iconButtonClass()}>
      <Plus aria-hidden="true" className="size-5" />
    </button>
  </div>;
}

export function BoardStart({ gyms }: { gyms: { id: string; name: string }[] }) {
  const { locale } = useI18n();
  const b = boardsDictionary(locale);
  const router = useRouter();
  const [board, setBoard] = useState<Board>("KILTER");
  const [layout, setLayout] = useState<string>(BOARD_LAYOUTS.KILTER[0] ?? "");
  const [angle, setAngle] = useState(DEFAULT_ANGLE);
  const [atGym, setAtGym] = useState(false);
  const [gymId, setGymId] = useState(gyms[0]?.id ?? "");
  const [past, setPast] = useState(false);
  const [date, setDate] = useState(localDate_(new Date()));
  const [time, setTime] = useState("18:00");
  const [minutes, setMinutes] = useState(60);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function pickBoard(next: Board) {
    setBoard(next);
    setLayout(BOARD_LAYOUTS[next][0] ?? "");
    setAngle((a) => clampAngle(next, a));
  }

  function submit() {
    setError(false);
    start(async () => {
      const r = await startBoardSession({
        board, layout, angle, gymId: atGym && gymId ? gymId : null,
        past: past ? { date, time, minutes } : null,
      });
      if (r.ok && r.data) router.push(`/session/${r.data.sessionId}`); else setError(true);
    });
  }

  return <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); submit(); }} aria-labelledby="board-start-heading">
    <div>
      <h2 id="board-start-heading" className="text-lg font-bold">{b.startTitle}</h2>
      <p className="mt-1 text-sm text-ink-2">{b.startHint}</p>
    </div>
    <fieldset>
      <legend className="text-sm font-semibold">{b.board}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {BOARDS.map((x) => <button key={x} type="button" aria-pressed={board === x} onClick={() => pickBoard(x)}
          className={buttonClass(board === x ? "primary" : "secondary", "sm")}>{BOARD_SHORT[x]}</button>)}
      </div>
    </fieldset>
    {BOARD_LAYOUTS[board].length ? <fieldset>
      <legend className="text-sm font-semibold">{b.layout}</legend>
      <div className="mt-2 flex flex-wrap gap-2">
        {BOARD_LAYOUTS[board].map((l) => <button key={l} type="button" aria-pressed={layout === l} onClick={() => setLayout(l)}
          className={buttonClass(layout === l ? "primary" : "secondary", "sm")}>{l}</button>)}
      </div>
    </fieldset> : null}
    <fieldset>
      <legend className="text-sm font-semibold">{b.angle} <span className="font-normal text-ink-3">({ANGLE_STEP}°)</span></legend>
      <div className="mt-2"><AngleStepper board={board} angle={angle} onChange={setAngle} /></div>
    </fieldset>
    <fieldset>
      <legend className="text-sm font-semibold">{b.where}</legend>
      <div className={cn(segmentGroupClass, "mt-2 grid-cols-2")}>
        <button type="button" aria-pressed={!atGym} onClick={() => setAtGym(false)} className={segmentClass(!atGym)}>{b.home}</button>
        <button type="button" aria-pressed={atGym} disabled={!gyms.length} onClick={() => setAtGym(true)} className={segmentClass(atGym)}>{b.atGym}</button>
      </div>
      {atGym ? <label className="mt-3 block text-sm font-semibold">{b.gym}
        <select className={fieldClass} value={gymId} onChange={(e) => setGymId(e.target.value)}>
          {gyms.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
        </select>
      </label> : null}
    </fieldset>
    <label className="flex min-h-11 items-center gap-3 text-sm font-semibold">
      <input type="checkbox" className="size-5 accent-accent" checked={past} onChange={(e) => setPast(e.target.checked)} />
      {b.past}
    </label>
    {past ? <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      <label className="text-sm font-semibold">{b.date}<input type="date" required className={fieldClass} value={date} max={localDate_(new Date())} onChange={(e) => setDate(e.target.value)} /></label>
      <label className="text-sm font-semibold">{b.time}<input type="time" required className={fieldClass} value={time} onChange={(e) => setTime(e.target.value)} /></label>
      <label className="text-sm font-semibold">{b.minutes}<input type="number" required min={10} max={720} className={fieldClass} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} /></label>
    </div> : null}
    {error ? <p role="alert" className="text-sm font-semibold text-danger">{b.error}</p> : null}
    <div className="flex flex-wrap items-center gap-4">
      <button type="submit" disabled={pending} className={buttonClass("primary", "lg")}>{past ? b.record : b.start}</button>
      <Link href="/session/board-import" className={cn(linkClass, "text-sm")}>{b.importLink}</Link>
    </div>
  </form>;
}
