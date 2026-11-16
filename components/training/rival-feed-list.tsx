"use client";

import { useState, useSyncExternalStore } from "react";

/** One line of the alter ego's feed, already worded on the server. */
export type FeedLine = { when: string; text: string; message: boolean };

const HIDDEN_KEY = "leblond.alterEgoFeed.hidden";
const CHANGED = "leblond:alter-ego-feed";

/** Whether the climber folded the feed away on this device (shown when storage is unavailable). */
function readHidden(): boolean {
  try { return window.localStorage.getItem(HIDDEN_KEY) === "1"; } catch { return false; }
}
function subscribe(onChange: () => void): () => void {
  window.addEventListener("storage", onChange);
  window.addEventListener(CHANGED, onChange);
  return () => { window.removeEventListener("storage", onChange); window.removeEventListener(CHANGED, onChange); };
}
/** How many of the newest lines show before "see all". */
export const FEED_PREVIEW = 5;

/**
 * The feed as a list the climber can fold away (remembered on this device)
 * and that shows only the newest lines until asked for more.
 */
export function RivalFeedList({ title, lines, empty, labels }: {
  title: string; lines: FeedLine[]; empty: string;
  labels: { hide: string; show: string; all: string; fewer: string };
}) {
  const hidden = useSyncExternalStore(subscribe, readHidden, () => false);
  const [all, setAll] = useState(false);
  const toggle = () => {
    try { window.localStorage.setItem(HIDDEN_KEY, hidden ? "0" : "1"); } catch { /* not remembered */ }
    window.dispatchEvent(new Event(CHANGED));
  };
  const shown = all ? lines : lines.slice(0, FEED_PREVIEW);

  return <div>
    <div className="flex items-center justify-between gap-3">
      <h3 className="text-sm font-bold">{title}</h3>
      {lines.length ? <button type="button" onClick={toggle} aria-expanded={!hidden} aria-controls="alter-ego-feed"
        className="min-h-11 rounded-full px-3 text-sm font-semibold text-accent hover:bg-accent-soft">
        {hidden ? labels.show : labels.hide}
      </button> : null}
    </div>
    {!lines.length ? <p className="mt-2 text-sm text-ink-3">{empty}</p> : hidden ? null : <>
      <ol id="alter-ego-feed" className="mt-2 space-y-2" data-testid="rival-feed">
        {shown.map((line, i) => <li key={i} className={"rounded-xl border px-3 py-2 text-sm " + (line.message ? "border-accent/30 bg-accent-soft" : "border-line bg-surface")}>
          <span className="block text-xs font-semibold text-ink-3">{line.when}</span>
          <span className={line.message ? "font-semibold" : ""}>{line.text}</span>
        </li>)}
      </ol>
      {lines.length > FEED_PREVIEW ? <button type="button" onClick={() => setAll((a) => !a)}
        className="mt-2 min-h-11 rounded-full px-3 text-sm font-semibold text-accent hover:bg-accent-soft">
        {all ? labels.fewer : labels.all.replace("{n}", String(lines.length))}
      </button> : null}
    </>}
  </div>;
}
