// View rendering. Loading, content-error and briefing views (T012); the round view
// is added in T018.

const $ = (id) => document.getElementById(id);

function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'class') node.className = v;
    else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v);
  }
  for (const c of children.flat()) node.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return node;
}
export { el };

function showOnly(id) {
  $('view').hidden = id !== 'view';
  $('round').hidden = id !== 'round';
}

function focusHeading(id) {
  const h = $(id);
  if (h) { h.setAttribute('tabindex', '-1'); h.focus(); }
}

export function renderLoading() {
  showOnly('view');
  $('view').replaceChildren(el('h2', { id: 'view-heading' }, 'Loading…'), el('p', {}, 'Loading level content.'));
}

/** Content error: names the level/round; nothing is graded (FR-023, C1). */
export function renderContentError(errors, onRetry) {
  showOnly('view');
  const list = el('ul', {}, errors.slice(0, 20).map((e) =>
    el('li', {}, `${e.eventId ? `Event ${e.eventId}` : 'Scenario'}: ${e.path} — ${e.message}`)));
  $('view').replaceChildren(
    el('h2', { id: 'view-heading' }, 'This challenge is unavailable'),
    el('div', { class: 'feedback' }, el('div', { class: 'result content-error' },
      el('p', {}, 'The scenario failed validation, so the game cannot start.'),
      list,
      errors.length > 20 ? el('p', {}, `…and ${errors.length - 20} more.`) : '')),
    el('button', { type: 'button', onclick: onRetry }, 'Retry loading'),
  );
  focusHeading('view-heading');
}

/** Level briefing: concept, terms, worked example, simplifications, sources (FR-007, FR-008, FR-027, FR-028). */
export function renderBriefing(level, sources, onStart) {
  showOnly('view');
  const b = level.briefing;
  const cited = level.sourceIds.map((id) => sources.find((s) => s.id === id)).filter(Boolean);
  $('view').replaceChildren(
    el('h2', { id: 'view-heading' }, `Briefing · ${level.title}`),
    el('p', {}, b.concept),
    b.terms.length ? el('h3', {}, 'Terms') : '',
    b.terms.length ? el('ul', {}, b.terms.map((t) => el('li', {}, t))) : '',
    el('h3', {}, 'Worked example'),
    el('p', {}, b.workedExample.text),
    b.simplifications.length ? el('h3', {}, 'What this game simplifies') : '',
    b.simplifications.length ? el('ul', {}, b.simplifications.map((t) => el('li', {}, t))) : '',
    el('h3', {}, 'Sources'),
    el('ul', {}, cited.map((s) => el('li', {}, el('a', { href: s.url, target: '_blank', rel: 'noopener' }, s.title), ` — ${s.section}`))),
    el('button', { type: 'button', id: 'start-round', onclick: onStart }, 'Start'),
  );
  focusHeading('view-heading');
}

export function renderNotice(title, text) {
  showOnly('view');
  $('view').replaceChildren(el('h2', { id: 'view-heading' }, title), el('p', {}, text));
  focusHeading('view-heading');
}

// ---- round view (T018) ----------------------------------------------------------------------
import { componentsFor } from '../engine/rules.js';
import { shapeOf, allocateByLoad } from './shapes.js';
import { mbps, pct } from '../engine/feedback.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
function svg(tag, attrs = {}, text) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  if (text !== undefined) node.textContent = text;
  return node;
}

const CLASS_SHORT = { 'sw-1g': '1G', 'sw-nbaset': 'nbase-t', 'sw-25g': '25G' };
const shortClass = (cls) => `${CLASS_SHORT[cls.id] ?? cls.id} class · ${cls.maxUplinks}×${cls.uplinkMbps / 1000}G uplinks`;
const statusText = (c) => (c.portIssues.length ? 'PORT TOO SLOW' : c.ok ? 'OK' : 'OVER 80%');

/** Layout used by the SVG and by ui/flow.js. */
export function layout(round) {
  const n = round.start.accessSwitches.length;
  const width = Math.max(720, n * 360);
  const xs = round.start.accessSwitches.map((_, i) => Math.round(((i + 0.5) * width) / n));
  return {
    width, height: 500,
    core: { x: width / 2, y: 30 },
    agg: { x: width / 2, y: 130 },
    access: Object.fromEntries(round.start.accessSwitches.map((s, i) => [s.id, { x: xs[i], y: 250 }])),
    devices: Object.fromEntries(round.start.accessSwitches.map((s, i) => [s.id, { x: xs[i], y: 360 }])),
  };
}

