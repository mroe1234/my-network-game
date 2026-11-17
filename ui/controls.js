// Purchases (FR-111, FR-112, FR-122): the action card for the selected switch and a compact
// switch list with quick actions. Every action shows its price; unaffordable actions are
// disabled and show the shortfall. Purchases apply instantly, paused or running.
import { el, newDeviceCount } from './render.js';
import { priceOf, splitPriceOf } from '../engine/sim.js';
import { componentFails } from '../engine/rules.js';

const $ = (id) => document.getElementById(id);
const fmt = (n) => `${Math.round(n).toLocaleString('en-US')} Mbps`;
const statusOf = (c) => (c.portIssues.length ? 'PORT TOO SLOW' : c.ok ? 'OK' : 'OVER 80%');

const nameOf = (game, id) => (id === game.network.aggregation.id ? 'Aggregation switch' : game.network.accessSwitches.find((s) => s.id === id)?.label ?? id);
const switchOf = (game, id) => (id === game.network.aggregation.id
  ? { ...game.network.aggregation, tier: 'aggregation', deviceGroups: [] }
  : { ...game.network.accessSwitches.find((s) => s.id === id), tier: 'access' });

/** A purchase button: label with price, disabled with a reason when not possible. */
function buyButton(game, id, change, label, onBuy, buttonId) {
  const p = priceOf(game, id, change);
  const price = p.cost === undefined ? '' : p.cost === 0 ? ' (free, no refund)' : ` (${p.cost} cr)`;
  const b = el('button', { type: 'button', class: 'secondary', id: buttonId }, `${label}${price}`);
  if (!p.ok) {
    b.disabled = true;
    if (p.reason === 'unaffordable') b.setAttribute('title', `Need ${p.shortfall} more credits`);
  }
  b.addEventListener('click', () => onBuy(id, change, buttonId));
  return { button: b, price: p };
}

