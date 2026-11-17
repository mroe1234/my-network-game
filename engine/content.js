// Content validation — specs/001-capacity-flows-game/contracts/level-data.md.
// Validates the whole document before anything is shown (FR-023, C1, C6).
import { evaluate, computeComponents, componentFails } from './rules.js';

export const MESSAGE_KEYS = [
  'rule', 'fits', 'fits-overprovisioned', 'device-port-unsupported', 'upgraded-non-bottleneck',
  'uplinks-maxed-need-class', 'undersized-class', 'over-capacity',
  'no-change', 'unknown-switch', 'class-not-allowed', 'uplinks-out-of-range', 'upgrade-not-allowed',
];

const CLASS_IDS = ['sw-1g', 'sw-nbaset', 'sw-25g'];
const ROLES = ['access', 'aggregation'];
const UPGRADES = ['uplinks', 'replace'];
const OUTCOMES = ['LO1', 'LO2'];
const MAX_ACCESS_SWITCHES = 3;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isPosInt = (v) => Number.isInteger(v) && v > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

function makeReporter() {
  const errors = [];
  const report = (ctx, path, message) => errors.push({ levelId: ctx.levelId ?? null, roundId: ctx.roundId ?? null, path, message });
  return { errors, report };
}

function checkUnique(list, path, report, ctx = {}) {
  const seen = new Set();
  list.forEach((item, i) => {
    if (!isObj(item)) return;
    if (!isStr(item.id)) report(ctx, `${path}[${i}].id`, 'id is required');
    else if (seen.has(item.id)) report(ctx, `${path}[${i}].id`, `duplicate id "${item.id}"`);
    else seen.add(item.id);
  });
}

function validateCatalog(doc, report) {
  const ctx = {};
  if (doc.schemaVersion !== 1) report(ctx, 'schemaVersion', 'schemaVersion must be 1');

  // Source.id, Source.title, Source.url, Source.section, Source.claim (data-model.md)
  if (!Array.isArray(doc.sources)) report(ctx, 'sources', 'sources must be an array');
  else {
    checkUnique(doc.sources, 'sources', report);
    doc.sources.forEach((s, i) => {
      for (const f of ['title', 'url', 'section', 'claim']) {
        if (!isStr(s?.[f])) report(ctx, `sources[${i}].${f}`, `${f} is required`);
      }
      if (isStr(s?.url) && !s.url.startsWith('https://')) report(ctx, `sources[${i}].url`, 'url must use https');
    });
  }

  // SwitchClass.* (data-model.md): exactly three generic classes (FR-002).
  if (!Array.isArray(doc.switchClasses)) report(ctx, 'switchClasses', 'switchClasses must be an array');
  else {
    if (doc.switchClasses.length !== 3) report(ctx, 'switchClasses', 'there must be exactly 3 switch classes');
    checkUnique(doc.switchClasses, 'switchClasses', report);
    doc.switchClasses.forEach((c, i) => {
      const p = `switchClasses[${i}]`;
      if (!CLASS_IDS.includes(c?.id)) report(ctx, `${p}.id`, `id must be one of ${CLASS_IDS.join(', ')}`);
      if (!isStr(c?.label)) report(ctx, `${p}.label`, 'label is required');
      for (const f of ['maxPortMbps', 'devicePorts', 'uplinkMbps', 'maxUplinks']) {
        if (!isPosInt(c?.[f])) report(ctx, `${p}.${f}`, `${f} must be a positive integer`);
      }
      if (!Array.isArray(c?.roles) || c.roles.length === 0 || !c.roles.every((r) => ROLES.includes(r))) {
        report(ctx, `${p}.roles`, 'roles must be a non-empty list of access/aggregation');
      } else if (c.roles.includes('aggregation') && c.id !== 'sw-25g') {
        report(ctx, `${p}.roles`, 'only the 25G class may have the aggregation role');
      }
    });
    for (const id of CLASS_IDS) {
      if (!doc.switchClasses.some((c) => c?.id === id)) report(ctx, 'switchClasses', `missing switch class ${id}`);
    }
  }

  // DeviceType.id (unique), DeviceType.portMbps, DeviceType.upMbps, DeviceType.downMbps (data-model.md)
  if (!Array.isArray(doc.deviceTypes)) report(ctx, 'deviceTypes', 'deviceTypes must be an array');
  else {
    checkUnique(doc.deviceTypes, 'deviceTypes', report);
    doc.deviceTypes.forEach((d, i) => {
      const p = `deviceTypes[${i}]`;
      if (!isStr(d?.label)) report(ctx, `${p}.label`, 'label is required');
      if (!isPosInt(d?.portMbps)) report(ctx, `${p}.portMbps`, 'portMbps must be a positive integer');
      for (const f of ['upMbps', 'downMbps']) {
        if (!isPosInt(d?.[f])) report(ctx, `${p}.${f}`, `${f} must be a positive integer`);
        else if (isPosInt(d?.portMbps) && d[f] > d.portMbps) report(ctx, `${p}.${f}`, `${f} must not exceed portMbps`);
      }
    });
  }
}