/**
 * A diagram node. Selectable nodes are keyboard buttons (Tab, then Enter/Space) that select a
 * switch so the action card can act on it (change request 1).
 */
function node(g, { x, y }, title, subtitle, failing, opts = {}) {
  const group = svg('g', opts.selectId ? {
    class: `node-group selectable${opts.selected ? ' selected' : ''}`, role: 'button', tabindex: '0',
    'data-select': opts.selectId, 'aria-label': opts.ariaLabel ?? title, 'aria-pressed': opts.selected ? 'true' : 'false',
  } : { class: 'node-group' });
  // Selection is a separate outer ring so it never hides the red "over limit" border.
  if (opts.selected) group.append(svg('rect', { x: x - 116, y: y - 28, width: 232, height: 56, rx: 11, class: 'select-ring' }));
  group.append(svg('rect', { x: x - 110, y: y - 22, width: 220, height: 44, rx: 8, class: `node${failing ? ' node-bad' : ''}` }));
  group.append(svg('text', { x, y: y - 4, 'text-anchor': 'middle', class: 'node-title' }, title));
  if (subtitle) group.append(svg('text', { x, y: y + 13, 'text-anchor': 'middle', class: 'node-sub' }, subtitle));
  g.append(group);
}

/** Draw one uplink group as N parallel lines (one per active uplink); clicking it selects its switch. */
function uplinks(g, from, to, c, id, planned, selected) {
  const count = c.activeUplinks;
  const group = svg('g', { class: `uplink-group${selected ? ' selected' : ''}`, 'data-select': id });
  // A wide transparent stroke makes thin lines easy to click.
  group.append(svg('line', { x1: from.x, y1: from.y - 22, x2: to.x, y2: to.y + 22, class: 'hit' }));
  for (let i = 0; i < count; i += 1) {
    const off = (i - (count - 1) / 2) * 6;
    group.append(svg('line', { x1: from.x + off, y1: from.y - 22, x2: to.x + off, y2: to.y + 22,
      class: `link${c.ok && !c.portIssues.length ? '' : ' link-bad'}`, 'data-link': id }));
  }
  g.append(group);
  // Label near the lower switch, on the outer side, so neighbouring links never overlap.
  const lx = from.x + (to.x - from.x) * 0.35;
  const ly = (from.y - 22) + ((to.y + 22) - (from.y - 22)) * 0.35;
  // Left of the line for links leaning right, and for a vertical access link (keeps clear of its right neighbour).
  const side = to.x > from.x + 1 || (Math.abs(to.x - from.x) <= 1 && c.tier === 'access') ? 'end' : 'start';
  const x = side === 'end' ? lx - 10 : lx + 12;
  const attrs = (y, cls) => ({ x, y, 'text-anchor': side, class: cls });
  g.append(svg('text', attrs(ly - 8, 'link-label'), `${count} × ${mbps(c.capacityMbps / count)} · ${pct(c.utilizationPct)} ${statusText(c)}`));
  g.append(svg('text', attrs(ly + 8, 'link-label muted'), `↑ ${mbps(c.upMbps)}  ↓ ${mbps(c.downMbps)}`));
  if (planned) g.append(svg('text', attrs(ly + 24, 'link-label planned'), `planned: ${planned}`));
}

function plannedText(pending, id, catalog, committedComp) {
  const p = pending[id];
  if (!p) return '';
  const cls = catalog.switchClasses.find((c) => c.id === p.classId);
  const parts = [];
  if (p.activeUplinks !== committedComp.activeUplinks) parts.push(`${p.activeUplinks} uplinks`);
  if (p.classId !== committedComp.classId) parts.push(cls?.label ?? p.classId);
  return parts.join(', ');
}

/**
 * Round view: SVG topology + text table. Values always come from the committed design;
 * pending changes are shown as "planned" with no recomputed utilization (research R8).
 * selected: switchId | 'core' | null. onSelect(id) is called when a diagram item is chosen.
 */
