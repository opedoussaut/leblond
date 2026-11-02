# Alter ego

Each climber can sign a pact with a fictional training partner. It follows the
climber's plan exactly, every scheduled day, and adds a little each week. It
trains when the climber does not, and it trains alongside them during a session.

It is a game. It is never a forecast of what the climber will achieve, and it is
private: there is no leaderboard and nobody else sees it.

## How it works

Nothing runs in the background. A pact stores the signed terms, and everything
the ego has done is worked out from those terms and the date, in
`lib/analytics/alter-ego.ts`.

| Rule | Value |
|---|---|
| Pact | One open at a time. Table `alter_ego_pacts`, private to its owner. |
| Plan | Copied at signing, so editing or deleting the plan changes nothing. |
| Progression | `PROGRESSION_V1`, stored in the pact: +2.5 % a week, capped at +50 %. |
| Lighter week | Every fourth week the gain is multiplied by 0.85, never under the plan. |
| Rest | Never shortened. |
| Never scaled | Warm-ups and cool-downs, max hangs, repeaters, campus, limit bouldering, intervals, free work. |
| Today | Today's session is not on the score until the day is over, because the ego trains alongside the climber. |

The progression is an editorial assumption, not a research result. Work is
timed at 3 s per rep and 45 s per route or problem, with 60 s between exercises.

## Live lane

During a session, the ego works through the same exercises scaled to that week,
using the player's own clock. It pauses with the player and makes no network
calls. It shows only while the pact is active.

## Score

- **You:** completed sessions from the start date, with their recorded reps and minutes.
- **Ego:** the scheduled sessions before today, scaled by week.

The screen shows the gap and stops there. It never tells the climber to add
load or cut rest to close it. If the last session reported pain of 3 or more,
the race framing goes away until a later session clears it.

The chosen pace runs in a straight line from the start grade to the goal.
Boulder and route stay separate and are never converted. It is labelled as a
pace the climber chose, not a prediction.

## Pause and end

A pause freezes the ego's clock. After resuming, its schedule is shifted by the
days paused. Abandoning loses the score but keeps the climber's own sessions.

## Patrick

Patrick receives the computed gap through `coachSummary` and never works it out
himself. He is told not to advise extra sessions, load or shorter rests to close
it, and to drop the race when `easeOff` is true.
