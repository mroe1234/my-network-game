// Live explanations for the survival game (FR-105, FR-141, C2). Fixed wording comes from
// data/scenario.json "messages"; numbers come from the current evaluation.
import { componentFails } from './rules.js';
import { describeValues, fill } from './sim.js';

export const mbps = (n) => `${Math.round(n).toLocaleString('en-US')} Mbps`;
export const pct = (n) => `${Number.isFinite(n) ? n : '∞'}%`;

const kindOf = (c) => (c.portIssues.length ? 'port' : c.tier === 'aggregation' ? 'aggregation' : 'capacity');

/** One line per spilling switch, worst first: { switchId, kind, text }. */
export function statusLines(game, comps) {
  return comps.filter(componentFails)
    .sort((a, b) => (b.portIssues.length - a.portIssues.length) || (b.gradedMbps * a.capacityMbps - a.gradedMbps * b.capacityMbps))
    .map((c) => ({ switchId: c.switchId, kind: kindOf(c), text: fill(game.scenario.messages[`status-${kindOf(c)}`], describeValues(game, c)) }));
}

/** "Fixed" lines for switches that were spilling before and are healthy now. */
export function fixedLines(game, comps, previouslyFailing) {
  return comps
    .filter((c) => previouslyFailing.has(c.switchId) && !componentFails(c))
    .map((c) => ({ switchId: c.switchId, text: fill(game.scenario.messages.fixed, describeValues(game, c)) }));
}

/** Why the game ended, from the result's cause. */
export function gameOverText(game) {
  const c = game.result?.cause;
  if (!c) return '';
  return fill(game.scenario.messages[`game-over-${kindOf(c)}`], describeValues(game, c));
}

export const clock = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