export function renderRound({ level, round, roundIndex, catalog, committed, pending, progress, selected = null, onSelect = () => {} }) {
  showOnly('round');
  if (level) {
    $('round-heading').textContent = `${level.title} · Round ${roundIndex + 1} of ${level.rounds.length}`;
    $('round-intro').textContent = round.intro;
  }

  const comps = componentsFor(catalog, round, committed);
  const byId = new Map(comps.map((c) => [c.switchId, c]));
  const L = layout(round);
  // Natural size (no shrinking): the labeled container scrolls instead, so text stays readable.
  const root = svg('svg', { viewBox: `0 0 ${L.width} ${L.height}`, width: L.width, height: L.height, role: 'group', 'aria-labelledby': 'topo-title' });
  root.append(svg('title', { id: 'topo-title' }, 'Network topology. Select a switch, its uplinks or its devices to act on it; the same values are in the table below.'));
  const links = svg('g');
  const flowLayer = svg('g', { id: 'flow-layer', 'aria-hidden': 'true' });
  const nodes = svg('g');
  root.append(links, flowLayer, nodes); // packets run under the node boxes

  const aggC = byId.get(round.start.aggregation.id);
  uplinks(links, L.agg, L.core, aggC, aggC.switchId, plannedText(pending, aggC.switchId, catalog, aggC), selected === aggC.switchId);
  for (const s of round.start.accessSwitches) {
    const c = byId.get(s.id);
    uplinks(links, L.access[s.id], L.agg, c, s.id, plannedText(pending, s.id, catalog, c), selected === s.id);
    const dev = L.devices[s.id];
    const dl = svg('g', { class: `uplink-group${selected === s.id ? ' selected' : ''}`, 'data-select': s.id });
    dl.append(svg('line', { x1: dev.x, y1: dev.y - 22, x2: L.access[s.id].x, y2: L.access[s.id].y + 22, class: 'hit' }));
    dl.append(svg('line', { x1: dev.x, y1: dev.y - 22, x2: L.access[s.id].x, y2: L.access[s.id].y + 22, class: `link access-link${c.portIssues.length ? ' link-bad' : ''}` }));
    links.append(dl);
  }
  const say = (name, c) => `${name}: ${pct(c.utilizationPct)}, ${statusText(c)}. Select to act on it.`;
  node(nodes, L.core, 'Core', 'fixed · not graded', false, { selectId: 'core', selected: selected === 'core', ariaLabel: 'Core: fixed and not graded. Select for details.' });
  node(nodes, L.agg, 'Aggregation', shortClass(catalog.switchClasses.find((x) => x.id === aggC.classId)), !aggC.ok,
    { selectId: aggC.switchId, selected: selected === aggC.switchId, ariaLabel: say('Aggregation switch', aggC) });
  for (const s of round.start.accessSwitches) {
    const c = byId.get(s.id);
    const cls = catalog.switchClasses.find((x) => x.id === c.classId);
    node(nodes, L.access[s.id], s.label, `${shortClass(cls)} · ports ≤ ${cls.maxPortMbps / 1000}G`, !c.ok || c.portIssues.length > 0,
      { selectId: s.id, selected: selected === s.id, ariaLabel: say(s.label, c) });
    const groups = s.deviceGroups.map((d) => {
      const t = catalog.deviceTypes.find((x) => x.id === d.deviceTypeId);
      return `${d.count} × ${t.label}`;
    }).join(', ');
    node(nodes, L.devices[s.id], groups.length > 30 ? `${groups.slice(0, 29)}…` : groups, 'select for device details', c.portIssues.length > 0,
      { selectId: s.id, selected: selected === s.id, ariaLabel: `Devices on ${s.label}: ${groups}. Select to see their port speed and demand.` });
  }

  drawArrivalQueues(nodes, round, catalog, L);

  // Pointer and keyboard selection (event delegation; one listener per render).
  root.addEventListener('click', (e) => {
    const target = e.target.closest('[data-select]');
    if (target) onSelect(target.dataset.select);
  });
  root.addEventListener('keydown', (e) => {
    const target = e.target.closest('[role="button"][data-select]');
    if (target && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); onSelect(target.dataset.select); }
  });
  $('topology').replaceChildren(root);

  renderTopologyTable({ round, catalog, comps, pending });
  if (progress) renderProgress(progress);
  return { svg: root, layout: L, components: comps };
}

// ---- arrival queues (change request 3) -------------------------------------------------------

