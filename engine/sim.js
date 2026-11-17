// Fixed-step survival simulation — specs/002-survival-growth/contracts/simulation.md.
// Pure: no DOM, timers or randomness. Functions mutate and return the game they are given.
import { computeComponents, componentFails } from './rules.js';

const clone = (x) => structuredClone(x);
const EPS = 1e-9;

// ---- network helpers -------------------------------------------------------------------------

function configOf(network) {
  const config = { [network.aggregation.id]: { tier: 'aggregation', classId: network.aggregation.classId, activeUplinks: network.aggregation.activeUplinks } };
  for (const s of network.accessSwitches) config[s.id] = { tier: 'access', classId: s.classId, activeUplinks: s.activeUplinks };
  return config;
}

const catalogOf = (game) => ({ switchClasses: game.scenario.switchClasses, deviceTypes: game.deviceTypes });

/** ComponentResult[] for the current network (rules.js; 80 % busier direction + port check). */
export function evaluateNetwork(game) {
  return computeComponents(catalogOf(game), game.network, configOf(game.network));
}

function switchById(game, id) {
  if (game.network.aggregation.id === id) return { sw: game.network.aggregation, tier: 'aggregation' };
  const sw = game.network.accessSwitches.find((s) => s.id === id);
  return sw ? { sw, tier: 'access' } : null;
}

const usedPorts = (sw) => sw.deviceGroups.reduce((n, g) => n + g.count, 0);
/** Access switches from the scenario and growth waves; switches made by splitting don't count. */
const grownSwitches = (game) => game.network.accessSwitches.filter((s) => !s.splitFrom).length;

function addDevices(sw, deviceTypeId, count, ports) {
  const n = Math.max(0, Math.min(count, ports - usedPorts(sw)));
  if (n === 0) return 0;
  const g = sw.deviceGroups.find((x) => x.deviceTypeId === deviceTypeId);
  if (g) g.count += n; else sw.deviceGroups.push({ deviceTypeId, count: n });
  return n;
}

function noteArrival(game, switchId, deviceTypeId, count) {
  if (!count) return;
  game.recent.items[switchId] ??= {};
  game.recent.items[switchId][deviceTypeId] = (game.recent.items[switchId][deviceTypeId] ?? 0) + count;
}

function freshRecent(game) {
  game.recent = { items: {}, until: game.t + 10 };
}

// ---- lifecycle -----------------------------------------------------------------------------

export function createGame(scenario) {
  return {
    scenario,
    status: 'briefing',
    t: 0,
    network: clone(scenario.start),
    deviceTypes: clone(scenario.deviceTypes),
    credits: scenario.economy.startCredits,
    earned: 0,
    spent: 0,
    spill: 0,
    eventIndex: 0,
    waveCount: 0,
    nextWaveAt: scenario.waves.startAt,
    conceptsSeen: [],
    notice: null,
    recent: { items: {}, until: 0 },
    lastEvent: null,
    log: [],
    hintsUsed: 0,
    version: 0,     // any visible change (credits, hints, network)
    netVersion: 0,  // network or demand changes only (drives the diagram)
    result: null,
  };
}

export function start(game) {
  if (game.status === 'briefing') game.status = 'running';
  return game;
}
export function pause(game) {
  if (game.status === 'running') game.status = 'paused';
  return game;
}
export function resume(game) {
  if (game.status === 'paused') { game.status = 'running'; game.notice = null; }
  return game;
}

// ---- growth --------------------------------------------------------------------------------

/** Apply one timeline event (demand changes, new switches, new devices). */
export function applyEvent(game, ev) {
  for (const d of ev.demand ?? []) {
    const t = game.deviceTypes.find((x) => x.id === d.deviceTypeId);
    t.upMbps = d.upMbps;
    t.downMbps = d.downMbps;
  }
  const ports = (id) => game.scenario.switchClasses.find((c) => c.id === switchById(game, id).sw.classId).devicePorts;
  for (const sw of ev.addSwitches ?? []) {
    if (grownSwitches(game) >= game.scenario.rules.maxAccessSwitches) continue;
    const copy = clone(sw);
    game.network.accessSwitches.push(copy);
    for (const g of copy.deviceGroups) noteArrival(game, copy.id, g.deviceTypeId, g.count);
  }
  for (const a of ev.addDevices ?? []) {
    const found = switchById(game, a.switchId);
    if (!found || found.tier !== 'access') continue;
    noteArrival(game, a.switchId, a.deviceTypeId, addDevices(found.sw, a.deviceTypeId, a.count, ports(a.switchId)));
  }
  game.lastEvent = { t: game.t, id: ev.id, title: ev.title };
  game.log.push({ t: game.t, type: 'event', id: ev.id });
  game.version += 1;
  game.netVersion += 1;
  return game;
}

