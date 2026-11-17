// Scenario validation — specs/002-survival-growth/contracts/scenario-data.md.
// The whole document is validated before the game starts (FR-144, C1, C6).

export const DEVICE_SHAPES = ['circle', 'triangle', 'hexagon', 'square', 'diamond'];
export const HINT_KEYS = ['method', 'capacity', 'port', 'aggregation'];
export const MESSAGE_KEYS = ['status-capacity', 'status-port', 'status-aggregation', 'fixed',
  'game-over-capacity', 'game-over-port', 'game-over-aggregation'];
const CLASS_IDS = ['sw-1g', 'sw-nbaset', 'sw-25g'];
const ROLES = ['access', 'aggregation'];
const CONCEPTS = ['port-speed', 'aggregation'];
const STEP = 0.25;

const isStr = (v) => typeof v === 'string' && v.trim().length > 0;
const isPosInt = (v) => Number.isInteger(v) && v > 0;
const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStepMultiple = (v) => typeof v === 'number' && v > 0 && Math.abs(v / STEP - Math.round(v / STEP)) < 1e-9;

function reporter() {
  const errors = [];
  return { errors, report: (path, message, eventId) => errors.push({ path, message, eventId: eventId ?? null }) };
}

function uniqueIds(list, path, report) {
  const seen = new Set();
  list.forEach((x, i) => {
    if (!isStr(x?.id)) report(`${path}[${i}].id`, 'id is required');
    else if (seen.has(x.id)) report(`${path}[${i}].id`, `duplicate id "${x.id}"`);
    else seen.add(x.id);
  });
}

function validateCatalog(doc, report) {
  if (doc.schemaVersion !== 2) report('schemaVersion', 'schemaVersion must be 2');
  // Source.id, Source.title, Source.url, Source.section, Source.claim
  if (!Array.isArray(doc.sources)) report('sources', 'sources must be an array');
  else {
    uniqueIds(doc.sources, 'sources', report);
    doc.sources.forEach((s, i) => {
      for (const f of ['title', 'url', 'section', 'claim']) if (!isStr(s?.[f])) report(`sources[${i}].${f}`, `${f} is required`);
      if (isStr(s?.url) && !s.url.startsWith('https://')) report(`sources[${i}].url`, 'url must use https');
    });
  }
  // SwitchClass.* plus price / uplinkPrice
  if (!Array.isArray(doc.switchClasses)) report('switchClasses', 'switchClasses must be an array');
  else {
    if (doc.switchClasses.length !== 3) report('switchClasses', 'there must be exactly 3 switch classes');
    uniqueIds(doc.switchClasses, 'switchClasses', report);
    doc.switchClasses.forEach((c, i) => {
      const p = `switchClasses[${i}]`;
      if (!CLASS_IDS.includes(c?.id)) report(`${p}.id`, `id must be one of ${CLASS_IDS.join(', ')}`);
      if (!isStr(c?.label)) report(`${p}.label`, 'label is required');
      for (const f of ['maxPortMbps', 'devicePorts', 'uplinkMbps', 'maxUplinks', 'price', 'uplinkPrice']) {
        if (!isPosInt(c?.[f])) report(`${p}.${f}`, `${f} must be a positive integer`);
      }
      if (!Array.isArray(c?.roles) || !c.roles.length || !c.roles.every((r) => ROLES.includes(r))) report(`${p}.roles`, 'roles must list access/aggregation');
      else if (c.roles.includes('aggregation') && c.id !== 'sw-25g') report(`${p}.roles`, 'only the 25G class may have the aggregation role');
    });
  }
  // DeviceType.id, portMbps, upMbps, downMbps, shape
  if (!Array.isArray(doc.deviceTypes)) report('deviceTypes', 'deviceTypes must be an array');
  else {
    uniqueIds(doc.deviceTypes, 'deviceTypes', report);
    doc.deviceTypes.forEach((d, i) => {
      const p = `deviceTypes[${i}]`;
      if (!isStr(d?.label)) report(`${p}.label`, 'label is required');
      if (!isPosInt(d?.portMbps)) report(`${p}.portMbps`, 'portMbps must be a positive integer');
      if (!DEVICE_SHAPES.includes(d?.shape)) report(`${p}.shape`, `shape must be one of ${DEVICE_SHAPES.join(', ')}`);
      for (const f of ['upMbps', 'downMbps']) {
        if (!isPosInt(d?.[f])) report(`${p}.${f}`, `${f} must be a positive integer`);
        else if (isPosInt(d?.portMbps) && d[f] > d.portMbps) report(`${p}.${f}`, `${f} must not exceed portMbps`);
      }
    });
  }
  // economy, rules
  if (!isObj(doc.economy) || !Number.isInteger(doc.economy.startCredits) || doc.economy.startCredits < 0 || !isPosInt(doc.economy.mbpsPerCredit)) {
    report('economy', 'economy needs startCredits (≥ 0) and mbpsPerCredit (> 0)');
  }
  const r = doc.rules;
  if (!isObj(r)) report('rules', 'rules are required');
  else {
    if (r.stepSeconds !== STEP) report('rules.stepSeconds', 'stepSeconds must be 0.25');
    if (!isPosInt(r.spillLimitSeconds)) report('rules.spillLimitSeconds', 'spillLimitSeconds must be a positive integer');
    if (!Number.isInteger(r.maxAccessSwitches) || r.maxAccessSwitches < 1 || r.maxAccessSwitches > 4) report('rules.maxAccessSwitches', 'maxAccessSwitches must be 1–4');
    if (!Number.isInteger(r.minDeviceTypesPerSwitch) || r.minDeviceTypesPerSwitch < 3) report('rules.minDeviceTypesPerSwitch', 'minDeviceTypesPerSwitch must be at least 3');
    // Split switches are extra diagram slots on top of maxAccessSwitches (6 at most in total).
    if (!Number.isInteger(r.maxSplits) || r.maxSplits < 0 || r.maxSplits > 2) report('rules.maxSplits', 'maxSplits must be 0–2');
  }
}