function validateSwitch(sw, path, tier, ctx, refs, report) {
  if (!isObj(sw)) { report(ctx, path, 'switch must be an object'); return; }
  if (!isStr(sw.id)) report(ctx, `${path}.id`, 'switch id is required');
  const cls = refs.classes.get(sw.classId);
  if (!cls) { report(ctx, `${path}.classId`, `unknown switch class "${sw.classId}"`); return; }
  if (!cls.roles?.includes(tier)) report(ctx, `${path}.classId`, `class ${cls.id} cannot be used in the ${tier} tier (role)`);
  if (!Number.isInteger(sw.activeUplinks) || sw.activeUplinks < 1 || sw.activeUplinks > cls.maxUplinks) {
    report(ctx, `${path}.activeUplinks`, `activeUplinks must be 1–${cls.maxUplinks} for ${cls.id}`);
  }
  if (tier === 'access') {
    if (!isStr(sw.label)) report(ctx, `${path}.label`, 'label is required');
    if (!Array.isArray(sw.deviceGroups) || sw.deviceGroups.length === 0) {
      report(ctx, `${path}.deviceGroups`, 'deviceGroups must be a non-empty array');
      return;
    }
    let total = 0;
    sw.deviceGroups.forEach((g, i) => {
      if (!refs.devices.has(g?.deviceTypeId)) report(ctx, `${path}.deviceGroups[${i}].deviceTypeId`, `unknown device type "${g?.deviceTypeId}"`);
      if (!isPosInt(g?.count)) report(ctx, `${path}.deviceGroups[${i}].count`, 'count must be a positive integer');
      else total += g.count;
    });
    if (total > cls.devicePorts) report(ctx, `${path}.deviceGroups`, `${total} devices exceed the ${cls.devicePorts} device ports of ${cls.id}`);
  }
}

/** Topology.aggregation, Topology.accessSwitches, DeviceGroup.count (data-model.md). Returns switch ids. */
function validateTopology(top, path, ctx, refs, report) {
  const ids = new Set();
  if (!isObj(top)) { report(ctx, path, 'start topology is required'); return ids; }
  validateSwitch(top.aggregation, `${path}.aggregation`, 'aggregation', ctx, refs, report);
  if (isStr(top.aggregation?.id)) ids.add(top.aggregation.id);
  if (!Array.isArray(top.accessSwitches) || top.accessSwitches.length === 0) {
    report(ctx, `${path}.accessSwitches`, 'at least one access switch is required');
    return ids;
  }
  if (top.accessSwitches.length > MAX_ACCESS_SWITCHES) {
    report(ctx, `${path}.accessSwitches`, `at most ${MAX_ACCESS_SWITCHES} access switches are allowed`);
  }
  top.accessSwitches.forEach((sw, i) => {
    validateSwitch(sw, `${path}.accessSwitches[${i}]`, 'access', ctx, refs, report);
    if (isStr(sw?.id)) {
      if (ids.has(sw.id)) report(ctx, `${path}.accessSwitches[${i}].id`, `duplicate switch id "${sw.id}"`);
      ids.add(sw.id);
    }
  });
  return ids;
}

function validateDesign(design, path, ctx, start, refs, report) {
  if (!isObj(design)) { report(ctx, path, 'design must be an object'); return; }
  const tiers = new Map();
  if (isObj(start)) {
    if (start.aggregation?.id) tiers.set(start.aggregation.id, 'aggregation');
    for (const sw of start.accessSwitches ?? []) tiers.set(sw?.id, 'access');
  }
  for (const [switchId, change] of Object.entries(design)) {
    const tier = tiers.get(switchId);
    if (!tier) { report(ctx, `${path}.${switchId}`, `unknown switch "${switchId}"`); continue; }
    const cls = refs.classes.get(change?.classId);
    if (!cls) { report(ctx, `${path}.${switchId}.classId`, `unknown switch class "${change?.classId}"`); continue; }
    if (!cls.roles?.includes(tier)) report(ctx, `${path}.${switchId}.classId`, `class ${cls.id} cannot be used in the ${tier} tier (role)`);
    if (!Number.isInteger(change.activeUplinks) || change.activeUplinks < 1 || change.activeUplinks > cls.maxUplinks) {
      report(ctx, `${path}.${switchId}.activeUplinks`, `activeUplinks must be 1–${cls.maxUplinks}`);
    }
  }
}

