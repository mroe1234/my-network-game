// EvaluationResult → explanation (contracts/evaluator.md). Fixed wording comes from
// data/levels.json "messages"; numbers come from the result (C6, FR-012, FR-013).

export const mbps = (n) => `${Math.round(n).toLocaleString('en-US')} Mbps`;
export const pct = (n) => `${Number.isFinite(n) ? n : '∞'}%`;

function fill(template, values) {
  return template.replace(/\{(\w+)\}/g, (m, key) => (key in values ? String(values[key]) : m));
}

function names(round, catalog) {
  const sw = new Map([[round.start.aggregation.id, 'Aggregation switch'], ...round.start.accessSwitches.map((s) => [s.id, s.label])]);
  const cls = new Map(catalog.switchClasses.map((c) => [c.id, c.label]));
  const dev = new Map(catalog.deviceTypes.map((d) => [d.id, d.label]));
  return { sw: (id) => sw.get(id) ?? id, cls: (id) => cls.get(id) ?? id, dev: (id) => dev.get(id) ?? id };
}

const list = (items) => (items.length <= 1 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items.at(-1)}`);

function componentLine(c, n) {
  const status = c.ok && c.portIssues.length === 0 ? 'OK' : 'OVER LIMIT';
  return `${n.sw(c.switchId)}: ${c.activeUplinks} uplink${c.activeUplinks === 1 ? '' : 's'} = ${mbps(c.capacityMbps)}; `
    + `up ${mbps(c.upMbps)}, down ${mbps(c.downMbps)}; ${pct(c.utilizationPct)} (${c.gradedDirection}) — ${status}`;
}

/**
 * buildFeedback(result, { round, catalog, messages, sources }) →
 *   { kind: 'correct'|'incorrect'|'guidance', title, message, details: string[], rule, citation }
 */
export function buildFeedback(result, { round, catalog, messages, source }) {
  const n = names(round, catalog);
  if (result.status === 'invalid-input') {
    return {
      kind: 'guidance', title: 'Check your choice (no attempt counted)',
      message: fill(messages[result.reasonCode] ?? result.guidance ?? '', { max: result.maxUplinks ?? '' }),
      details: [], rule: null, citation: null,
    };
  }

  const comp = (id) => result.components.find((c) => c.switchId === id);
  const primary = comp(result.primarySwitchId ?? result.violations[0]);
  const values = {};
  if (primary) {
    Object.assign(values, {
      switch: n.sw(primary.switchId), util: pct(primary.utilizationPct), load: mbps(primary.gradedMbps),
      cap: mbps(primary.capacityMbps), direction: primary.gradedDirection === 'down' ? 'downstream' : 'upstream',
      class: n.cls(primary.classId), max: primary.activeUplinks,
    });
    const port = primary.portIssues[0];
    if (port) Object.assign(values, { device: n.dev(port.deviceTypeId), devicePort: mbps(port.portMbps), maxPort: mbps(port.maxPortMbps) });
  }
  if (result.suggestion) values.suggest = list(result.suggestion.classIds.map(n.cls)) || 'a larger class';
  const notes = result.efficiencyNotes.map(n.sw);
  Object.assign(values, { switches: list(notes), wereWas: notes.length === 1 ? 'was' : 'were', itThem: notes.length === 1 ? 'it' : 'them' });

  const changed = result.components.filter((c) => c.changed).map((c) =>
    `Changed ${n.sw(c.switchId)}: ${c.before.activeUplinks} → ${c.activeUplinks} uplinks`
    + (c.before.classId !== c.classId ? ` (${n.cls(c.before.classId)} → ${n.cls(c.classId)})` : '')
    + `; utilization ${pct(c.before.utilizationPct)} → ${pct(c.utilizationPct)}`
    + (c.wasViolating ? '' : ' (was already within the limit)'));

  const details = [...changed, ...result.components.map((c) => componentLine(c, n))];
  const correct = result.status === 'correct';
  return {
    kind: correct ? 'correct' : 'incorrect',
    title: correct ? 'Correct: all packets delivered' : 'Not yet: packets are still spilling',
    message: fill(messages[result.reasonCode] ?? '', values),
    details,
    rule: messages.rule,
    citation: source ? `${source.title} — ${source.section}` : null,
  };
}
