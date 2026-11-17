// State tests (T014). Hint, solution and restart tests are added in T030.
import { test, assertEqual, assert } from './harness.js';
import { createSession, startRound, setPending, submit, next, roundProgress } from '../engine/state.js';
import { CATALOG, validDoc } from './fixtures.js';

const session = () => startRound(createSession({ catalog: CATALOG, levels: validDoc().levels }));
// Fixture r1: a1 = 21 × 400 = 8 400 down on 1 uplink (84 %); 2 uplinks → 42 % (correct).
const correct = (s) => setPending(s, 'a1', { classId: 'sw-1g', activeUplinks: 2 });
const wrong = (s) => setPending(s, 'agg', { classId: 'sw-25g', activeUplinks: 2 }); // not the bottleneck

test('state/invalid input does not count an attempt', () => {
  const { state, result } = submit(session());
  assertEqual(result.status, 'invalid-input');
  assertEqual(roundProgress(state).attempts, 0);
  assertEqual(roundProgress(state).completed, false);
});

test('state/incorrect counts an attempt and keeps the round open', () => {
  const { state, result } = submit(wrong(session()));
  assertEqual(result.status, 'incorrect');
  assertEqual(roundProgress(state).attempts, 1);
  assertEqual(roundProgress(state).completed, false);
  assertEqual(state.view, 'round');
  assertEqual(state.committedDesign.agg.activeUplinks, 2, 'committed = submitted');
});

test('state/retry after incorrect, then correct', () => {
  const first = submit(wrong(session())).state;
  const { state, result } = submit(correct(first));
  assertEqual(result.status, 'correct');
  assertEqual(roundProgress(state).attempts, 2);
  assert(roundProgress(state).completed, 'completed');
});

test('state/repeated Submit after success is a no-op', () => {
  const solved = submit(correct(session())).state;
  const again = submit(setPending(solved, 'a1', { classId: 'sw-1g', activeUplinks: 4 }));
  assertEqual(again.result, null);
  assertEqual(roundProgress(again.state).attempts, 1);
  assertEqual(again.state, solved, 'state unchanged');
});

test('state/Next only after success', () => {
  const s = session();
  assertEqual(next(s), s);
});

test('state/Next advances from round 1 to round 2 with a fresh design', () => {
  const solved = submit(correct(session())).state;
  const n = next(solved);
  assertEqual(n.roundIndex, 1);
  assertEqual(n.view, 'round');
  assertEqual(Object.keys(n.committedDesign).length, 0);
  assertEqual(roundProgress(n).attempts, 0);
});

test('state/Next after the last round goes to the level summary', () => {
  let s = submit(correct(session())).state;
  s = next(s);
  // r2: 41 × 400 = 16 400 on 2 uplinks (82 %); 3 uplinks → 54.7 %.
  s = submit(setPending(s, 'a1', { classId: 'sw-1g', activeUplinks: 3 })).state;
  s = next(s);
  assertEqual(s.view, 'level-summary');
  assertEqual(next(s).view, 'session-summary');
});

// ---- US3 (T030): hints, solution, summaries, restart ------------------------------------------
import { viewHint, viewSolution, requestRestart, cancelRestart, confirmRestart, levelSummary, sessionSummary } from '../engine/state.js';

test('state/hints: 1 then 2, capped, no attempt', () => {
  let s = viewHint(session());
  assertEqual(roundProgress(s).hintsViewed, 1);
  s = viewHint(s);
  assertEqual(roundProgress(s).hintsViewed, 2);
  s = viewHint(s);
  assertEqual(roundProgress(s).hintsViewed, 2, 'capped at 2');
  assertEqual(roundProgress(s).attempts, 0);
});

test('state/solution: recorded as assistance; solving later = completed with assistance', () => {
  let s = viewSolution(session());
  assertEqual(roundProgress(s).solutionViewed, true);
  assertEqual(roundProgress(s).attempts, 0);
  s = submit(correct(s)).state;
  const row = levelSummary(s, 0).rows[0];
  assertEqual(row.completed, true);
  assertEqual(row.assisted, true);
  assertEqual(row.attempts, 1);
});

test('state/hints and solution are not recorded after the round is solved', () => {
  const solved = submit(correct(session())).state;
  assertEqual(viewHint(solved), solved);
  assertEqual(viewSolution(solved), solved);
});

test('state/summaries keep completed, attempts and assistance separate', () => {
  let s = submit(wrong(session())).state;           // r1: 1 wrong
  s = viewHint(s);                                   // r1: hint
  s = submit(correct(s)).state;                      // r1: solved, 2 attempts
  s = next(s);
  s = submit(setPending(s, 'a1', { classId: 'sw-1g', activeUplinks: 3 })).state; // r2: solved, 1 attempt
  const lvl = levelSummary(s, 0);
  assertEqual(lvl.completed, 2);
  assertEqual(lvl.attempts, 3);
  assertEqual(lvl.assistedRounds, 1);
  const ses = sessionSummary(s);
  assertEqual(ses.completed, 2);
  assertEqual(ses.totalRounds, 2);
  assertEqual(ses.attempts, 3);
  assertEqual(ses.assistedRounds, 1);
  assertEqual(ses.hintsViewed, 1);
  assertEqual(ses.solutionsViewed, 0);
});

test('state/restart cancel leaves state identical', () => {
  const s = submit(wrong(session())).state;
  const asked = requestRestart(s);
  assertEqual(asked.restartPending, true);
  const back = cancelRestart(asked);
  assertEqual(back.restartPending, false);
  assertEqual(roundProgress(back).attempts, 1);
  assertEqual(back.roundIndex, s.roundIndex);
});

test('state/restart confirm returns to level 1 briefing with progress cleared', () => {
  let s = submit(correct(session())).state;
  s = next(s);
  s = confirmRestart(requestRestart(s));
  assertEqual(s.view, 'briefing');
  assertEqual(s.levelIndex, 0);
  assertEqual(s.roundIndex, 0);
  assertEqual(Object.keys(s.perRound).length, 0);
  assertEqual(s.restartPending, false);
});
