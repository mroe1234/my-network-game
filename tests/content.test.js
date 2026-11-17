// Content validator tests — contracts/level-data.md groups 1–2 (structural, model).
import { test, assert, assertEqual, loadJSON } from './harness.js';
import { validateContent } from '../engine/content.js';
import { validDoc } from './fixtures.js';

function expectError(mutate, { levelId, roundId, match } = {}) {
  const doc = validDoc();
  mutate(doc);
  const res = validateContent(doc, { fullCurriculum: false });
  assertEqual(res.ok, false, 'should be rejected');
  const hit = res.errors.find((e) =>
    (levelId === undefined || e.levelId === levelId) &&
    (roundId === undefined || e.roundId === roundId) &&
    (!match || match.test(`${e.path} ${e.message}`)));
  assert(hit, `expected error ${match ?? ''} for level=${levelId} round=${roundId}; got ${JSON.stringify(res.errors)}`);
}

test('content/valid fixture passes', () => {
  const res = validateContent(validDoc(), { fullCurriculum: false });
  assert(res.ok, JSON.stringify(res.errors));
  assertEqual(res.levels.length, 1);
});

// ---- group 1: structural --------------------------------------------------------------------
test('content/missing field (round intro)', () =>
  expectError((d) => { delete d.levels[0].rounds[0].intro; }, { levelId: 'lvl-1', roundId: 'r1', match: /intro/ }));
test('content/missing field (source title)', () =>
  expectError((d) => { delete d.sources[0].title; }, { match: /sources\[0\]\.title/ }));
test('content/source url must be https', () =>
  expectError((d) => { d.sources[0].url = 'http://example.com'; }, { match: /url/ }));
test('content/duplicate round id', () =>
  expectError((d) => { d.levels[0].rounds[1].id = 'r1'; }, { levelId: 'lvl-1', match: /duplicate/i }));
test('content/duplicate device type id', () =>
  expectError((d) => { d.deviceTypes[1].id = d.deviceTypes[0].id; }, { match: /duplicate/i }));
test('content/dangling source ref', () =>
  expectError((d) => { d.levels[0].sourceIds = ['nope']; }, { levelId: 'lvl-1', match: /source/i }));
test('content/dangling class ref', () =>
  expectError((d) => { d.levels[0].rounds[0].start.accessSwitches[0].classId = 'sw-x'; }, { levelId: 'lvl-1', roundId: 'r1', match: /class/i }));
test('content/dangling device ref', () =>
  expectError((d) => { d.levels[0].rounds[0].start.accessSwitches[0].deviceGroups[0].deviceTypeId = 'dt-x9'; }, { levelId: 'lvl-1', roundId: 'r1', match: /device/i }));
test('content/dangling switch ref (addedDevices)', () =>
  expectError((d) => { d.levels[0].rounds[1].addedDevices[0].switchId = 'zz'; }, { levelId: 'lvl-1', roundId: 'r2', match: /switch/i }));
test('content/dangling switch ref (reference)', () =>
  expectError((d) => { d.levels[0].rounds[0].reference = { zz: { classId: 'sw-1g', activeUplinks: 2 } }; }, { levelId: 'lvl-1', roundId: 'r1', match: /switch/i }));
test('content/wrong schemaVersion', () =>
  expectError((d) => { d.schemaVersion = 2; }, { match: /schemaVersion/ }));

// ---- group 2: model ------------------------------------------------------------------------
test('content/switch class count ≠ 3', () =>
  expectError((d) => { d.switchClasses.pop(); }, { match: /exactly 3/ }));
test('content/demand > port speed (down)', () =>
  expectError((d) => { d.deviceTypes[0].downMbps = d.deviceTypes[0].portMbps + 1; }, { match: /downMbps/ }));
test('content/demand > port speed (up)', () =>
  expectError((d) => { d.deviceTypes[0].upMbps = d.deviceTypes[0].portMbps + 1; }, { match: /upMbps/ }));
