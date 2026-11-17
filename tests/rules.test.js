// Hand-computed evaluator cases (contracts/evaluator.md). Arithmetic is in tests/fixtures.js.
import { test, assertEqual, assertDeep, assert } from './harness.js';
import { evaluate } from '../engine/rules.js';
import { CATALOG, F1, F2, F3, F4, F5, F6, F6b, F7, round } from './fixtures.js';

const ev = (r, design, committed = {}) => evaluate(CATALOG, r, committed, design);
const comp = (result, id) => result.components.find((c) => c.switchId === id);

// ---- reason codes ------------------------------------------------------------------------
test('rules/fits', () => {
  // a1 2 uplinks: 8 200 / 20 000 = 41 % → all ok.
  const r = ev(F1, { a1: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(r.status, 'correct');
  assertEqual(r.reasonCode, 'fits');
  assertDeep(r.efficiencyNotes, []);
  assertEqual(comp(r, 'a1').utilizationPct, 41);
});

test('rules/fits-overprovisioned', () => {
  // a2 was at 20 % before; upgrading it is unnecessary.
  const r = ev(F1, { a1: { classId: 'sw-1g', activeUplinks: 2 }, a2: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(r.status, 'correct');
  assertEqual(r.reasonCode, 'fits-overprovisioned');
  assertDeep(r.efficiencyNotes, ['a2']);
});

test('rules/upgraded-non-bottleneck', () => {
  const r = ev(F1, { a2: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(r.status, 'incorrect');
  assertEqual(r.reasonCode, 'upgraded-non-bottleneck');
  assertDeep(r.violations, ['a1']);
  assertEqual(comp(r, 'a1').utilizationPct, 82);
});

test('rules/over-capacity (changed bottleneck still too small, not maxed)', () => {
  // F2 with 2 uplinks: 19 200 / 20 000 = 96 %.
  const r = ev(F2, { a1: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(r.status, 'incorrect');
  assertEqual(r.reasonCode, 'over-capacity');
  assertEqual(comp(r, 'a1').utilizationPct, 96);
});

test('rules/uplinks-maxed-need-class', () => {
  // F3 with 4 × 10G: 43 200 / 40 000 = 108 %.
  const r = ev(F3, { a1: { classId: 'sw-1g', activeUplinks: 4 } });
  assertEqual(r.status, 'incorrect');
  assertEqual(r.reasonCode, 'uplinks-maxed-need-class');
  assertEqual(comp(r, 'a1').utilizationPct, 108);
  assert(r.suggestion && r.suggestion.classIds.includes('sw-nbaset'), 'suggests nbase-t');
});

test('rules/undersized-class', () => {
  // nbase-t × 2 = 50 000 → 86.4 %.
  const r = ev(F3, { a1: { classId: 'sw-nbaset', activeUplinks: 2 } });
  assertEqual(r.status, 'incorrect');
  assertEqual(r.reasonCode, 'undersized-class');
  assertEqual(comp(r, 'a1').utilizationPct, 86.4);
});

test('rules/class change that fits', () => {
  const r = ev(F3, { a1: { classId: 'sw-nbaset', activeUplinks: 4 } });
  assertEqual(r.status, 'correct');
  assertEqual(comp(r, 'a1').utilizationPct, 43.2);
});

test('rules/device-port-unsupported', () => {
  // More uplinks don't fix a 5G device on a 1G-port switch.
  const r = ev(F4, { a1: { classId: 'sw-1g', activeUplinks: 3 } });
  assertEqual(r.status, 'incorrect');
  assertEqual(r.reasonCode, 'device-port-unsupported');
  assertDeep(comp(r, 'a1').portIssues, [{ deviceTypeId: 'dt-mg', portMbps: 5000, maxPortMbps: 1000 }]);
});

test('rules/device-port fixed by nbase-t', () => {
  // nbase-t ports 10 000 ≥ 5 000; 4 000 / 50 000 = 8 %.
  const r = ev(F4, { a1: { classId: 'sw-nbaset', activeUplinks: 2 } });
  assertEqual(r.status, 'correct');
  assertEqual(comp(r, 'a1').utilizationPct, 8);
});

test('rules/aggregation bottleneck', () => {
  const bad = ev(F7, { a1: { classId: 'sw-25g', activeUplinks: 2 } });
  assertEqual(bad.status, 'incorrect');
  assertEqual(bad.reasonCode, 'upgraded-non-bottleneck');
  assertDeep(bad.violations, ['agg']);
  const good = ev(F7, { agg: { classId: 'sw-25g', activeUplinks: 2 } });
  assertEqual(good.status, 'correct');
  assertEqual(comp(good, 'agg').utilizationPct, 43.2);
});

// ---- invalid input (no attempt counted) ----------------------------------------------------
const invalid = (r, design, code, committed) => {
  const res = ev(r, design, committed);
  assertEqual(res.status, 'invalid-input');
  assertEqual(res.reasonCode, code);
  assert(typeof res.guidance === 'string' && res.guidance.length > 0, 'guidance present');
};
test('rules/invalid no-change (empty)', () => invalid(F1, {}, 'no-change'));
test('rules/invalid no-change (same as committed)', () => invalid(F1, { a1: { classId: 'sw-1g', activeUplinks: 1 } }, 'no-change'));
test('rules/invalid no-change (null)', () => invalid(F1, null, 'no-change'));
test('rules/invalid unknown-switch', () => invalid(F1, { zz: { classId: 'sw-1g', activeUplinks: 2 } }, 'unknown-switch'));
test('rules/invalid class-not-allowed (role)', () => invalid(F1, { agg: { classId: 'sw-1g', activeUplinks: 1 } }, 'class-not-allowed'));
test('rules/invalid class-not-allowed (unknown class)', () => invalid(F1, { a1: { classId: 'sw-x', activeUplinks: 1 } }, 'class-not-allowed'));
test('rules/invalid uplinks-out-of-range (5)', () => invalid(F1, { a1: { classId: 'sw-1g', activeUplinks: 5 } }, 'uplinks-out-of-range'));
test('rules/invalid uplinks-out-of-range (0)', () => invalid(F1, { a1: { classId: 'sw-1g', activeUplinks: 0 } }, 'uplinks-out-of-range'));
test('rules/invalid upgrade-not-allowed', () => {
  const uplinksOnly = round(F1.start, ['uplinks']);
  invalid(uplinksOnly, { a1: { classId: 'sw-nbaset', activeUplinks: 1 } }, 'upgrade-not-allowed');
});
test('rules/invalid no-change relative to committed design', () => {
  // After a submission, committed holds a1 = 2 uplinks; submitting the same again is no change.
  invalid(F1, { a1: { classId: 'sw-1g', activeUplinks: 2 } }, 'no-change', { a1: { classId: 'sw-1g', activeUplinks: 2 } });
});

// ---- boundary and direction -----------------------------------------------------------------
test('rules/exactly 80% passes', () => {
  // F6: fix a2; a1 sits at exactly 8 000 / 10 000.
  const r = ev(F6, { a2: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(r.status, 'correct');
  assertEqual(comp(r, 'a1').ok, true);
  assertEqual(comp(r, 'a1').utilizationPct, 80);
});

test('rules/80% + 1 Mbps fails', () => {
  // F6b: a1 = 8 040 / 10 000 = 80.4 %.
  const r = ev(F6b, { a2: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(r.status, 'incorrect');
  assertEqual(comp(r, 'a1').ok, false);
  assertEqual(comp(r, 'a1').utilizationPct, 80.4);
  assertDeep(r.violations, ['a1']);
});

test('rules/downstream decides', () => {
  const r = ev(F1, { a2: { classId: 'sw-1g', activeUplinks: 2 } });
  const a1 = comp(r, 'a1');
  assertEqual(a1.upMbps, 4100);
  assertEqual(a1.downMbps, 8200);
  assertEqual(a1.gradedDirection, 'down');
});

test('rules/upstream decides', () => {
  // F5: up 8 200 (82 %), down 410. Adding an uplink → 41 %.
  const bad = ev(F5, { agg: { classId: 'sw-25g', activeUplinks: 2 } });
  assertEqual(comp(bad, 'a1').gradedDirection, 'up');
  assertEqual(comp(bad, 'a1').utilizationPct, 82);
  assertEqual(bad.status, 'incorrect');
  const good = ev(F5, { a1: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(good.status, 'correct');
});

test('rules/per-uplink load = switch load ÷ active uplinks', () => {
  // F2 with 3 uplinks: up 14 400 / 3 = 4 800; down 19 200 / 3 = 6 400; 64 % → pass.
  const r = ev(F2, { a1: { classId: 'sw-1g', activeUplinks: 3 } });
  assertDeep(comp(r, 'a1').perUplinkMbps, { up: 4800, down: 6400 });
  assertEqual(comp(r, 'a1').capacityMbps, 30000);
  assertEqual(r.status, 'correct');
});

test('rules/aggregation load sums access loads', () => {
  const r = ev(F1, { a1: { classId: 'sw-1g', activeUplinks: 2 } });
  const a = comp(r, 'agg');
  assertEqual(a.downMbps, 10200);
  assertEqual(a.upMbps, 5100);
  assertEqual(a.utilizationPct, 10.2);
});

test('rules/changed and wasViolating flags', () => {
  const r = ev(F1, { a2: { classId: 'sw-1g', activeUplinks: 2 } });
  assertEqual(comp(r, 'a1').changed, false);
  assertEqual(comp(r, 'a1').wasViolating, true);
  assertEqual(comp(r, 'a2').changed, true);
  assertEqual(comp(r, 'a2').wasViolating, false);
});
