// Session state machine — data-model.md › SessionState and "State transitions".
// Pure functions: each returns a new state object; nothing here touches the DOM.
import { evaluate } from './rules.js';

/** Views: loading | content-error | briefing | round | level-summary | session-summary */
export function createSession(content) {
  return {
    view: 'briefing',
    catalog: content.catalog,
    levels: content.levels,
    levelIndex: 0,
    roundIndex: 0,
    committedDesign: {}, // what the screen and ambient flow show (research R8)
    pendingDesign: {},   // the player's unsubmitted selections
    perRound: {},        // roundId → { attempts, hintsViewed, solutionViewed, completed, lastResult }
    restartPending: false,
  };
}

export const currentLevel = (s) => s.levels[s.levelIndex];
export const currentRound = (s) => currentLevel(s)?.rounds[s.roundIndex];

export function roundProgress(s, roundId = currentRound(s)?.id) {
  return s.perRound[roundId] ?? { attempts: 0, hintsViewed: 0, solutionViewed: false, completed: false, lastResult: null };
}

function withProgress(s, roundId, patch) {
  return { ...s, perRound: { ...s.perRound, [roundId]: { ...roundProgress(s, roundId), ...patch } } };
}

export function startRound(s) {
  if (s.view !== 'briefing') return s;
  return { ...s, view: 'round', committedDesign: {}, pendingDesign: {} };
}

/** Record a pending choice for one switch (no grading, no attempt). */
export function setPending(s, switchId, change) {
  if (s.view !== 'round' || roundProgress(s).completed) return s;
  return { ...s, pendingDesign: { ...s.pendingDesign, [switchId]: { ...change } } };
}

export function clearPending(s) {
  return { ...s, pendingDesign: {} };
}

/**
 * Submit the pending design. Returns { state, result }.
 * - solved round → no-op, result null (FR-017)
 * - invalid input → guidance, attempts unchanged (FR-018)
 * - correct/incorrect → attempts + 1, committed = submitted design
 */
export function submit(s) {
  const round = currentRound(s);
  if (s.view !== 'round' || !round) return { state: s, result: null };
  const progress = roundProgress(s);
  if (progress.completed) return { state: s, result: null };

  // Only send entries that differ from what is already committed on screen.
  const result = evaluate(s.catalog, round, s.committedDesign, s.pendingDesign);
  if (result.status === 'invalid-input') {
    return { state: withProgress(s, round.id, { lastResult: result }), result };
  }
  const committedDesign = { ...s.committedDesign, ...s.pendingDesign };
  let next = { ...s, committedDesign, pendingDesign: {} };
  next = withProgress(next, round.id, {
    attempts: progress.attempts + 1,
    completed: result.status === 'correct',
    lastResult: result,
  });
  return { state: next, result };
}

/** Advance after a solved round: next round, level summary, or session summary. */
export function next(s) {
  if (s.view === 'round') {
    if (!roundProgress(s).completed) return s;
    const level = currentLevel(s);
    if (s.roundIndex + 1 < level.rounds.length) {
      return { ...s, roundIndex: s.roundIndex + 1, committedDesign: {}, pendingDesign: {} };
    }
    return { ...s, view: 'level-summary' };
  }
  if (s.view === 'level-summary') {
    if (s.levelIndex + 1 < s.levels.length) {
      return { ...s, view: 'briefing', levelIndex: s.levelIndex + 1, roundIndex: 0, committedDesign: {}, pendingDesign: {} };
    }
    return { ...s, view: 'session-summary' };
  }
  return s;
}

// ---- help and honest progress (T031) ---------------------------------------------------------

/** Reveal the next hint (method first, then worked step). Assistance only; never an attempt. */
export function viewHint(s) {
  const round = currentRound(s);
  const p = roundProgress(s);
  if (s.view !== 'round' || !round || p.completed) return s;
  // SessionState.perRound.hintsViewed is capped at 0–2 (data-model.md).
  const max = Math.min(2, round.hints.length);
  if (p.hintsViewed >= max) return s;
  return withProgress(s, round.id, { hintsViewed: p.hintsViewed + 1 });
}

/** Reveal the worked solution; the round can still be solved but counts as assisted. */
export function viewSolution(s) {
  const round = currentRound(s);
  const p = roundProgress(s);
  if (s.view !== 'round' || !round || p.completed) return s;
  return withProgress(s, round.id, { solutionViewed: true });
}

export const requestRestart = (s) => ({ ...s, restartPending: true });
export const cancelRestart = (s) => ({ ...s, restartPending: false });
export function confirmRestart(s) {
  if (!s.restartPending) return s;
  return createSession({ catalog: s.catalog, levels: s.levels });
}

/** Per-level figures: completed rounds, valid attempts and assistance kept separate (FR-021). */
export function levelSummary(s, levelIndex = s.levelIndex) {
  const level = s.levels[levelIndex];
  const rows = level.rounds.map((r, i) => {
    const p = roundProgress(s, r.id);
    return {
      roundId: r.id, label: `Round ${i + 1}`, completed: p.completed, attempts: p.attempts,
      hintsViewed: p.hintsViewed, solutionViewed: p.solutionViewed,
      assisted: p.hintsViewed > 0 || p.solutionViewed,
    };
  });
  return {
    level, rows,
    completed: rows.filter((r) => r.completed).length,
    attempts: rows.reduce((n, r) => n + r.attempts, 0),
    assistedRounds: rows.filter((r) => r.assisted).length,
  };
}

export function sessionSummary(s) {
  const levels = s.levels.map((_, i) => levelSummary(s, i));
  const rows = levels.flatMap((l) => l.rows);
  return {
    levels,
    completed: rows.filter((r) => r.completed).length,
    totalRounds: rows.length,
    attempts: rows.reduce((n, r) => n + r.attempts, 0),
    assistedRounds: rows.filter((r) => r.assisted).length,
    hintsViewed: rows.reduce((n, r) => n + r.hintsViewed, 0),
    solutionsViewed: rows.filter((r) => r.solutionViewed).length,
  };
}
