// Pure domain evaluator — specs/001-capacity-flows-game/contracts/evaluator.md.
// No DOM, timers, randomness, network, or session state. All bandwidth is integer Mbps.

const THRESHOLD_PCT = 80;

/** True when load fits within 80 % of capacity, using exact integer arithmetic (research R3). */
export function fitsThreshold(loadMbps, capacityMbps) {
  return loadMbps * 100 <= THRESHOLD_PCT * capacityMbps;
}

/** Utilization for display only, one decimal place. */
export function utilizationPct(loadMbps, capacityMbps) {
  if (capacityMbps <= 0) return Infinity;
  return Math.round((loadMbps * 1000) / capacityMbps) / 10;
}

function indexById(list) {
  const map = new Map();
  for (const item of list ?? []) map.set(item.id, item);
  return map;
}

/** Switch configuration of a topology: { switchId: { tier, classId, activeUplinks } }. */
function baseConfig(start) {
  const config = { [start.aggregation.id]: { tier: 'aggregation', classId: start.aggregation.classId, activeUplinks: start.aggregation.activeUplinks } };
  for (const sw of start.accessSwitches) {
    config[sw.id] = { tier: 'access', classId: sw.classId, activeUplinks: sw.activeUplinks };
  }
  return config;
}

function applyDesign(config, design) {
  const next = {};
  for (const [id, entry] of Object.entries(config)) next[id] = { ...entry };
  for (const [id, change] of Object.entries(design ?? {})) {
    if (next[id]) next[id] = { ...next[id], classId: change.classId, activeUplinks: change.activeUplinks };
  }
  return next;
}

/** Full configuration for a round after applying a (partial) design over its start. */
export function configFor(round, design = {}) {
  return applyDesign(baseConfig(round.start), design);
}

/** Components for a round and a design, without input checks (for display and search). */
export function componentsFor(catalog, round, design = {}) {
  return computeComponents(catalog, round.start, configFor(round, design));
}

export const componentFails = (c) => !c.ok || c.portIssues.length > 0;

function sameConfig(a, b) {
  return Object.keys(a).every((id) => a[id].classId === b[id].classId && a[id].activeUplinks === b[id].activeUplinks);
}

/** Per-switch results for a full configuration (data-model.md › ComponentResult). */
export function computeComponents(catalog, start, config) {
  const classes = indexById(catalog.switchClasses);
  const devices = indexById(catalog.deviceTypes);
  const results = [];
  let aggUp = 0;
  let aggDown = 0;

  const build = (switchId, tier, upMbps, downMbps, portIssues) => {
    const { classId, activeUplinks } = config[switchId];
    const cls = classes.get(classId);
    const capacityMbps = activeUplinks * cls.uplinkMbps;
    const gradedDirection = downMbps > upMbps ? 'down' : 'up';
    const gradedMbps = Math.max(upMbps, downMbps);
    return {
      switchId, tier, classId, activeUplinks,
      upMbps, downMbps, capacityMbps, gradedDirection, gradedMbps,
      utilizationPct: utilizationPct(gradedMbps, capacityMbps),
      ok: fitsThreshold(gradedMbps, capacityMbps),
      portIssues,
      perUplinkMbps: { up: upMbps / activeUplinks, down: downMbps / activeUplinks },
    };
  };

  for (const sw of start.accessSwitches) {
    const cls = classes.get(config[sw.id].classId);
    let up = 0;
    let down = 0;
    const portIssues = [];
    for (const group of sw.deviceGroups) {
      const dt = devices.get(group.deviceTypeId);
      up += group.count * dt.upMbps;
      down += group.count * dt.downMbps;
      if (dt.portMbps > cls.maxPortMbps && !portIssues.some((p) => p.deviceTypeId === dt.id)) {
        portIssues.push({ deviceTypeId: dt.id, portMbps: dt.portMbps, maxPortMbps: cls.maxPortMbps });
      }
    }
    aggUp += up;
    aggDown += down;
    results.push(build(sw.id, 'access', up, down, portIssues));
  }
  results.unshift(build(start.aggregation.id, 'aggregation', aggUp, aggDown, []));
  return results;
}

const isViolating = (c) => !c.ok || c.portIssues.length > 0;

const GUIDANCE = {
  'no-change': 'Choose at least one change (more uplinks or a different switch class) before submitting.',
  'unknown-switch': 'That switch is not part of this network. Choose a switch shown in the topology.',
  'class-not-allowed': 'That switch class cannot be used in this tier. Access switches can be any class; aggregation uses the 25G class.',
  'uplinks-out-of-range': 'Each switch class supports a limited number of uplinks. To get more bandwidth than its maximum, choose a different switch class.',
  'upgrade-not-allowed': 'This round only lets you change the number of uplinks. Switch replacement comes later.',
};

function invalid(reasonCode, detail = {}) {
  return { status: 'invalid-input', reasonCode, components: [], violations: [], efficiencyNotes: [], guidance: GUIDANCE[reasonCode], ...detail };
}