test('content/device count > devicePorts', () =>
  expectError((d) => { d.levels[0].rounds[0].start.accessSwitches[0].deviceGroups[0].count = 49; }, { levelId: 'lvl-1', roundId: 'r1', match: /ports/i }));
test('content/class-role mismatch (aggregation)', () =>
  expectError((d) => { d.levels[0].rounds[0].start.aggregation.classId = 'sw-1g'; }, { levelId: 'lvl-1', roundId: 'r1', match: /role|tier/i }));
test('content/class-role mismatch (aggregation role on non-25G class)', () =>
  expectError((d) => { d.switchClasses[0].roles = ['access', 'aggregation']; }, { match: /aggregation/ }));
test('content/uplinks out of range', () =>
  expectError((d) => { d.levels[0].rounds[0].start.accessSwitches[0].activeUplinks = 5; }, { levelId: 'lvl-1', roundId: 'r1', match: /uplinks/i }));
test('content/more than 3 access switches', () =>
  expectError((d) => {
    const sw = d.levels[0].rounds[0].start.accessSwitches[0];
    d.levels[0].rounds[0].start.accessSwitches = ['b1', 'b2', 'b3', 'b4'].map((id) => ({ ...structuredClone(sw), id }));
  }, { levelId: 'lvl-1', roundId: 'r1', match: /access switches/i }));
test('content/allowedUpgrades empty', () =>
  expectError((d) => { d.levels[0].rounds[0].allowedUpgrades = []; }, { levelId: 'lvl-1', roundId: 'r1', match: /allowedUpgrades/ }));

test('content/missing message', () =>
  expectError((d) => { delete d.messages['over-capacity']; }, { match: /messages\.over-capacity/ }));

// ---- group 3: teaching ----------------------------------------------------------------------
test('content/start without a violation', () =>
  expectError((d) => {
    // r1 with 2 uplinks: 8 400 / 20 000 = 42 % → nothing to fix.
    d.levels[0].rounds[0].start.accessSwitches[0].activeUplinks = 2;
  }, { levelId: 'lvl-1', roundId: 'r1', match: /at least one/ }));
test('content/reference that does not pass', () =>
  expectError((d) => {
    // r2 reference 2 uplinks = current start → no-change; 3 → pass. Use 2 → not correct.
    d.levels[0].rounds[1].reference = { a1: { classId: 'sw-1g', activeUplinks: 2 } };
  }, { levelId: 'lvl-1', roundId: 'r2', match: /reference/ }));
test('content/reference uses a disallowed upgrade', () =>
  expectError((d) => {
    d.levels[0].rounds[0].reference = { a1: { classId: 'sw-nbaset', activeUplinks: 1 } };
  }, { levelId: 'lvl-1', roundId: 'r1', match: /reference/ }));
test('content/Level 1 may not allow replace', () =>
  expectError((d) => { d.levels[0].rounds[0].allowedUpgrades = ['uplinks', 'replace']; }, { levelId: 'lvl-1', roundId: 'r1', match: /Level 1/ }));
test('content/claim uplinkOnly contradicted', () =>
  expectError((d) => {
    // 48 × dt-x = 43 200 down; sw-1g max 40 000 → no uplinks-only design passes.
    d.levels[0].rounds[0].start.accessSwitches[0].deviceGroups = [{ deviceTypeId: 'dt-x', count: 48 }];
    d.levels[0].rounds[0].allowedUpgrades = ['uplinks'];
  }, { levelId: 'lvl-1', roundId: 'r1', match: /no passing design|uplinkOnly/ }));
test('content/claim requiresClassChange contradicted', () =>
  expectError((d) => { d.levels[0].rounds[0].claims = { requiresClassChange: true }; }, { levelId: 'lvl-1', roundId: 'r1', match: /requiresClassChange/ }));
test('content/hints must be exactly 2', () =>
  expectError((d) => { d.levels[0].rounds[0].hints.push('third'); }, { levelId: 'lvl-1', roundId: 'r1', match: /exactly 2 hints/ }));