/** Devices of a type that joined this round on a switch (Round.addedDevices / Round.addedSwitches). */
export function newDeviceCount(round, switchId, deviceTypeId) {
  const viaDevices = round.addedDevices
    .filter((g) => g.switchId === switchId && g.deviceTypeId === deviceTypeId)
    .reduce((n, g) => n + g.count, 0);
  const viaSwitch = round.addedSwitches
    .filter((sw) => sw.id === switchId)
    .flatMap((sw) => sw.deviceGroups)
    .filter((g) => g.deviceTypeId === deviceTypeId)
    .reduce((n, g) => n + g.count, 0);
  return viaDevices + viaSwitch;
}

/** Demand waiting to enter at one access switch, split into existing and new-this-round devices. */
export function arrivalDemand(round, catalog, sw) {
  const out = { up: 0, down: 0, newUp: 0, newDown: 0, newGroups: [], parts: [] };
  for (const g of sw.deviceGroups) {
    const t = catalog.deviceTypes.find((d) => d.id === g.deviceTypeId);
    const added = Math.min(g.count, newDeviceCount(round, sw.id, g.deviceTypeId));
    out.up += g.count * t.upMbps;
    out.down += g.count * t.downMbps;
    out.newUp += added * t.upMbps;
    out.newDown += added * t.downMbps;
    if (added) out.newGroups.push({ count: added, label: t.label });
    out.parts.push({ typeId: t.id, existing: g.count - added, added, up: t.upMbps, down: t.downMbps });
  }
  return out;
}

const QUEUE_UNITS = [250, 500, 1000, 2500, 5000, 10000, 25000];
const QUEUE_MAX_ICONS = 20;

/**
 * Arrival queue under each device group: ▲ icons for the demand waiting to enter (busier
 * direction), outlined for devices that just arrived, with exact numbers as text. Illustrates
 * offered load only; queuing and buffering are not modelled (spec Technical Model).
 */
function drawArrivalQueues(layer, round, catalog, L) {
  const demands = round.start.accessSwitches.map((sw) => ({ sw, d: arrivalDemand(round, catalog, sw) }));
  const maxLoad = Math.max(...demands.map(({ d }) => Math.max(d.up, d.down)), 1);
  const unit = QUEUE_UNITS.find((u) => maxLoad / u <= QUEUE_MAX_ICONS) ?? QUEUE_UNITS.at(-1);
  const group = svg('g', { class: 'queues', 'aria-hidden': 'true' });
  for (const { sw, d } of demands) {
    const pos = L.devices[sw.id];
    const busierDown = d.down >= d.up;
    const total = busierDown ? d.down : d.up;
    const icons = Math.max(1, Math.round(total / unit));
    // Icons per device type (its shape) and per old/new, in proportion to their share of demand.
    const parts = d.parts.flatMap((p) => [
      { id: `${p.typeId}|old`, load: p.existing * (busierDown ? p.down : p.up) },
      { id: `${p.typeId}|new`, load: p.added * (busierDown ? p.down : p.up) },
    ]).filter((p) => p.load > 0);
    const seq = allocateByLoad(parts, icons);
    const counts = new Map();
    for (const id of seq) counts.set(id, (counts.get(id) ?? 0) + 1);
    // Existing devices first, newest arrivals at the back of the line.
    const ordered = [...counts].sort(([a], [b]) => (a.endsWith('|new') - b.endsWith('|new'))).flatMap(([id, n]) => Array(n).fill(id));
    const spacing = 11;
    const x0 = pos.x - ((ordered.length - 1) * spacing) / 2;
    const y = pos.y + 42;
    ordered.forEach((id, i) => {
      const [typeId, age] = id.split('|');
      group.append(svg('path', {
        d: shapeOf(catalog.deviceTypes.find((t) => t.id === typeId)),
        transform: `translate(${x0 + i * spacing} ${y})`,
        class: `queue-icon${age === 'new' ? ' queue-new' : ''}`, 'data-device': typeId,
      }));
    });
    group.append(svg('text', { x: pos.x, y: y + 18, 'text-anchor': 'middle', class: 'queue-label' },
      `Arriving: ↓ ${mbps(d.down)} · ↑ ${mbps(d.up)}`));
    if (d.newGroups.length) {
      group.append(svg('text', { x: pos.x, y: y + 32, 'text-anchor': 'middle', class: 'queue-label queue-new-label' },
        `+${d.newGroups.map((g) => `${g.count} × ${g.label}`).join(', ')} just arrived`));
    }
  }
  group.append(svg('text', { x: 12, y: L.height - 24, class: 'queue-caption' },
    `Arrival queues: each icon ≈ ${mbps(unit)} of demand waiting to enter (busier direction), shaped by device type; outlined = devices that just arrived.`));
  group.append(svg('text', { x: 12, y: L.height - 10, class: 'queue-caption' },
    'Queues show offered load only; buffering and queuing delay are not modelled.'));
  layer.append(group);
}