/** Action card for the switch selected in the diagram (FR-010a, FR-111). */
export function renderActionCard({ game, components, selected, handlers }) {
  const card = $('action-card');
  if (!selected) {
    card.className = 'action-card empty';
    card.replaceChildren(el('p', { class: 'note' }, 'Tip: select a switch, its uplinks or its devices in the diagram to see it here and upgrade it.'));
    return;
  }
  card.className = 'action-card';
  if (selected === 'core') {
    card.replaceChildren(
      el('h3', { id: 'card-title', tabindex: '-1' }, 'Selected: Core'),
      el('p', {}, 'The core is fixed and never the bottleneck here. The aggregation uplinks to the core are graded; select the aggregation switch to upgrade them.'),
      el('button', { type: 'button', class: 'secondary', id: 'card-close', onclick: () => handlers.onSelect(null) }, 'Close'));
    return;
  }
  const sw = switchOf(game, selected);
  const comp = components.find((c) => c.switchId === selected);
  const cls = game.scenario.switchClasses.find((c) => c.id === sw.classId);
  const parts = [
    el('h3', { id: 'card-title', tabindex: '-1' }, `Selected: ${nameOf(game, selected)}`),
    el('p', {}, `${cls.label} · ${sw.activeUplinks} of ${cls.maxUplinks} uplinks × ${fmt(cls.uplinkMbps)}`),
    el('p', {}, `↑ ${fmt(comp.upMbps)} · ↓ ${fmt(comp.downMbps)} · ${comp.utilizationPct}% of ${fmt(comp.capacityMbps)} (${comp.gradedDirection}) — ${statusOf(comp)}`),
  ];

  const plus = buyButton(game, selected, { classId: sw.classId, activeUplinks: sw.activeUplinks + 1 }, '+ uplink', handlers.onBuy, 'card-plus');
  const minus = buyButton(game, selected, { classId: sw.classId, activeUplinks: sw.activeUplinks - 1 }, '− uplink', handlers.onBuy, 'card-minus');
  if (sw.activeUplinks >= cls.maxUplinks) plus.button.textContent = `+ uplink (all ${cls.maxUplinks} in use)`;
  parts.push(el('div', { class: 'card-buttons' }, minus.button, plus.button));
  if (plus.price.reason === 'unaffordable') parts.push(el('p', { class: 'note' }, `+ uplink needs ${plus.price.shortfall} more credits.`));
  if (sw.activeUplinks >= cls.maxUplinks) parts.push(el('p', { class: 'note' }, 'More bandwidth than this needs a different switch class.'));

  // Replace switch: picker + explicit Buy, so browsing classes never spends credits.
  const choices = game.scenario.switchClasses.filter((c) => c.roles.includes(sw.tier) && c.id !== sw.classId);
  if (choices.length) {
    const select = el('select', { id: 'card-class' });
    for (const c of choices) select.append(el('option', { value: c.id }, `${c.label}, ports up to ${fmt(c.maxPortMbps)}`));
    const chosen = handlers.pendingClass?.[selected] && choices.some((c) => c.id === handlers.pendingClass[selected]) ? handlers.pendingClass[selected] : choices[0].id;
    select.value = chosen;
    const nextCls = game.scenario.switchClasses.find((c) => c.id === chosen);
    const n = Math.min(Math.max(1, sw.activeUplinks), nextCls.maxUplinks);
    const replace = buyButton(game, selected, { classId: chosen, activeUplinks: n }, `Replace with ${n} uplink${n === 1 ? '' : 's'}`, handlers.onBuy, 'card-replace');
    select.addEventListener('change', () => handlers.onPickClass(selected, select.value));
    parts.push(el('label', { for: 'card-class' }, 'Replace switch with'), select, replace.button);
    if (replace.price.reason === 'unaffordable') parts.push(el('p', { class: 'note' }, `Replacing needs ${replace.price.shortfall} more credits.`));
  }

  if (sw.tier === 'access') {
    const viewRound = { addedDevices: recentAsAdded(game), addedSwitches: [] };
    const rows = sw.deviceGroups.map((g) => {
      const t = game.deviceTypes.find((d) => d.id === g.deviceTypeId);
      const added = newDeviceCount(viewRound, sw.id, g.deviceTypeId);
      const tooFast = t.portMbps > cls.maxPortMbps;
      return el('li', {}, `${g.count} × ${t.label}${added ? ` (+${added} just arrived)` : ''}: ${fmt(t.portMbps)} port${tooFast ? ' (too fast for this switch)' : ''}, ↑ ${fmt(t.upMbps)} ↓ ${fmt(t.downMbps)} each → ↑ ${fmt(t.upMbps * g.count)} ↓ ${fmt(t.downMbps * g.count)}`);
    });
    const used = sw.deviceGroups.reduce((n, g) => n + g.count, 0);
    parts.push(el('h4', {}, `Devices (${used} of ${cls.devicePorts} ports)`), el('ul', {}, rows));

    // Split (FR-115): a second switch of the same class takes about half of each device type.
    const sp = splitPriceOf(game, selected);
    const split = el('button', { type: 'button', class: 'secondary', id: 'card-split' },
      sp.cost !== undefined ? `Split into two switches (${sp.cost} cr)` : 'Split into two switches');
    split.disabled = !sp.ok;
    split.addEventListener('click', () => handlers.onSplit(selected));
    const why = {
      'split-limit': `You have used all ${sp.maxSplits} splits for this game.`,
      'too-few-types': `Each half must keep at least ${sp.min} device types; some types have only one device here.`,
      unaffordable: `Splitting needs ${sp.shortfall} more credits.`,
    }[sp.reason];
    parts.push(el('h4', {}, 'Split this switch'),
      el('p', { class: 'note' }, `Buys a new ${cls.label} with 1 uplink and moves about half of each device type onto it. This switch keeps its uplinks.`),
      split);
    if (why) parts.push(el('p', { class: 'note' }, why));
  } else {
    parts.push(el('p', { class: 'note' }, 'Aggregation carries the sum of every access switch, per direction.'));
  }
  parts.push(el('button', { type: 'button', class: 'secondary', id: 'card-close', onclick: () => handlers.onSelect(null) }, 'Close'));
  card.replaceChildren(...parts);
}

/** Compact list of every switch with status and a quick "+ uplink" action. */
export function renderSwitchList({ game, components, handlers }) {
  const ids = [game.network.aggregation.id, ...game.network.accessSwitches.map((s) => s.id)];
  const items = ids.map((id) => {
    const c = components.find((x) => x.switchId === id);
    const sw = switchOf(game, id);
    const cls = game.scenario.switchClasses.find((x) => x.id === sw.classId);
    const quick = buyButton(game, id, { classId: sw.classId, activeUplinks: sw.activeUplinks + 1 }, '+ uplink', handlers.onBuy, `quick-${id}`);
    if (sw.activeUplinks >= cls.maxUplinks) quick.button.textContent = '+ uplink (max)';
    const details = el('button', { type: 'button', class: 'link-button', onclick: () => handlers.onSelect(id) }, 'Details');
    return el('li', { class: componentFails(c) ? 'bad' : '' },
      el('span', { class: 'sl-name' }, nameOf(game, id)),
      el('span', { class: componentFails(c) ? 'status-bad' : 'status-ok' }, ` ${c.utilizationPct}% ${statusOf(c)}`),
      el('div', { class: 'sl-actions' }, quick.button, details));
  });
  $('switch-list').replaceChildren(el('h3', {}, 'Switches'), el('ul', {}, items));
}

/** game.recent.items → addedDevices list for the renderer's "just arrived" marks. */
export function recentAsAdded(game) {
  return Object.entries(game.recent.items).flatMap(([switchId, byType]) =>
    Object.entries(byType).map(([deviceTypeId, count]) => ({ switchId, deviceTypeId, count })));
}
