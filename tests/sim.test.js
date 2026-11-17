// Hand-computed simulation cases (contracts/simulation.md). Arithmetic is in the comments;
// expected values are never produced by calling the code under test.
import { test, assert, assertEqual, assertDeep, loadJSON } from './harness.js';
import {
  createGame, start, pause, resume, step, priceOf, buy, evaluateNetwork, applyWave, applyEvent, replay, useHint,
} from '../engine/sim.js';

const scenario = async () => loadJSON('../data/scenario.json');
const run = (game, untilT) => { while (game.status === 'running' && game.t < untilT - 1e-9) step(game); return game; };
const comp = (game, id) => evaluateNetwork(game).find((c) => c.switchId === id);
const types = (game, id) => game.network.accessSwitches.find((s) => s.id === id).deviceGroups;

// Start: Studio ↓ 10×400 + 8×150 + 4×2 = 5 208, ↑ 10×300 + 8×50 + 4×25 = 3 500.
//        Office ↓ 20×150 + 4×400 + 6×2 = 4 612, ↑ 20×50 + 4×300 + 6×25 = 2 350.
test('sim/start state', async () => {
  const g = createGame(await scenario());
  assertEqual(g.status, 'briefing');
  assertEqual(g.t, 0);
  assertEqual(g.credits, 100);
  assertEqual(comp(g, 'studio').downMbps, 5208);
  assertEqual(comp(g, 'office').downMbps, 4612);
  assertEqual(comp(g, 'agg').downMbps, 9820);
});

test('sim/nothing moves before Start, or while paused', async () => {
  const g = createGame(await scenario());
  step(g);
  assertEqual(g.t, 0, 'briefing');
  start(g); step(g); pause(g); step(g); step(g);
  assertEqual(g.t, 0.25, 'paused after one step');
  assertEqual(g.credits, 100);
});

test('sim/income: floor(9 820 ÷ 2 000) = 4 per second while healthy', async () => {
  const g = run(start(createGame(await scenario())), 1);
  assertEqual(g.t, 1);
  assertEqual(g.credits, 104);
  run(g, 20);
  assertEqual(g.credits, 180); // 100 + 20 × 4
});

test('sim/at 20 s the Studio spills (8 408 / 10 000 = 84.08 %) and only the Office earns', async () => {
  const g = run(start(createGame(await scenario())), 20.25);
  assertEqual(comp(g, 'studio').downMbps, 8408);
  assertEqual(comp(g, 'studio').ok, false);
  assertEqual(g.spill, 0.25);
  run(g, 21);
  assertEqual(g.credits, 182); // 180 + floor(4 612 ÷ 2 000) = 2
});

test('sim/idle game ends at exactly 35.0 s (60 spilling steps from 20.0)', async () => {
  const g = run(start(createGame(await scenario())), 100);
  assertEqual(g.status, 'ended');
  assertEqual(g.t, 35);
  assertEqual(g.result.score, 35);
  assertEqual(g.result.cause.switchId, 'studio');
  assertEqual(g.credits, 210); // 180 + 15 s × 2
});

test('sim/fix at 24.0 s resets the countdown', async () => {
  const g = run(start(createGame(await scenario())), 24);
  assertEqual(g.spill, 4); // 16 spilling steps
  assertEqual(g.credits, 188); // 180 + 4 × 2
  const r = buy(g, 'studio', { classId: 'sw-1g', activeUplinks: 2 });
  assertEqual(r.ok, true);
  assertEqual(r.cost, 40);
  assertEqual(g.credits, 148);
  step(g);
  assertEqual(g.spill, 0); // 8 408 / 20 000 = 42 %
  assertEqual(comp(g, 'studio').utilizationPct, 42);
  run(g, 40);
  assertEqual(g.status, 'running', 'survives past 35 s');
});

test('sim/a fix on the step the countdown would reach 15 saves the game', async () => {
  const g = run(start(createGame(await scenario())), 34.75);
  assertEqual(g.spill, 14.75);
  buy(g, 'studio', { classId: 'sw-1g', activeUplinks: 2 });
  step(g);
  assertEqual(g.status, 'running');
  assertEqual(g.spill, 0);
});