function renderTopologyTable({ round, catalog, comps, pending }) {
  const head = el('tr', {}, ['Switch', 'Class', 'Max device port', 'Active uplinks', 'Capacity', 'Upstream load', 'Downstream load', 'Utilization (busier)', 'Status', 'Planned change']
    .map((h) => el('th', { scope: 'col' }, h)));
  const rows = comps.map((c) => {
    const s = round.start.accessSwitches.find((x) => x.id === c.switchId);
    const cls = catalog.switchClasses.find((x) => x.id === c.classId);
    return el('tr', {},
      el('th', { scope: 'row' }, s ? s.label : 'Aggregation'),
      el('td', {}, cls.label),
      el('td', {}, c.tier === 'access' ? mbps(cls.maxPortMbps) : '—'),
      el('td', {}, `${c.activeUplinks} of ${cls.maxUplinks} × ${mbps(cls.uplinkMbps)}`),
      el('td', {}, mbps(c.capacityMbps)),
      el('td', {}, mbps(c.upMbps)),
      el('td', {}, mbps(c.downMbps)),
      el('td', {}, `${pct(c.utilizationPct)} (${c.gradedDirection})`),
      el('td', { class: c.ok && !c.portIssues.length ? 'status-ok' : 'status-bad' }, statusText(c)),
      el('td', {}, plannedText(pending, c.switchId, catalog, c) || '—'));
  });
  const devHead = el('tr', {}, ['Access switch', 'Device type', 'Count', 'Just arrived', 'Port speed', 'Up per device', 'Down per device', 'Up total', 'Down total']
    .map((h) => el('th', { scope: 'col' }, h)));
  const devRows = round.start.accessSwitches.flatMap((s) => s.deviceGroups.map((d) => {
    const t = catalog.deviceTypes.find((x) => x.id === d.deviceTypeId);
    const added = newDeviceCount(round, s.id, d.deviceTypeId);
    return el('tr', {}, el('th', { scope: 'row' }, s.label), el('td', {}, t.label), el('td', {}, String(d.count)),
      el('td', {}, added ? `+${added}` : '—'),
      el('td', {}, mbps(t.portMbps)), el('td', {}, mbps(t.upMbps)), el('td', {}, mbps(t.downMbps)),
      el('td', {}, mbps(t.upMbps * d.count)), el('td', {}, mbps(t.downMbps * d.count)));
  }));
  $('topology-table').replaceChildren(
    el('table', {}, el('caption', {}, 'Switches and uplinks (core is fixed and not graded)'), el('thead', {}, head), el('tbody', {}, rows)),
    el('table', {}, el('caption', {}, 'Devices'), el('thead', {}, devHead), el('tbody', {}, devRows)));
}

function renderProgress(progress) {
  $('progress').replaceChildren(el('p', {}, `Valid attempts this round: ${progress.attempts}`),
    progress.completed ? el('p', { class: 'status-ok' }, 'Round complete') : '');
}

/** Feedback region (live). */
export function renderFeedback(fb) {
  const body = $('feedback-body');
  if (!fb) { body.replaceChildren(); return; }
  body.replaceChildren(el('div', { class: `result ${fb.kind}` },
    el('h3', { id: 'feedback-title', tabindex: '-1' }, fb.title),
    el('p', {}, fb.message),
    fb.details.length ? el('ul', {}, fb.details.map((d) => el('li', {}, d))) : '',
    fb.rule ? el('p', { class: 'rule' }, fb.rule) : '',
    fb.citation ? el('p', { class: 'citation' }, `Source: ${fb.citation}`) : ''));
  $('feedback-title').focus();
}