function validateRound(round, path, ctx, refs, report) {
  if (!isObj(round)) { report(ctx, path, 'round must be an object'); return; }
  if (!isStr(round.intro)) report(ctx, `${path}.intro`, 'intro is required');
  const ids = validateTopology(round.start, `${path}.start`, ctx, refs, report);

  // Round.addedSwitches / Round.addedDevices: must be part of this round's start.
  if (!Array.isArray(round.addedSwitches)) report(ctx, `${path}.addedSwitches`, 'addedSwitches must be an array');
  else round.addedSwitches.forEach((sw, i) => {
    if (!ids.has(sw?.id)) report(ctx, `${path}.addedSwitches[${i}].id`, `added switch "${sw?.id}" is not in the round start`);
  });
  if (!Array.isArray(round.addedDevices)) report(ctx, `${path}.addedDevices`, 'addedDevices must be an array');
  else round.addedDevices.forEach((g, i) => {
    const access = (round.start?.accessSwitches ?? []).map((s) => s?.id);
    if (!access.includes(g?.switchId)) report(ctx, `${path}.addedDevices[${i}].switchId`, `unknown access switch "${g?.switchId}"`);
    if (!refs.devices.has(g?.deviceTypeId)) report(ctx, `${path}.addedDevices[${i}].deviceTypeId`, `unknown device type "${g?.deviceTypeId}"`);
    if (!isPosInt(g?.count)) report(ctx, `${path}.addedDevices[${i}].count`, 'count must be a positive integer');
  });

  // Round.allowedUpgrades (data-model.md)
  if (!Array.isArray(round.allowedUpgrades) || round.allowedUpgrades.length === 0
    || !round.allowedUpgrades.every((u) => UPGRADES.includes(u))) {
    report(ctx, `${path}.allowedUpgrades`, 'allowedUpgrades must be a non-empty list of uplinks/replace');
  }
  if (!isObj(round.claims)) report(ctx, `${path}.claims`, 'claims must be an object');
  if (!Array.isArray(round.hints) || !round.hints.every(isStr)) report(ctx, `${path}.hints`, 'hints must be a list of text');
  validateDesign(round.reference, `${path}.reference`, ctx, round.start, refs, report);
}

function validateLevels(doc, refs, report, options) {
  if (!Array.isArray(doc.levels)) { report({}, 'levels', 'levels must be an array'); return; }
  // Full curriculum: 3 levels × 2 rounds (FR-015). Disabled only for small test fixtures.
  if (options.fullCurriculum && doc.levels.length !== 3) {
    report({}, 'levels', `the curriculum must have exactly 3 levels (found ${doc.levels.length})`);
  }
  checkUnique(doc.levels, 'levels', report);
  const roundIds = new Set();
  doc.levels.forEach((level, li) => {
    const lp = `levels[${li}]`;
    const lctx = { levelId: level?.id ?? `#${li}` };
    if (!isStr(level?.title)) report(lctx, `${lp}.title`, 'title is required');
    if (!OUTCOMES.includes(level?.outcome)) report(lctx, `${lp}.outcome`, 'outcome must be LO1 or LO2');
    if (!Array.isArray(level?.sourceIds) || level.sourceIds.length === 0) report(lctx, `${lp}.sourceIds`, 'at least one source is required');
    else level.sourceIds.forEach((id, i) => {
      if (!refs.sources.has(id)) report(lctx, `${lp}.sourceIds[${i}]`, `unknown source "${id}"`);
    });
    const b = level?.briefing;
    if (!isObj(b) || !isStr(b.concept) || !Array.isArray(b.terms) || !isObj(b.workedExample) || !isStr(b.workedExample.text)
      || !Array.isArray(b.simplifications)) {
      report(lctx, `${lp}.briefing`, 'briefing needs concept, terms[], workedExample.text and simplifications[]');
    }
    if (!Array.isArray(level?.rounds) || level.rounds.length !== 2) {
      report(lctx, `${lp}.rounds`, 'each level must have exactly 2 rounds');
    }
    (level?.rounds ?? []).forEach((round, ri) => {
      const rctx = { ...lctx, roundId: round?.id ?? `#${ri}` };
      const rp = `${lp}.rounds[${ri}]`;
      if (!isStr(round?.id)) report(rctx, `${rp}.id`, 'round id is required');
      else if (roundIds.has(round.id)) report(rctx, `${rp}.id`, `duplicate round id "${round.id}"`);
      else roundIds.add(round.id);
      validateRound(round, rp, rctx, refs, report);
    });
  });
}