function makeRefs(doc) {
  const map = (list) => new Map((Array.isArray(list) ? list : []).filter(isObj).map((x) => [x.id, x]));
  return { classes: map(doc.switchClasses), devices: map(doc.deviceTypes), sources: map(doc.sources) };
}

function sourcesOk(ids, path, refs, report, eventId) {
  if (!Array.isArray(ids)) { report(path, 'sourceIds must be an array', eventId); return; }
  ids.forEach((id, i) => { if (!refs.sources.has(id)) report(`${path}[${i}]`, `unknown source "${id}"`, eventId); });
}

/** One switch: class, tier, uplinks, device groups, ports and device mix (FR-132). */
function validateSwitch(sw, path, tier, refs, report, minTypes, eventId, { needsId = true } = {}) {
  if (!isObj(sw)) { report(path, 'switch must be an object', eventId); return; }
  if (needsId && !isStr(sw.id)) report(`${path}.id`, 'switch id is required', eventId);
  const cls = refs.classes.get(sw.classId);
  if (!cls) { report(`${path}.classId`, `unknown switch class "${sw.classId}"`, eventId); return; }
  if (!cls.roles?.includes(tier)) report(`${path}.classId`, `class ${cls.id} cannot be used in the ${tier} tier`, eventId);
  if (!Number.isInteger(sw.activeUplinks) || sw.activeUplinks < 1 || sw.activeUplinks > cls.maxUplinks) {
    report(`${path}.activeUplinks`, `activeUplinks must be 1–${cls.maxUplinks}`, eventId);
  }
  if (tier !== 'access') return;
  if (!isStr(sw.label)) report(`${path}.label`, 'label is required', eventId);
  if (!Array.isArray(sw.deviceGroups) || !sw.deviceGroups.length) { report(`${path}.deviceGroups`, 'deviceGroups are required', eventId); return; }
  let total = 0;
  sw.deviceGroups.forEach((g, i) => {
    if (!refs.devices.has(g?.deviceTypeId)) report(`${path}.deviceGroups[${i}].deviceTypeId`, `unknown device type "${g?.deviceTypeId}"`, eventId);
    if (!isPosInt(g?.count)) report(`${path}.deviceGroups[${i}].count`, 'count must be a positive integer', eventId);
    else total += g.count;
  });
  if (total > cls.devicePorts) report(`${path}.deviceGroups`, `${total} devices exceed the ${cls.devicePorts} device ports`, eventId);
  const kinds = new Set(sw.deviceGroups.map((g) => g.deviceTypeId)).size;
  if (kinds < minTypes) report(`${path}.deviceGroups`, `needs at least ${minTypes} different device types (has ${kinds})`, eventId);
}