/** One endless growth wave (research S3). */
export function applyWave(game) {
  const w = game.scenario.waves;
  game.waveCount += 1;
  for (const t of game.deviceTypes) {
    t.upMbps = Math.min(t.portMbps, Math.round((t.upMbps * (100 + w.growthPct)) / 100));
    t.downMbps = Math.min(t.portMbps, Math.round((t.downMbps * (100 + w.growthPct)) / 100));
  }
  for (const sw of game.network.accessSwitches) {
    const ports = game.scenario.switchClasses.find((c) => c.id === sw.classId).devicePorts;
    for (const a of w.addPerSwitch) noteArrival(game, sw.id, a.deviceTypeId, addDevices(sw, a.deviceTypeId, a.count, ports));
  }
  if (game.waveCount % w.newSwitchEvery === 0 && grownSwitches(game) < game.scenario.rules.maxAccessSwitches) {
    const n = grownSwitches(game) + 1;
    const sw = { ...clone(w.newSwitchTemplate), id: `wave-switch-${n}`, label: w.newSwitchTemplate.label.replace('{n}', String(n)) };
    game.network.accessSwitches.push(sw);
    for (const g of sw.deviceGroups) noteArrival(game, sw.id, g.deviceTypeId, g.count);
  }
  game.lastEvent = { t: game.t, id: `wave-${game.waveCount}`, title: `Growth wave ${game.waveCount}: demand +${w.growthPct}% and more devices on every switch.` };
  game.log.push({ t: game.t, type: 'wave', n: game.waveCount });
  game.version += 1;
  game.netVersion += 1;
  return game;
}

/** Apply all growth due at the current time. Returns true if a concept notice paused play. */
function applyDueGrowth(game) {
  const tl = game.scenario.timeline;
  let paused = false;
  while (game.eventIndex < tl.length && tl[game.eventIndex].at <= game.t + EPS) {
    const ev = tl[game.eventIndex];
    game.eventIndex += 1;
    freshRecent(game);
    applyEvent(game, ev);
    if (ev.concept && !game.conceptsSeen.includes(ev.concept)) {
      game.conceptsSeen.push(ev.concept);
      game.notice = { concept: ev.concept, text: ev.notice, sourceIds: ev.sourceIds ?? [], title: ev.title };
      paused = true;
    }
  }
  while (game.eventIndex >= tl.length && game.t + EPS >= game.nextWaveAt) {
    freshRecent(game);
    applyWave(game);
    game.nextWaveAt += game.scenario.waves.every;
  }
  return paused;
}

// ---- step ----------------------------------------------------------------------------------

/**
 * One 0.25 s step covering [t, t + 0.25): growth → evaluate → countdown → advance → income →
 * end check (research S1). A concept notice pauses before any time passes.
 */
export function step(game) {
  if (game.status !== 'running') return game;
  const { stepSeconds, spillLimitSeconds } = game.scenario.rules;
  if (applyDueGrowth(game)) { game.status = 'paused'; return game; }

  const comps = evaluateNetwork(game);
  const failing = comps.filter(componentFails);
  game.spill = failing.length ? game.spill + stepSeconds : 0;
  game.t = Math.round((game.t + stepSeconds) * 100) / 100;
  if (game.recent.until <= game.t) game.recent = { items: {}, until: 0 };

  if (Math.abs(game.t - Math.round(game.t)) < EPS) {
    const aggFails = failing.some((c) => c.tier === 'aggregation');
    const delivered = aggFails ? 0 : game.network.accessSwitches
      .filter((sw) => !failing.some((c) => c.switchId === sw.id))
      .reduce((n, sw) => n + comps.find((c) => c.switchId === sw.id).downMbps, 0);
    const income = Math.floor(delivered / game.scenario.economy.mbpsPerCredit);
    if (income > 0) { game.credits += income; game.earned += income; game.version += 1; }
  }

  if (game.spill + EPS >= spillLimitSeconds) {
    game.status = 'ended';
    const worst = failing.slice().sort((a, b) =>
      (b.portIssues.length - a.portIssues.length) || (b.gradedMbps * a.capacityMbps - a.gradedMbps * b.capacityMbps))[0];
    game.result = {
      score: game.t, cause: worst, earned: game.earned, spent: game.spent,
      purchases: game.log.filter((x) => x.type === 'buy' || x.type === 'split').length, hintsUsed: game.hintsUsed,
      devices: game.network.accessSwitches.reduce((n, sw) => n + usedPorts(sw), 0),
      switches: game.network.accessSwitches.length,
    };
    game.version += 1;
  }
  return game;
}

