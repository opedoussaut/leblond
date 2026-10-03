/** Pure helper (client-safe): does a workout overlap a climbing session window? */
/** Sessions whose time window overlaps the workout (used to suggest a link). */
export function overlapsSession(
  w: { startedAt: Date; durationSeconds: number },
  session: { startedAt: Date; endedAt: Date | null },
  slackMinutes = 30,
): boolean {
  const ws = w.startedAt.getTime();
  const we = ws + w.durationSeconds * 1000;
  const ss = session.startedAt.getTime() - slackMinutes * 60_000;
  const se = (session.endedAt ?? new Date(session.startedAt.getTime() + 4 * 3_600_000)).getTime() + slackMinutes * 60_000;
  return ws < se && we > ss;
}