test('sim/prices: uplinks, class replacement, no refund', async () => {
  const g = run(start(createGame(await scenario())), 1); // 104 credits
  assertEqual(priceOf(g, 'studio', { classId: 'sw-1g', activeUplinks: 3 }).cost, 80); // 2 × 40
  assertEqual(priceOf(g, 'studio', { classId: 'sw-nbaset', activeUplinks: 2 }).cost, 380); // 300 + 1 × 80
  assertEqual(priceOf(g, 'studio', { classId: 'sw-25g', activeUplinks: 2 }).cost, 1000); // 800 + 1 × 200
  assertEqual(priceOf(g, 'agg', { classId: 'sw-25g', activeUplinks: 2 }).cost, 200);
  buy(g, 'studio', { classId: 'sw-1g', activeUplinks: 2 });
  const down = priceOf(g, 'studio', { classId: 'sw-1g', activeUplinks: 1 });
  assertEqual(down.cost, 0);
  assertEqual(down.ok, true);
});

test('sim/shortfall: unaffordable purchases are refused and nothing changes', async () => {
  const g = run(start(createGame(await scenario())), 1); // 104 credits
  const p = priceOf(g, 'studio', { classId: 'sw-nbaset', activeUplinks: 1 });
  assertEqual(p.ok, false);
  assertEqual(p.shortfall, 196); // 300 − 104
  const r = buy(g, 'studio', { classId: 'sw-nbaset', activeUplinks: 1 });
  assertEqual(r.ok, false);
  assertEqual(g.credits, 104);
  assertEqual(comp(g, 'studio').classId, 'sw-1g');
});

test('sim/invalid purchases are refused', async () => {
  const g = run(start(createGame(await scenario())), 1);
  assertEqual(priceOf(g, 'agg', { classId: 'sw-1g', activeUplinks: 1 }).ok, false); // tier
  assertEqual(priceOf(g, 'studio', { classId: 'sw-1g', activeUplinks: 5 }).ok, false); // range
  assertEqual(priceOf(g, 'studio', { classId: 'sw-1g', activeUplinks: 1 }).ok, false); // no change
  assertEqual(priceOf(g, 'nope', { classId: 'sw-1g', activeUplinks: 2 }).ok, false);
});

test('sim/purchases work while paused and take effect on the next step', async () => {
  const g = run(start(createGame(await scenario())), 22);
  pause(g);
  assertEqual(buy(g, 'studio', { classId: 'sw-1g', activeUplinks: 2 }).ok, true);
  assertEqual(g.t, 22, 'clock still stopped');
  resume(g); step(g);
  assertEqual(g.spill, 0);
});

test('sim/first port-speed event pauses play at 60.0 s with a notice', async () => {
  const s = await scenario();
  const g = start(createGame(s));
  // Keep the earlier problems fixed so the game reaches 60 s: Studio 2 uplinks at 20 s, Office 2 at 45 s.
  run(g, 20.25); buy(g, 'studio', { classId: 'sw-1g', activeUplinks: 2 });
  run(g, 45.25); buy(g, 'office', { classId: 'sw-1g', activeUplinks: 2 });
  run(g, 61);
  assertEqual(g.status, 'paused');
  assertEqual(g.t, 60);
  assert(/device-port speed/.test(g.notice.text), g.notice?.text);
  assertEqual(comp(g, 'lobby').portIssues[0].deviceTypeId, 'wifi7-ap');
  resume(g);
  assertEqual(g.notice, null);
});

test('sim/every access switch keeps ≥ 3 device types (start, every event, 6 waves)', async () => {
  const s = await scenario();
  const g = createGame(s);
  const check = (when) => {
    for (const sw of g.network.accessSwitches) {
      assert(new Set(sw.deviceGroups.map((x) => x.deviceTypeId)).size >= 3, `${sw.id} after ${when}`);
    }
  };
  check('start');
  for (const ev of s.timeline) { applyEvent(g, ev); check(ev.id); }
  assertEqual(g.network.accessSwitches.length, 4);
  for (let w = 1; w <= 6; w += 1) { applyWave(g); check(`wave ${w}`); }
});

test('sim/wave arithmetic: +10 %, rounded, capped at port; +2 laptops +1 workstation +1 camera', async () => {
  const s = await scenario();
  const g = createGame(s);
  const before = Object.fromEntries(types(g, 'studio').map((x) => [x.deviceTypeId, x.count]));
  applyWave(g);
  const dt = (id) => g.deviceTypes.find((t) => t.id === id);
  assertDeep([dt('laptop').upMbps, dt('laptop').downMbps], [55, 165]); // 50→55, 150→165
  assertDeep([dt('workstation').upMbps, dt('workstation').downMbps], [330, 440]);
  assertDeep([dt('camera').upMbps, dt('camera').downMbps], [28, 2]); // 27.5→28 (Math.round), 2.2→2
  assertDeep([dt('wifi7-ap').upMbps, dt('wifi7-ap').downMbps], [1100, 2750]);
  assertDeep([dt('server').upMbps, dt('server').downMbps], [2750, 1650]);
  const after = Object.fromEntries(types(g, 'studio').map((x) => [x.deviceTypeId, x.count]));
  assertEqual(after.laptop, before.laptop + 2);
  assertEqual(after.workstation, before.workstation + 1);
  assertEqual(after.camera, before.camera + 1);
});