// ---- purchases -----------------------------------------------------------------------------

/** Price and validity of changing one switch (contracts/simulation.md › Pricing). */
export function priceOf(game, switchId, change) {
  const found = switchById(game, switchId);
  if (!found) return { ok: false, reason: 'unknown-switch' };
  const cls = game.scenario.switchClasses.find((c) => c.id === change?.classId);
  if (!cls || !cls.roles.includes(found.tier)) return { ok: false, reason: 'class-not-allowed' };
  const n = change.activeUplinks;
  if (!Number.isInteger(n) || n < 1 || n > cls.maxUplinks) return { ok: false, reason: 'uplinks-out-of-range', maxUplinks: cls.maxUplinks };
  const cur = found.sw;
  let cost;
  if (cls.id === cur.classId) {
    if (n === cur.activeUplinks) return { ok: false, cost: 0, reason: 'no-change' };
    cost = Math.max(0, n - cur.activeUplinks) * cls.uplinkPrice;
  } else {
    cost = cls.price + (n - 1) * cls.uplinkPrice;
  }
  if (game.status === 'ended') return { ok: false, cost, reason: 'game-over' };
  if (cost > game.credits) return { ok: false, cost, reason: 'unaffordable', shortfall: cost - game.credits };
  return { ok: true, cost };
}

/** Buy a change instantly (paused or running); it takes effect from the next step. */
export function buy(game, switchId, change) {
  const p = priceOf(game, switchId, change);
  if (!p.ok) return p;
  const { sw } = switchById(game, switchId);
  const from = { classId: sw.classId, activeUplinks: sw.activeUplinks };
  sw.classId = change.classId;
  sw.activeUplinks = change.activeUplinks;
  game.credits -= p.cost;
  game.spent += p.cost;
  game.log.push({ t: game.t, type: 'buy', switchId, from, to: { ...change }, cost: p.cost });
  game.version += 1;
  game.netVersion += 1;
  return { ok: true, cost: p.cost };
}

// ---- split a switch (FR-115) ----------------------------------------------------------------

/**
 * Price and validity of splitting an access switch into two (research S7): a new switch of the
 * same class with 1 uplink; it takes floor(n / 2) of each device type, the original keeps the rest.
 */
export function splitPriceOf(game, switchId) {
  const found = switchById(game, switchId);
  if (!found || found.tier !== 'access') return { ok: false, reason: 'not-access-switch' };
  const cls = game.scenario.switchClasses.find((c) => c.id === found.sw.classId);
  const cost = cls.price;
  if (game.status === 'ended') return { ok: false, cost, reason: 'game-over' };
  const splits = game.network.accessSwitches.filter((s) => s.splitFrom).length;
  if (splits >= (game.scenario.rules.maxSplits ?? 0)) return { ok: false, cost, reason: 'split-limit', maxSplits: game.scenario.rules.maxSplits ?? 0 };
  const min = game.scenario.rules.minDeviceTypesPerSwitch;
  const moved = found.sw.deviceGroups.map((g) => ({ deviceTypeId: g.deviceTypeId, count: Math.floor(g.count / 2) })).filter((g) => g.count > 0);
  if (moved.length < min) return { ok: false, cost, reason: 'too-few-types', min };
  if (cost > game.credits) return { ok: false, cost, reason: 'unaffordable', shortfall: cost - game.credits };
  return { ok: true, cost, moved };
}