/** Classes that would make a capacity-violating access switch fit at their maximum uplinks. */
function fittingClasses(catalog, component, start) {
  const devices = indexById(catalog.deviceTypes);
  const sw = start.accessSwitches.find((s) => s.id === component.switchId);
  const maxPort = Math.max(...sw.deviceGroups.map((g) => devices.get(g.deviceTypeId).portMbps));
  return catalog.switchClasses
    .filter((c) => c.roles.includes('access') && c.maxPortMbps >= maxPort
      && fitsThreshold(component.gradedMbps, c.maxUplinks * c.uplinkMbps))
    .map((c) => c.id);
}

/**
 * evaluate(catalog, round, committed, design) → EvaluationResult
 * committed: changes already on screen (round start = {}); design: the player's new changes.
 */
export function evaluate(catalog, round, committed, design) {
  const classes = indexById(catalog.switchClasses);
  const start = round.start;
  const startConfig = baseConfig(start);
  const committedConfig = applyDesign(startConfig, committed);
  const allowed = round.allowedUpgrades ?? ['uplinks', 'replace'];

  // 1 · Input checks (FR-018): no attempt is counted for any of these.
  if (design === null || typeof design !== 'object' || Array.isArray(design) || Object.keys(design).length === 0) {
    return invalid('no-change');
  }
  for (const [switchId, change] of Object.entries(design)) {
    const current = committedConfig[switchId];
    if (!current) return invalid('unknown-switch', { switchId });
    const cls = change && classes.get(change.classId);
    if (!cls || !cls.roles.includes(current.tier)) return invalid('class-not-allowed', { switchId });
    if (change.classId !== current.classId && !allowed.includes('replace')) return invalid('upgrade-not-allowed', { switchId });
    if (!Number.isInteger(change.activeUplinks) || change.activeUplinks < 1 || change.activeUplinks > cls.maxUplinks) {
      return invalid('uplinks-out-of-range', { switchId, maxUplinks: cls.maxUplinks });
    }
    if (change.activeUplinks !== current.activeUplinks && change.classId === current.classId && !allowed.includes('uplinks')) {
      return invalid('upgrade-not-allowed', { switchId });
    }
  }
  const evaluated = applyDesign(committedConfig, design);
  if (sameConfig(evaluated, committedConfig)) return invalid('no-change');

  // 2–4 · Loads, capacities, port checks.
  const before = computeComponents(catalog, start, startConfig);
  const components = computeComponents(catalog, start, evaluated).map((c) => {
    const b = before.find((x) => x.switchId === c.switchId);
    const s = startConfig[c.switchId];
    return {
      ...c,
      changed: s.classId !== c.classId || s.activeUplinks !== c.activeUplinks,
      wasViolating: isViolating(b),
      before: { classId: b.classId, activeUplinks: b.activeUplinks, utilizationPct: b.utilizationPct, capacityMbps: b.capacityMbps },
    };
  });

  const violating = components.filter(isViolating);
  const violations = violating
    .slice()
    .sort((a, b) => (b.gradedMbps * a.capacityMbps - a.gradedMbps * b.capacityMbps) || a.switchId.localeCompare(b.switchId))
    .map((c) => c.switchId);
  const efficiencyNotes = components.filter((c) => c.changed && !c.wasViolating).map((c) => c.switchId);

  // 5–7 · Status and primary reason.
  if (violating.length === 0) {
    return {
      status: 'correct', reasonCode: efficiencyNotes.length ? 'fits-overprovisioned' : 'fits',
      components, violations, efficiencyNotes, guidance: null,
    };
  }

  const result = { status: 'incorrect', components, violations, efficiencyNotes, guidance: null };
  const changed = components.filter((c) => c.changed);
  const capacityViolators = violating.filter((c) => !c.ok);
  const byId = (id) => components.find((c) => c.switchId === id);

  const portProblem = violating.find((c) => c.portIssues.length > 0);
  if (portProblem) return { ...result, reasonCode: 'device-port-unsupported', primarySwitchId: portProblem.switchId };

  if (changed.length > 0 && changed.every((c) => !c.wasViolating)) {
    return { ...result, reasonCode: 'upgraded-non-bottleneck', primarySwitchId: violations[0] };
  }

  const maxed = capacityViolators
    .filter((c) => c.tier === 'access' && c.activeUplinks === classes.get(c.classId).maxUplinks)
    .sort((a, b) => violations.indexOf(a.switchId) - violations.indexOf(b.switchId))[0];
  if (maxed) {
    return {
      ...result, reasonCode: 'uplinks-maxed-need-class', primarySwitchId: maxed.switchId,
      suggestion: { switchId: maxed.switchId, classIds: fittingClasses(catalog, maxed, start) },
    };
  }

  const undersized = capacityViolators.find((c) => c.classId !== startConfig[c.switchId].classId);
  if (undersized) return { ...result, reasonCode: 'undersized-class', primarySwitchId: undersized.switchId };

  return { ...result, reasonCode: 'over-capacity', primarySwitchId: byId(violations[0]).switchId };
}
