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
    el('li', {}, `${e.levelId ? `Level ${e.levelId}` : 'Catalog'}${e.roundId ? `, round ${e.roundId}` : ''}: ${e.path} — ${e.message}`)));
  $('view').replaceChildren(
    el('h2', { id: 'view-heading' }, 'This challenge is unavailable'),
    el('div', { class: 'feedback' }, el('div', { class: 'result content-error' },
      el('p', {}, 'The level content failed validation, so it cannot be played or graded. No attempts were counted.'),
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
    width, height: 400,
    core: { x: width / 2, y: 30 },
    agg: { x: width / 2, y: 130 },
    access: Object.fromEntries(round.start.accessSwitches.map((s, i) => [s.id, { x: xs[i], y: 250 }])),
    devices: Object.fromEntries(round.start.accessSwitches.map((s, i) => [s.id, { x: xs[i], y: 360 }])),
  };
}

function node(g, { x, y }, title, subtitle, failing) {
  g.append(svg('rect', { x: x - 110, y: y - 22, width: 220, height: 44, rx: 8, class: `node${failing ? ' node-bad' : ''}` }));
  g.append(svg('text', { x, y: y - 4, 'text-anchor': 'middle', class: 'node-title' }, title));
  if (subtitle) g.append(svg('text', { x, y: y + 13, 'text-anchor': 'middle', class: 'node-sub' }, subtitle));
}

/** Draw one uplink group as N parallel lines (one per active uplink). */
function uplinks(g, from, to, c, id, planned) {
  const count = c.activeUplinks;
  for (let i = 0; i < count; i += 1) {
    const off = (i - (count - 1) / 2) * 6;
    g.append(svg('line', { x1: from.x + off, y1: from.y - 22, x2: to.x + off, y2: to.y + 22,
      class: `link${c.ok && !c.portIssues.length ? '' : ' link-bad'}`, 'data-link': id }));
  }
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
 */
export function renderRound({ level, round, roundIndex, catalog, committed, pending, progress }) {
  showOnly('round');
  $('round-heading').textContent = `${level.title} · Round ${roundIndex + 1} of ${level.rounds.length}`;
  $('round-intro').textContent = round.intro;

  const comps = componentsFor(catalog, round, committed);
  const byId = new Map(comps.map((c) => [c.switchId, c]));
  const L = layout(round);
  // Natural size (no shrinking): the labeled container scrolls instead, so text stays readable.
  const root = svg('svg', { viewBox: `0 0 ${L.width} ${L.height}`, width: L.width, height: L.height, role: 'img', 'aria-labelledby': 'topo-title' });
  root.append(svg('title', { id: 'topo-title' }, 'Network topology; the same values are in the table below.'));
  const g = svg('g');
  root.append(g);

  const aggC = byId.get(round.start.aggregation.id);
  uplinks(g, L.agg, L.core, aggC, aggC.switchId, plannedText(pending, aggC.switchId, catalog, aggC));
  for (const s of round.start.accessSwitches) {
    const c = byId.get(s.id);
    uplinks(g, L.access[s.id], L.agg, c, s.id, plannedText(pending, s.id, catalog, c));
    const dev = L.devices[s.id];
    g.append(svg('line', { x1: dev.x, y1: dev.y - 22, x2: L.access[s.id].x, y2: L.access[s.id].y + 22, class: `link access-link${c.portIssues.length ? ' link-bad' : ''}` }));
  }
  node(g, L.core, 'Core', 'fixed · not graded', false);
  node(g, L.agg, 'Aggregation', shortClass(catalog.switchClasses.find((x) => x.id === aggC.classId)), !aggC.ok);
  for (const s of round.start.accessSwitches) {
    const c = byId.get(s.id);
    const cls = catalog.switchClasses.find((x) => x.id === c.classId);
    node(g, L.access[s.id], s.label, `${shortClass(cls)} · ports ≤ ${cls.maxPortMbps / 1000}G`, !c.ok || c.portIssues.length > 0);
    const groups = s.deviceGroups.map((d) => {
      const t = catalog.deviceTypes.find((x) => x.id === d.deviceTypeId);
      return `${d.count} × ${t.label}`;
    }).join(', ');
    node(g, L.devices[s.id], groups.length > 30 ? `${groups.slice(0, 29)}…` : groups, 'see table for demand', c.portIssues.length > 0);
  }
  const flowLayer = svg('g', { id: 'flow-layer', 'aria-hidden': 'true' });
  root.append(flowLayer);
  $('topology').replaceChildren(root);

  renderTopologyTable({ round, catalog, comps, pending });
  renderProgress(progress);
  return { svg: root, layout: L, components: comps };
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
  const devHead = el('tr', {}, ['Access switch', 'Device type', 'Count', 'Port speed', 'Up per device', 'Down per device', 'Up total', 'Down total']
    .map((h) => el('th', { scope: 'col' }, h)));
  const devRows = round.start.accessSwitches.flatMap((s) => s.deviceGroups.map((d) => {
    const t = catalog.deviceTypes.find((x) => x.id === d.deviceTypeId);
    return el('tr', {}, el('th', { scope: 'row' }, s.label), el('td', {}, t.label), el('td', {}, String(d.count)),
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

export function renderLevelSummary(level, rows, onNext, isLast) {
  showOnly('view');
  $('view').replaceChildren(
    el('h2', { id: 'view-heading' }, `Level complete · ${level.title}`),
    summaryTable(rows),
    el('button', { type: 'button', id: 'summary-next', onclick: onNext }, isLast ? 'See session summary' : 'Next level'));
  focusHeading('view-heading');
}

export function summaryTable(rows) {
  return el('table', {}, el('caption', {}, 'Completed rounds, valid attempts and assistance are counted separately.'),
    el('thead', {}, el('tr', {}, ['Round', 'Completed', 'Valid attempts', 'Assistance'].map((h) => el('th', { scope: 'col' }, h)))),
    el('tbody', {}, rows.map((r) => el('tr', {}, el('th', { scope: 'row' }, r.label), el('td', {}, r.completed ? 'Yes' : 'No'),
      el('td', {}, String(r.attempts)), el('td', {}, r.assistance)))));
}

export { focusHeading, showOnly };

// ---- help and summaries (T032) --------------------------------------------------------------

/** Revealed hints (Round.hints, method first) and the worked solution (Round.reference). */
export function renderHelp({ round, catalog, progress }) {
  const items = [];
  round.hints.slice(0, progress.hintsViewed).forEach((h, i) => {
    items.push(el('p', { class: 'hint' }, el('strong', {}, i === 0 ? 'Hint 1 (method): ' : 'Hint 2 (worked step): '), h));
  });
  if (progress.solutionViewed) {
    const names = new Map([[round.start.aggregation.id, 'Aggregation switch'], ...round.start.accessSwitches.map((s) => [s.id, s.label])]);
    const changes = Object.entries(round.reference).map(([id, c]) => {
      const cls = catalog.switchClasses.find((x) => x.id === c.classId);
      return el('li', {}, `${names.get(id)}: ${cls.label} with ${c.activeUplinks} active uplink${c.activeUplinks === 1 ? '' : 's'}`);
    });
    items.push(el('div', { class: 'solution' }, el('strong', {}, 'Worked solution (recorded as assistance): '), el('ul', {}, changes)));
  }
  $('help').replaceChildren(...items);
}

const assistanceText = (r) => [
  r.hintsViewed ? `${r.hintsViewed} hint${r.hintsViewed > 1 ? 's' : ''}` : '',
  r.solutionViewed ? 'worked solution' : '',
].filter(Boolean).join(', ') || 'none';

export function summaryRowsFrom(levelSum) {
  return levelSum.rows.map((r) => ({ label: r.label, completed: r.completed, attempts: r.attempts, assistance: assistanceText(r) }));
}

/** Session summary: completion, valid attempts and assistance as separate figures (FR-016, FR-021). */
export function renderSessionSummary(summary, onRestart) {
  showOnly('view');
  $('view').replaceChildren(
    el('h2', { id: 'view-heading' }, 'Session complete: all packets delivered'),
    el('ul', {},
      el('li', {}, `Rounds completed: ${summary.completed} of ${summary.totalRounds}`),
      el('li', {}, `Valid attempts: ${summary.attempts}`),
      el('li', {}, `Rounds with assistance: ${summary.assistedRounds} (hints viewed: ${summary.hintsViewed}; worked solutions viewed: ${summary.solutionsViewed})`)),
    el('p', {}, 'Completing a round shows the network works; rounds completed with assistance are not counted as independent mastery.'),
    ...summary.levels.map((l) => el('section', {}, el('h3', {}, l.level.title), summaryTable(summaryRowsFrom(l)))),
    el('button', { type: 'button', id: 'play-again', onclick: onRestart }, 'Play again'));
  focusHeading('view-heading');
}