// ---- groups 3–4: teaching and continuity (T016) ---------------------------------------------

/** Every design reachable with the round's allowed upgrades (research R9). */
function* allConfigs(catalog, round) {
  const allowed = round.allowedUpgrades;
  const switches = [
    { id: round.start.aggregation.id, tier: 'aggregation', classId: round.start.aggregation.classId, activeUplinks: round.start.aggregation.activeUplinks },
    ...round.start.accessSwitches.map((s) => ({ id: s.id, tier: 'access', classId: s.classId, activeUplinks: s.activeUplinks })),
  ];
  const options = switches.map((sw) => {
    const classes = allowed.includes('replace')
      ? catalog.switchClasses.filter((c) => c.roles.includes(sw.tier))
      : catalog.switchClasses.filter((c) => c.id === sw.classId);
    const opts = [];
    for (const c of classes) {
      const counts = allowed.includes('uplinks')
        ? Array.from({ length: c.maxUplinks }, (_, i) => i + 1)
        : [Math.min(sw.activeUplinks, c.maxUplinks)];
      for (const n of counts) opts.push({ classId: c.id, activeUplinks: n });
    }
    return opts;
  });
  const idx = switches.map(() => 0);
  while (true) {
    const config = {};
    switches.forEach((sw, i) => { config[sw.id] = { tier: sw.tier, ...options[i][idx[i]] }; });
    yield config;
    let k = 0;
    while (k < idx.length && ++idx[k] === options[k].length) { idx[k] = 0; k += 1; }
    if (k === idx.length) return;
  }
}

function searchRound(catalog, round) {
  let anyPass = false;
  let uplinkOnlyPass = false;
  const classOf = { [round.start.aggregation.id]: round.start.aggregation.classId };
  for (const s of round.start.accessSwitches) classOf[s.id] = s.classId;
  for (const config of allConfigs(catalog, round)) {
    const passes = !computeComponents(catalog, round.start, config).some(componentFails);
    if (!passes) continue;
    anyPass = true;
    if (Object.entries(config).every(([id, c]) => c.classId === classOf[id])) { uplinkOnlyPass = true; break; }
  }
  return { anyPass, uplinkOnlyPass };
}

/** Canonical form of a topology for continuity comparison. */
function normalize(top) {
  const access = top.accessSwitches.map((s) => {
    const groups = {};
    for (const g of s.deviceGroups) groups[g.deviceTypeId] = (groups[g.deviceTypeId] ?? 0) + g.count;
    return { id: s.id, label: s.label, classId: s.classId, activeUplinks: s.activeUplinks,
      groups: Object.keys(groups).sort().map((k) => [k, groups[k]]) };
  }).sort((a, b) => a.id.localeCompare(b.id));
  const a = top.aggregation;
  return JSON.stringify({ agg: [a.id, a.classId, a.activeUplinks], access });
}

/** previous start + previous reference + this round's addedSwitches + addedDevices (FR-014). */
function expectedStart(prev, round) {
  const top = structuredClone(prev.start);
  const ref = prev.reference ?? {};
  if (ref[top.aggregation.id]) Object.assign(top.aggregation, ref[top.aggregation.id]);
  for (const sw of top.accessSwitches) if (ref[sw.id]) Object.assign(sw, { classId: ref[sw.id].classId, activeUplinks: ref[sw.id].activeUplinks });
  for (const sw of round.addedSwitches) top.accessSwitches.push(structuredClone(sw));
  for (const g of round.addedDevices) {
    const sw = top.accessSwitches.find((s) => s.id === g.switchId);
    if (!sw) continue;
    sw.deviceGroups.push({ deviceTypeId: g.deviceTypeId, count: g.count });
  }
  return top;
}

/**
 * Teaching (contract group 3) and continuity (group 4) checks. Runs only on structurally valid content.
 * options.crossLevel: also require continuity between the last round of one level and the first of the next (T026).
 */
