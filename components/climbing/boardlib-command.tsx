"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { useI18n } from "@/components/i18n-provider";
import { buttonClass } from "@/components/ui/button";
import { fieldClass } from "@/components/ui/field";
import { BOARDLIB_INSTALL, MOON_BROKEN, MOON_YEARS, boardLibCommands, type MoonYear } from "@/lib/climbing/boardlib-command";
import { BOARD_NAMES, BOARDS, type Board } from "@/lib/climbing/boards";
import { boardsDictionary } from "@/lib/i18n/boards";

/** One command with its copy button. */
function CommandLine({ command }: { command: string }) {
  const { locale } = useI18n();
  const b = boardsDictionary(locale);
  const [copied, setCopied] = useState(false);
  async function copy() {
    try { await navigator.clipboard.writeText(command); setCopied(true); setTimeout(() => setCopied(false), 2000); } catch { /* the command stays selectable */ }
  }
  return <div className="flex items-stretch gap-2">
    <code className="min-w-0 flex-1 overflow-x-auto whitespace-pre rounded-xl bg-surface-2 px-3 py-2.5 font-mono text-xs leading-relaxed" data-testid="boardlib-command">{command}</code>
    <button type="button" onClick={copy} className={buttonClass("secondary", "sm")} aria-label={`${copied ? b.cmdCopied : b.cmdCopy} : ${command}`}>
      {copied ? <Check aria-hidden="true" className="size-4" /> : <Copy aria-hidden="true" className="size-4" />}
      <span className="sr-only sm:not-sr-only">{copied ? b.cmdCopied : b.cmdCopy}</span>
    </button>
  </div>;
}

/** The BoardLib commands for the chosen board, ready to copy into a terminal. */
export function BoardLibCommand() {
  const { locale } = useI18n();
  const b = boardsDictionary(locale);
  const [board, setBoard] = useState<Board>("KILTER");
  const [year, setYear] = useState<MoonYear>("2024");
  const commands = boardLibCommands(board, board === "KILTER" ? b.cmdUserKilter : b.cmdUser, year);

  return <section aria-labelledby="boardlib-cmd-heading" className="leblond-premium-surface space-y-4 p-5 sm:p-6">
    <h2 id="boardlib-cmd-heading" className="text-base font-bold">{b.cmdTitle}</h2>
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="block text-sm font-semibold">{b.cmdBoard}
        <select className={fieldClass} value={board} onChange={(e) => setBoard(e.target.value as Board)} data-testid="boardlib-board">
          {BOARDS.map((x) => <option key={x} value={x}>{BOARD_NAMES[x]}</option>)}
        </select>
      </label>
      {board === "MOON" ? <label className="block text-sm font-semibold">{b.cmdMoonYear}
        <select className={fieldClass} value={year} onChange={(e) => setYear(e.target.value as MoonYear)}>
          {MOON_YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
      </label> : null}
    </div>
    <div className="space-y-2">
      <p className="text-sm font-semibold">{b.cmdInstall}</p>
      <CommandLine command={BOARDLIB_INSTALL} />
    </div>
    <div className="space-y-2">
      <p className="text-sm font-semibold">{b.cmdExport}</p>
      {commands.map((c) => <CommandLine key={c} command={c} />)}
      {commands.length > 1 ? <p className="text-xs text-ink-3">{b.cmdDatabase}</p> : null}
      {board === "KILTER" ? <p className="text-xs text-ink-3">{b.cmdKilterUser}</p> : null}
      {board === "MOON" && MOON_BROKEN.has(year) ? <p className="text-xs text-ink-2">{b.cmdMoonBroken}</p> : null}
    </div>
  </section>;
}