export function splitSwitch(game, switchId) {
  const p = splitPriceOf(game, switchId);
  if (!p.ok) return p;
  const { sw } = switchById(game, switchId);
  for (const g of sw.deviceGroups) g.count -= Math.floor(g.count / 2);
  let suffix = 'B';
  while (game.network.accessSwitches.some((s) => s.id === `${switchId}-${suffix.toLowerCase()}`)) suffix = String.fromCharCode(suffix.charCodeAt(0) + 1);
  const twin = {
    id: `${switchId}-${suffix.toLowerCase()}`, label: `${sw.label} ${suffix}`, classId: sw.classId, activeUplinks: 1,
    deviceGroups: p.moved, splitFrom: switchId,
  };
  const at = game.network.accessSwitches.indexOf(sw);
  game.network.accessSwitches.splice(at + 1, 0, twin);
  game.credits -= p.cost;
  game.spent += p.cost;
  game.log.push({ t: game.t, type: 'split', switchId, newSwitchId: twin.id, cost: p.cost });
  game.version += 1;
  game.netVersion += 1;
  return { ok: true, cost: p.cost, newSwitchId: twin.id };
}

// ---- help ----------------------------------------------------------------------------------

const fmt = (n) => `${Math.round(n).toLocaleString('en-US')} Mbps`;

/** Values for message/hint templates describing one component. */
export function describeValues(game, c) {
  const names = new Map([[game.network.aggregation.id, 'Aggregation'], ...game.network.accessSwitches.map((s) => [s.id, s.label])]);
  const cls = game.scenario.switchClasses.find((x) => x.id === c.classId);
  const port = c.portIssues[0];
  const dev = port && game.deviceTypes.find((t) => t.id === port.deviceTypeId);
  return {
    switch: names.get(c.switchId) ?? c.switchId,
    util: `${c.utilizationPct}%`, load: fmt(c.gradedMbps), cap: fmt(c.capacityMbps),
    direction: c.gradedDirection === 'down' ? 'downstream' : 'upstream',
    need: fmt(Math.ceil((c.gradedMbps * 100) / 80)), max: cls.maxUplinks, class: cls.label,
    device: dev?.label ?? '', devicePort: port ? fmt(port.portMbps) : '', maxPort: port ? fmt(port.maxPortMbps) : '',
  };
}

export const fill = (template, values) => template.replace(/\{(\w+)\}/g, (m, k) => (k in values ? String(values[k]) : m));

/** The worst current problem: port problems first, then highest utilization. */
export function worstProblem(game) {
  return evaluateNetwork(game).filter(componentFails).sort((a, b) =>
    (b.portIssues.length - a.portIssues.length) || (b.gradedMbps * a.capacityMbps - a.gradedMbps * b.capacityMbps))[0] ?? null;
}

/** Hint: method, then the worst switch and the kind of fix. Counted as assistance (FR-140). */
export function useHint(game) {
  game.hintsUsed += 1;
  game.log.push({ t: game.t, type: 'hint' });
  game.version += 1;
  const h = game.scenario.hints;
  const worst = worstProblem(game);
  if (!worst) return { method: h.method, detail: 'Nothing is spilling right now. Look at the arrival queues and the busiest uplinks to plan ahead.' };
  const kind = worst.portIssues.length ? 'port' : worst.tier === 'aggregation' ? 'aggregation' : 'capacity';
  return { method: h.method, detail: fill(h[kind], describeValues(game, worst)), switchId: worst.switchId };
}

// ---- replay (determinism, FR-134) -----------------------------------------------------------

/** Replay an action log from a fresh game. Concept-notice pauses auto-resume. */
export function replay(scenario, actions, until) {
  const game = start(createGame(scenario));
  const queue = actions.slice().sort((a, b) => a.t - b.t);
  while (game.status !== 'ended' && game.t < until - EPS) {
    if (game.status === 'paused') resume(game);
    while (queue.length && queue[0].t <= game.t + EPS) {
      const a = queue.shift();
      if (a.type === 'buy') buy(game, a.switchId, a.change);
      else if (a.type === 'split') splitSwitch(game, a.switchId);
      else if (a.type === 'hint') useHint(game);
    }
    step(game);
  }
  return game;
}