function validateTeaching(doc, catalog, report, options) {
  let prev = null;
  doc.levels.forEach((level, li) => {
    const lctx = { levelId: level.id };
    const starts = level.rounds.map((r) => normalize(r.start));
    if (level.briefing.workedExample.start && starts.includes(normalize(level.briefing.workedExample.start))) {
      report(lctx, `levels[${li}].briefing.workedExample`, 'worked example must differ from every round start');
    }
    level.rounds.forEach((round, ri) => {
      const ctx = { ...lctx, roundId: round.id };
      const p = `levels[${li}].rounds[${ri}]`;
      if (round.hints.length !== 2) report(ctx, `${p}.hints`, 'exactly 2 hints are required (method, then worked step)');
      if (li === 0 && round.allowedUpgrades.includes('replace')) {
        report(ctx, `${p}.allowedUpgrades`, 'Level 1 rounds may only allow "uplinks" (concept not yet introduced, C2)');
      }
      // Round.start must have at least one violation (research R7).
      if (!computeComponents(catalog, round.start, configOf(round.start)).some(componentFails)) {
        report(ctx, `${p}.start`, 'round start must have at least one component over 80% or a port problem');
      }
      // Round.reference must pass under the round's own allowed upgrades.
      const ref = evaluate(catalog, round, {}, round.reference);
      if (ref.status !== 'correct') {
        report(ctx, `${p}.reference`, `reference solution must pass (got ${ref.status}/${ref.reasonCode})`);
      }
      // Claims verified by exhaustive search (research R9).
      const found = searchRound(catalog, round);
      if (!found.anyPass) report(ctx, `${p}`, 'no passing design exists for this round');
      if (round.claims.uplinkOnly === true && !found.uplinkOnlyPass) {
        report(ctx, `${p}.claims.uplinkOnly`, 'claims uplinkOnly, but no uplinks-only design passes');
      }
      if (round.claims.requiresClassChange === true && found.uplinkOnlyPass) {
        report(ctx, `${p}.claims.requiresClassChange`, 'claims requiresClassChange, but an uplinks-only design passes');
      }
      // Continuity (FR-014).
      const sameLevel = ri > 0;
      if (prev && (sameLevel || options.crossLevel)) {
        if (normalize(expectedStart(prev, round)) !== normalize(round.start)) {
          report(ctx, `${p}.start`, 'start must equal the previous round\'s reference design plus addedSwitches and addedDevices');
        }
      } else if (li === 0 && ri === 0 && (round.addedSwitches.length || round.addedDevices.length)) {
        report(ctx, `${p}`, 'the first round must not list added switches or devices');
      }
      prev = round;
    });
  });
}

function configOf(start) {
  const config = { [start.aggregation.id]: { tier: 'aggregation', classId: start.aggregation.classId, activeUplinks: start.aggregation.activeUplinks } };
  for (const s of start.accessSwitches) config[s.id] = { tier: 'access', classId: s.classId, activeUplinks: s.activeUplinks };
  return config;
}

function validateMessages(doc, report) {
  if (!isObj(doc.messages)) { report({}, 'messages', 'messages must be an object'); return; }
  for (const key of MESSAGE_KEYS) {
    if (!isStr(doc.messages[key])) report({}, `messages.${key}`, `message "${key}" is required`);
  }
}

/**
 * validateContent(doc, options) → { ok: true, catalog, messages, levels } | { ok: false, errors: [{ levelId, roundId, path, message }] }
 * options.fullCurriculum (default true): exactly 3 levels × 2 rounds (FR-015).
 * options.crossLevel (default true): continuity across level boundaries (FR-014).
 */
export function validateContent(doc, options = {}) {
  const { errors, report } = makeReporter();
  if (!isObj(doc)) return { ok: false, errors: [{ levelId: null, roundId: null, path: '', message: 'content must be a JSON object' }] };

  validateCatalog(doc, report);
  validateMessages(doc, report);
  const refs = {
    classes: new Map((Array.isArray(doc.switchClasses) ? doc.switchClasses : []).filter(isObj).map((c) => [c.id, c])),
    devices: new Map((Array.isArray(doc.deviceTypes) ? doc.deviceTypes : []).filter(isObj).map((d) => [d.id, d])),
    sources: new Map((Array.isArray(doc.sources) ? doc.sources : []).filter(isObj).map((s) => [s.id, s])),
  };
  validateLevels(doc, refs, report, { fullCurriculum: options.fullCurriculum ?? true });
  if (errors.length > 0) return { ok: false, errors };

  const catalog = { switchClasses: doc.switchClasses, deviceTypes: doc.deviceTypes, sources: doc.sources };
  validateTeaching(doc, catalog, report, { crossLevel: options.crossLevel ?? true });
  if (errors.length > 0) return { ok: false, errors };
  return { ok: true, catalog, messages: doc.messages, levels: doc.levels };
}