test('sim/wave demand is capped at port speed', async () => {
  const s = await scenario();
  s.deviceTypes.find((t) => t.id === 'laptop').downMbps = 950; // 950 × 1.1 = 1 045 > 1 000 port
  const g = createGame(s);
  applyWave(g);
  assertEqual(g.deviceTypes.find((t) => t.id === 'laptop').downMbps, 1000);
});

test('sim/wave additions are limited by free ports (46 of 48 → +2 laptops only)', async () => {
  const s = await scenario();
  s.start.accessSwitches[0].deviceGroups = [{ deviceTypeId: 'workstation', count: 30 }, { deviceTypeId: 'laptop', count: 12 }, { deviceTypeId: 'camera', count: 4 }];
  const g = createGame(s);
  applyWave(g);
  const c = Object.fromEntries(types(g, 'studio').map((x) => [x.deviceTypeId, x.count]));
  assertDeep([c.laptop, c.workstation, c.camera], [14, 30, 4]);
});

test('sim/hints are counted as assistance and do not change the score', async () => {
  const g = run(start(createGame(await scenario())), 21);
  const h = useHint(g);
  assert(/Method/.test(h.method), h.method);
  assert(/Studio switch/.test(h.detail), h.detail);
  assertEqual(g.hintsUsed, 1);
  run(g, 100);
  assertEqual(g.result.score, 35);
  assertEqual(g.result.hintsUsed, 1);
});

test('sim/determinism: the same action log replays to the same score', async () => {
  const s = await scenario();
  const actions = [
    { t: 22, type: 'buy', switchId: 'studio', change: { classId: 'sw-1g', activeUplinks: 2 } },
    { t: 47, type: 'buy', switchId: 'office', change: { classId: 'sw-1g', activeUplinks: 2 } },
    { t: 50, type: 'hint' },
  ];
  const a = replay(s, actions, 1000);
  const b = replay(s, actions, 1000);
  assertEqual(a.status, 'ended');
  assertEqual(a.result.score, b.result.score);
  assertEqual(a.credits, b.credits);
  // Lobby (port problem from 60 s) is never fixed: the game ends at 60 + 15 = 75 s.
  assertEqual(a.result.score, 75);
  assertEqual(a.result.cause.switchId, 'lobby');
});

test('sim/reference greedy player survives 3–8 minutes and no game is endless (SC-102)', async () => {
  const s = await scenario();
  const g = start(createGame(s));
  const since = {};
  while (g.status !== 'ended' && g.t < 3600) {
    if (g.status === 'paused') resume(g);
    for (const c of evaluateNetwork(g).filter((x) => !x.ok || x.portIssues.length)) {
      since[c.switchId] ??= g.t;
      if (g.t - since[c.switchId] < 4) continue;
      // Cheapest fix that makes this switch pass.
      const sw = c.tier === 'aggregation' ? null : g.network.accessSwitches.find((x) => x.id === c.switchId);
      const options = [];
      for (const cls of s.switchClasses.filter((k) => k.roles.includes(c.tier))) {
        if (sw && sw.deviceGroups.some((gr) => g.deviceTypes.find((t) => t.id === gr.deviceTypeId).portMbps > cls.maxPortMbps)) continue;
        for (let n = 1; n <= cls.maxUplinks; n += 1) {
          if (c.gradedMbps * 100 <= 80 * n * cls.uplinkMbps) {
            const p = priceOf(g, c.switchId, { classId: cls.id, activeUplinks: n });
            if (p.cost !== undefined && p.reason !== 'no-change') options.push({ ...p, classId: cls.id, n });
            break;
          }
        }
      }
      options.sort((x, y) => x.cost - y.cost);
      if (options[0]?.ok) buy(g, c.switchId, { classId: options[0].classId, activeUplinks: options[0].n });
    }
    for (const id of Object.keys(since)) if (comp(g, id)?.ok && !comp(g, id)?.portIssues.length) delete since[id];
    step(g);
  }
  assertEqual(g.status, 'ended', 'every game ends');
  assert(g.result.score >= 180 && g.result.score <= 480, `score ${g.result.score}`);
});

