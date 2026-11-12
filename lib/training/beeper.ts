import type { Beep, Tone } from "./timer";

/*
 * The timers' beeps: generated tones (no audio file), scheduled on the audio
 * clock so they ring on time even when the page's own timers are slowed down.
 * Browsers only let a page make sound after a tap, so `unlockSound()` is called
 * from the tap that starts a timer. Phones that can also vibrate.
 *
 * Plain Web Audio mixes with the climber's music instead of stopping it; on an
 * iPhone it follows the silent switch (the player says so).
 */

const SOUND_KEY = "lb-timer-sound";
const VOLUME = 0.25;

type Note = { hz: number; seconds: number; offset: number };
const TONES: Record<Tone, Note[]> = {
  pip: [{ hz: 880, seconds: 0.09, offset: 0 }],
  go: [{ hz: 1320, seconds: 0.4, offset: 0 }],
  stop: [{ hz: 660, seconds: 0.3, offset: 0 }],
  end: [
    { hz: 1320, seconds: 0.15, offset: 0 },
    { hz: 1320, seconds: 0.15, offset: 0.22 },
    { hz: 1760, seconds: 0.45, offset: 0.44 },
  ],
};
const VIBRATIONS: Partial<Record<Tone, number | number[]>> = { go: 250, stop: 120, end: [200, 100, 200, 100, 400] };

let context: AudioContext | null = null;
/** Every sound scheduled and not cancelled, so turning the beeps off silences them at once. */
const live = new Set<() => void>();

function audio(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!context) {
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    try {
      context = new Ctor();
    } catch {
      return null;
    }
  }
  return context;
}

export function soundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundEnabled(on: boolean) {
  try {
    if (on) window.localStorage.removeItem(SOUND_KEY);
    else window.localStorage.setItem(SOUND_KEY, "off");
  } catch {
    /* storage unavailable: the choice lasts until the page closes */
  }
  if (!on) for (const cancel of [...live]) cancel();
}

/** From a tap: lets the page make sound from now on (iOS wants a sound started inside the tap). */
export function unlockSound() {
  const a = audio();
  if (!a) return;
  if (a.state !== "running") void a.resume().catch(() => undefined);
  try {
    const gain = a.createGain();
    gain.gain.value = 0;
    gain.connect(a.destination);
    const osc = a.createOscillator();
    osc.connect(gain);
    osc.start();
    osc.stop(a.currentTime + 0.02);
  } catch {
    /* no sound on this device */
  }
}

/** Waits (briefly) for the audio to run; false when the page may not make sound yet (no tap). */
const isRunning = (a: AudioContext) => a.state === "running";
async function running(a: AudioContext): Promise<boolean> {
  if (isRunning(a)) return true;
  const resumed = a.resume().then(() => true, () => false);
  const late = new Promise<boolean>((resolve) => window.setTimeout(() => resolve(false), 600));
  return (await Promise.race([resumed, late])) && isRunning(a);
}

/**
 * Plays the beeps at their times (those already past are skipped) and vibrates
 * with the main ones. Returns what cancels the ones not played yet.
 */
export function scheduleBeeps(beeps: Beep[]): () => void {
  let cancelled = false;
  const gains: GainNode[] = [];
  const timers: number[] = [];
  const cancel = () => {
    cancelled = true;
    for (const g of gains) {
      try {
        g.disconnect();
      } catch {
        /* already gone */
      }
    }
    for (const t of timers) window.clearTimeout(t);
    live.delete(cancel);
  };
  if (typeof window === "undefined" || !soundEnabled() || !beeps.length) return cancel;
  live.add(cancel);

  // Vibration does not depend on the audio being allowed.
  if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
    for (const b of beeps) {
      const pattern = VIBRATIONS[b.tone];
      const delay = b.at - Date.now();
      if (pattern !== undefined && delay > -50) timers.push(window.setTimeout(() => navigator.vibrate(pattern), Math.max(0, delay)));
    }
  }

  const last = Math.max(...beeps.map((b) => b.at));
  timers.push(window.setTimeout(() => live.delete(cancel), Math.max(0, last - Date.now()) + 3000));

  const a = audio();
  if (!a) return cancel;
  void running(a).then((ok) => {
    if (!ok || cancelled) return;
    // Audio time and wall time are matched once the audio runs.
    const offset = a.currentTime - Date.now() / 1000;
    for (const b of beeps) {
      const start = b.at / 1000 + offset;
      if (start < a.currentTime - 0.05) continue;
      for (const n of TONES[b.tone]) {
        const t0 = Math.max(a.currentTime, start + n.offset);
        const gain = a.createGain();
        gain.gain.setValueAtTime(0, t0);
        gain.gain.linearRampToValueAtTime(VOLUME, t0 + 0.01);
        gain.gain.setValueAtTime(VOLUME, t0 + n.seconds - 0.03);
        gain.gain.linearRampToValueAtTime(0, t0 + n.seconds);
        gain.connect(a.destination);
        const osc = a.createOscillator();
        osc.type = "square";
        osc.frequency.value = n.hz;
        osc.connect(gain);
        osc.start(t0);
        osc.stop(t0 + n.seconds + 0.02);
        gains.push(gain);
      }
    }
  });
  return cancel;
}