test('content/worked example equals a round start', () =>
  expectError((d) => { d.levels[0].briefing.workedExample.start = structuredClone(d.levels[0].rounds[0].start); }, { levelId: 'lvl-1', match: /worked example/ }));

// ---- group 4: continuity --------------------------------------------------------------------
test('content/continuity break (count)', () =>
  expectError((d) => { d.levels[0].rounds[1].start.accessSwitches[0].deviceGroups[0].count = 40; }, { levelId: 'lvl-1', roundId: 'r2', match: /previous round/ }));
test('content/continuity break (uplinks not from reference)', () =>
  expectError((d) => { d.levels[0].rounds[1].start.accessSwitches[0].activeUplinks = 1; }, { levelId: 'lvl-1', roundId: 'r2', match: /previous round/ }));
test('content/continuity with an added switch', () => {
  const d = validDoc();
  const extra = { id: 'a2', label: 'A2', classId: 'sw-1g', activeUplinks: 1, deviceGroups: [{ deviceTypeId: 'dt-a', count: 10 }] };
  d.levels[0].rounds[1].addedSwitches = [extra];
  d.levels[0].rounds[1].start.accessSwitches.push(structuredClone(extra));
  const res = validateContent(d, { fullCurriculum: false });
  assert(res.ok, JSON.stringify(res.errors));
});
test('content/first round lists added devices', () =>
  expectError((d) => { d.levels[0].rounds[0].addedDevices = [{ switchId: 'a1', deviceTypeId: 'dt-heavy', count: 1 }]; }, { levelId: 'lvl-1', roundId: 'r1', match: /first round/ }));

// ---- full curriculum (T023) ---------------------------------------------------------------
test('content/fixture fails the full-curriculum check (1 level)', () => {
  const res = validateContent(validDoc());
  assertEqual(res.ok, false);
  assert(res.errors.some((e) => /exactly 3 levels/.test(e.message)), JSON.stringify(res.errors));
});
test('content/shipped file has 3 levels × 2 rounds', async () => {
  const doc = await loadJSON('../data/levels.json');
  assertEqual(doc.levels.length, 3);
  assert(doc.levels.every((l) => l.rounds.length === 2), 'two rounds each');
});
test('content/continuity break across a level boundary is rejected', async () => {
  const doc = await loadJSON('../data/levels.json');
  // Level 2 round 1 should start with Studio on 3 uplinks (Level 1 round 2 reference).
  doc.levels[1].rounds[0].start.accessSwitches.find((s) => s.id === 'studio').activeUplinks = 2;
  const res = validateContent(doc);
  assertEqual(res.ok, false);
  assert(res.errors.some((e) => e.levelId === 'lvl-2-device-sizing' && e.roundId === 'l2-r1' && /previous round/.test(e.message)), JSON.stringify(res.errors));
});
test('content/requiresClassChange contradicted in a shipped-style round', async () => {
  const doc = await loadJSON('../data/levels.json');
  // Remove the Wi-Fi APs' port problem: make them 1G devices with low demand → uplinks alone suffice.
  doc.deviceTypes.find((t) => t.id === 'wifi7-ap').portMbps = 1000;
  doc.deviceTypes.find((t) => t.id === 'wifi7-ap').downMbps = 100;
  doc.deviceTypes.find((t) => t.id === 'wifi7-ap').upMbps = 100;
  const res = validateContent(doc);
  assertEqual(res.ok, false);
  assert(res.errors.some((e) => /requiresClassChange|at least one/.test(e.message)), JSON.stringify(res.errors));
});

// ---- shipped file ----------------------------------------------------------------------------
test('content/shipped data/levels.json validates in under 100 ms', async () => {
  const doc = await loadJSON('../data/levels.json');
  const t0 = performance.now();
  const res = validateContent(doc);
  const ms = performance.now() - t0;
  assert(res.ok, JSON.stringify(res.errors));
  assert(ms < 100, `validation took ${ms.toFixed(1)} ms`);
});