function validateGrowth(doc, refs, report) {
  const minTypes = Math.max(3, doc.rules?.minDeviceTypesPerSwitch ?? 3);
  const maxSwitches = doc.rules?.maxAccessSwitches ?? 4;

  const start = doc.start;
  if (!isObj(start) || !Array.isArray(start.accessSwitches) || !start.accessSwitches.length) { report('start', 'start topology is required'); return; }
  validateSwitch(start.aggregation, 'start.aggregation', 'aggregation', refs, report, minTypes);
  start.accessSwitches.forEach((sw, i) => validateSwitch(sw, `start.accessSwitches[${i}]`, 'access', refs, report, minTypes));
  uniqueIds(start.accessSwitches, 'start.accessSwitches', report);
  if (start.accessSwitches.length > maxSwitches) report('start.accessSwitches', `at most ${maxSwitches} access switches`);

  const b = doc.briefing;
  if (!isObj(b) || !isStr(b.concept) || !Array.isArray(b.terms) || !isStr(b.workedExample?.text) || !Array.isArray(b.simplifications)) {
    report('briefing', 'briefing needs concept, terms[], workedExample.text and simplifications[]');
  } else {
    sourcesOk(b.sourceIds, 'briefing.sourceIds', refs, report);
    if (!b.sourceIds?.length) report('briefing.sourceIds', 'at least one source is required');
  }

  // Timeline, replayed on a copy of the network.
  if (!Array.isArray(doc.timeline)) { report('timeline', 'timeline must be an array'); return; }
  uniqueIds(doc.timeline, 'timeline', report);
  const net = structuredClone(start);
  let lastAt = 0;
  doc.timeline.forEach((ev, i) => {
    const p = `timeline[${i}]`;
    const id = ev?.id;
    if (!isStr(ev?.title)) report(`${p}.title`, 'title is required', id);
    if (!isStepMultiple(ev?.at)) report(`${p}.at`, 'at must be a positive multiple of 0.25 s', id);
    else if (ev.at <= lastAt) report(`${p}.at`, 'event times must be strictly ascending', id);
    else lastAt = ev.at;
    if (ev?.concept !== undefined) {
      if (!CONCEPTS.includes(ev.concept)) report(`${p}.concept`, `concept must be one of ${CONCEPTS.join(', ')}`, id);
      if (!isStr(ev.notice)) report(`${p}.notice`, 'a concept event needs a notice', id);
    }
    if (ev?.sourceIds !== undefined) sourcesOk(ev.sourceIds, `${p}.sourceIds`, refs, report, id);
    for (const k of ['addSwitches', 'addDevices', 'demand']) {
      if (!Array.isArray(ev?.[k])) report(`${p}.${k}`, `${k} must be an array`, id);
    }
    (Array.isArray(ev?.demand) ? ev.demand : []).forEach((d, j) => {
      const t = refs.devices.get(d?.deviceTypeId);
      if (!t) { report(`${p}.demand[${j}].deviceTypeId`, `unknown device type "${d?.deviceTypeId}"`, id); return; }
      for (const f of ['upMbps', 'downMbps']) {
        if (!isPosInt(d[f])) report(`${p}.demand[${j}].${f}`, `${f} must be a positive integer`, id);
        else if (d[f] > t.portMbps) report(`${p}.demand[${j}].${f}`, `${f} must not exceed the ${t.portMbps} Mbps port`, id);
      }
    });
    (Array.isArray(ev?.addSwitches) ? ev.addSwitches : []).forEach((sw, j) => {
      validateSwitch(sw, `${p}.addSwitches[${j}]`, 'access', refs, report, minTypes, id);
      if (net.accessSwitches.some((x) => x.id === sw?.id) || sw?.id === net.aggregation?.id) report(`${p}.addSwitches[${j}].id`, `switch "${sw?.id}" already exists`, id);
      else if (isObj(sw)) net.accessSwitches.push(structuredClone(sw));
    });
    if (net.accessSwitches.length > maxSwitches) report(`${p}.addSwitches`, `more than ${maxSwitches} access switches`, id);
    (Array.isArray(ev?.addDevices) ? ev.addDevices : []).forEach((a, j) => {
      const sw = net.accessSwitches.find((x) => x.id === a?.switchId);
      if (!sw) { report(`${p}.addDevices[${j}].switchId`, `unknown access switch "${a?.switchId}" at this time`, id); return; }
      if (!refs.devices.has(a.deviceTypeId)) { report(`${p}.addDevices[${j}].deviceTypeId`, `unknown device type "${a.deviceTypeId}"`, id); return; }
      if (!isPosInt(a.count)) { report(`${p}.addDevices[${j}].count`, 'count must be a positive integer', id); return; }
      const g = sw.deviceGroups.find((x) => x.deviceTypeId === a.deviceTypeId);
      if (g) g.count += a.count; else sw.deviceGroups.push({ deviceTypeId: a.deviceTypeId, count: a.count });
    });
    // After the event: ports and device mix on every switch.
    net.accessSwitches.forEach((sw) => {
      const cls = refs.classes.get(sw.classId);
      const total = (sw.deviceGroups ?? []).reduce((n, g) => n + (g.count ?? 0), 0);
      if (cls && total > cls.devicePorts) report(p, `${sw.id} would have ${total} devices on ${cls.devicePorts} ports`, id);
      const kinds = new Set((sw.deviceGroups ?? []).map((g) => g.deviceTypeId)).size;
      if (kinds < minTypes) report(p, `${sw.id} would have only ${kinds} device types (needs ${minTypes})`, id);
    });
  });

  const w = doc.waves;
  if (!isObj(w)) { report('waves', 'waves are required'); return; }
  if (!isStepMultiple(w.startAt) || w.startAt <= lastAt) report('waves.startAt', 'startAt must be after the last timeline event');
  if (!isStepMultiple(w.every)) report('waves.every', 'every must be a positive multiple of 0.25 s');
  if (!isPosInt(w.growthPct)) report('waves.growthPct', 'growthPct must be a positive integer');
  if (!isPosInt(w.newSwitchEvery)) report('waves.newSwitchEvery', 'newSwitchEvery must be a positive integer');
  if (!Array.isArray(w.addPerSwitch)) report('waves.addPerSwitch', 'addPerSwitch must be an array');
  else w.addPerSwitch.forEach((a, j) => {
    if (!refs.devices.has(a?.deviceTypeId)) report(`waves.addPerSwitch[${j}].deviceTypeId`, `unknown device type "${a?.deviceTypeId}"`);
    if (!isPosInt(a?.count)) report(`waves.addPerSwitch[${j}].count`, 'count must be a positive integer');
  });
  validateSwitch(w.newSwitchTemplate, 'waves.newSwitchTemplate', 'access', refs, report, minTypes, null, { needsId: false });
}

function validateText(doc, report) {
  for (const [obj, keys, name, one] of [[doc.hints, HINT_KEYS, 'hints', 'hint'], [doc.messages, MESSAGE_KEYS, 'messages', 'message']]) {
    if (!isObj(obj)) { report(name, `${name} must be an object`); continue; }
    for (const k of keys) if (!isStr(obj[k])) report(`${name}.${k}`, `${one} "${k}" is required`);
  }
}

/** validateScenario(doc) → { ok: true, scenario } | { ok: false, errors: [{ path, message, eventId }] } */
export function validateScenario(doc) {
  const { errors, report } = reporter();
  if (!isObj(doc)) return { ok: false, errors: [{ path: '', message: 'scenario must be a JSON object', eventId: null }] };
  validateCatalog(doc, report);
  validateText(doc, report);
  if (errors.length) return { ok: false, errors };
  validateGrowth(doc, makeRefs(doc), report);
  return errors.length ? { ok: false, errors } : { ok: true, scenario: doc };
}