export function summaryTable(rows) {
  return el('table', {}, el('thead', {}, el('tr', {}, rows.head.map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, rows.body.map((r) => el('tr', {}, el('th', { scope: 'row' }, r[0]), ...r.slice(1).map((x) => el('td', {}, String(x)))))));
}

// ---- survival game views (feature 002) -------------------------------------------------------

const clockText = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
let hudCache = {};
const setText = (id, text) => { if (hudCache[id] !== text) { $(id).textContent = text; hudCache[id] = text; } };

/** HUD: survival time, credits and income, spill countdown, pause label (FR-104, FR-105, FR-121). */
export function renderHud({ game, income, limit, failing = 0 }) {
  setText('hud-time', clockText(game.t));
  setText('hud-credits', String(game.credits));
  setText('hud-income', `(+${income}/s)`);
  // Reflect the network as it is now, even before any time has passed (e.g. paused at a notice).
  const spilling = failing > 0 || game.spill > 0;
  const left = Math.max(0, Math.ceil(limit - game.spill));
  setText('hud-spill', spilling ? `Spilling: ${left} s left${game.status === 'paused' ? ' (paused)' : ''}` : 'Healthy');
  $('hud-spill-wrap').className = `hud-item hud-spill${spilling ? ' bad' : ''}`;
  setText('pause', game.status === 'paused' ? 'Resume (P)' : 'Pause (P)');
  $('pause').disabled = game.status === 'ended';
  setText('hud-rule', `The game ends after ${limit} s of continuous spilling. Fixing every problem resets the countdown. Pausing stops the clock.${game.status === 'paused' ? ' Paused.' : ''}`);
}
export function resetHudCache() { hudCache = {}; }

/** Live status: what is spilling and why, plus recent fixes (FR-105, C2). */
export function renderStatus(lines, fixed) {
  const parts = [];
  if (lines.length) {
    parts.push(el('h3', {}, 'Spilling now'), el('ul', {}, lines.map((l) => el('li', { class: 'status-bad' }, l.text))));
  } else {
    parts.push(el('h3', {}, 'All traffic delivered'), el('p', { class: 'note' }, 'Nothing is over the 80% limit and every device has a fast enough port. Watch the arrival queues to plan ahead.'));
  }
  if (fixed.length) parts.push(el('ul', { class: 'fixed' }, fixed.map((f) => el('li', { class: 'status-ok' }, f.text))));
  $('status').replaceChildren(...parts);
  $('status').className = `status${lines.length ? ' bad' : ''}`;
}

/** Concept notice that paused play (FR-133). */
export function renderConceptNotice(notice, sources, onResume) {
  const box = $('notice');
  if (!notice) { box.hidden = true; box.replaceChildren(); return; }
  const cited = (notice.sourceIds ?? []).map((id) => sources.find((x) => x.id === id)).filter(Boolean);
  box.hidden = false;
  box.replaceChildren(
    el('h3', { id: 'notice-title', tabindex: '-1' }, 'Paused: new concept'),
    el('p', {}, notice.title),
    el('p', {}, notice.text),
    cited.length ? el('p', { class: 'citation' }, 'Source: ', ...cited.map((x) => el('a', { href: x.url, target: '_blank', rel: 'noopener' }, `${x.title} — ${x.section}`))) : '',
    el('button', { type: 'button', id: 'notice-resume', onclick: onResume }, 'Resume'));
}

/** Hint panel (FR-140). */
export function renderHint(hint) {
  $('help').replaceChildren(...(hint ? [
    el('p', { class: 'hint' }, el('strong', {}, 'Hint (method): '), hint.method),
    el('p', { class: 'hint' }, el('strong', {}, 'Hint (now): '), hint.detail),
  ] : []));
}

/** End-of-game summary (FR-104, FR-141). Hints are shown separately from the score. */
export function renderGameOver({ game, causeText, best, onRestart }) {
  showOnly('view');
  const r = game.result;
  $('view').replaceChildren(
    el('h2', { id: 'view-heading' }, `The network spilled for ${game.scenario.rules.spillLimitSeconds} seconds`),
    el('p', { class: 'score' }, `You survived ${clockText(r.score)}`),
    el('p', {}, causeText),
    el('ul', {},
      el('li', {}, `Best this session: ${clockText(best)}`),
      el('li', {}, `Credits earned: ${r.earned}; spent: ${r.spent}; left: ${game.credits}`),
      el('li', {}, `Upgrades bought: ${r.purchases}`),
      el('li', {}, `Network at the end: ${r.switches} access switches, ${r.devices} devices`),
      el('li', {}, `Hints used: ${r.hintsUsed} (assistance; not part of the score)`)),
    el('p', { class: 'note' }, 'Every game grows the same way, so you can compare scores. Growth never stops, so every network eventually spills: the question is how long you keep it running.'),
    el('button', { type: 'button', id: 'play-again', onclick: onRestart }, 'Play again'));
  focusHeading('view-heading');
}

export { focusHeading, showOnly };