// ---- split a switch (FR-115) — hand-computed ----------------------------------------------------
import { splitPriceOf, splitSwitch } from '../engine/sim.js';

test('sim/split Studio at 0:01: 100 cr; halves 5/4/2 each; the 0:20 hires no longer spill', async () => {
  const g = run(start(createGame(await scenario())), 1); // 104 credits
  const p = splitPriceOf(g, 'studio');
  assertEqual(p.ok, true);
  assertEqual(p.cost, 100); // 1G class price
  const r = splitSwitch(g, 'studio');
  assertEqual(r.newSwitchId, 'studio-b');
  assertEqual(g.credits, 4);
  const count = (id) => Object.fromEntries(types(g, id).map((x) => [x.deviceTypeId, x.count]));
  assertDeep(count('studio'), { workstation: 5, laptop: 4, camera: 2 }); // ceil(10/2), ceil(8/2), ceil(4/2)
  assertDeep(count('studio-b'), { workstation: 5, laptop: 4, camera: 2 });
  assertEqual(g.network.accessSwitches.find((s) => s.id === 'studio-b').activeUplinks, 1);
  // Each half ↓ 5×400 + 4×150 + 2×2 = 2 604; aggregation total unchanged at 9 820.
  assertEqual(comp(g, 'studio-b').downMbps, 2604);
  assertEqual(comp(g, 'agg').downMbps, 9820);
  // 0:20 adds 8 workstations to the original Studio: ↓ 2 604 + 3 200 = 5 804 → 58 %: no spill.
  run(g, 21);
  assertEqual(comp(g, 'studio').downMbps, 5804);
  assertEqual(g.spill, 0);
  run(g, 44);
  assertEqual(g.status, 'running', 'survives past 0:35 without buying an uplink');
});

test('sim/split refused when a half would have fewer than 3 device types', async () => {
  const s = await scenario();
  s.start.accessSwitches[0].deviceGroups = [{ deviceTypeId: 'workstation', count: 10 }, { deviceTypeId: 'laptop', count: 8 }, { deviceTypeId: 'camera', count: 1 }];
  const g = createGame(s);
  const p = splitPriceOf(g, 'studio'); // camera: floor(1/2) = 0 → the new switch would have 2 types
  assertEqual(p.ok, false);
  assertEqual(p.reason, 'too-few-types');
  assertEqual(splitSwitch(g, 'studio').ok, false);
  assertEqual(g.network.accessSwitches.length, 2);
});

test('sim/split limits: aggregation cannot split; at most 2 splits; shortfall', async () => {
  const s = await scenario();
  s.economy.startCredits = 1000;
  const g = createGame(s);
  assertEqual(splitPriceOf(g, 'agg').reason, 'not-access-switch');
  assertEqual(splitSwitch(g, 'studio').ok, true);
  assertEqual(splitSwitch(g, 'office').ok, true); // 1000 − 100 − 100 = 800
  assertEqual(splitPriceOf(g, 'studio').reason, 'split-limit');
  const poor = createGame(await scenario());
  start(poor); buy(poor, 'studio', { classId: 'sw-1g', activeUplinks: 2 }); // 100 − 40 = 60
  const p = splitPriceOf(poor, 'office');
  assertEqual(p.reason, 'unaffordable');
  assertEqual(p.shortfall, 40);
});

test('sim/splits never block scripted growth (Lobby and East wing still arrive)', async () => {
  const s = await scenario();
  s.economy.startCredits = 1000;
  const g = createGame(s);
  splitSwitch(g, 'studio');
  splitSwitch(g, 'office');
  for (const ev of s.timeline) applyEvent(g, ev);
  const ids = g.network.accessSwitches.map((x) => x.id);
  assert(ids.includes('lobby') && ids.includes('east-wing'), ids.join(','));
  assertEqual(ids.length, 6);
  for (const sw of g.network.accessSwitches) assert(new Set(sw.deviceGroups.map((x) => x.deviceTypeId)).size >= 3, sw.id);
});

test('sim/replay with a split is deterministic', async () => {
  const s = await scenario();
  const actions = [{ t: 1, type: 'split', switchId: 'studio' }];
  const a = replay(s, actions, 400);
  const b = replay(s, actions, 400);
  assertEqual(a.result.score, b.result.score);
  // Office overloads at 0:45 (90.9 %) and is never fixed → ends at 0:45 + 15 s = 1:00.
  assertEqual(a.result.score, 60);
});
