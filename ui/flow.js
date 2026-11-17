// Continuous packet flow over the committed design. Purely illustrative: never times, blocks or
// scores anything (FR-011). Reduced motion → static before/after view (FR-025).
//
// Encoding (change request 4):
//   shape     = the device type the packet comes from or goes to (DeviceType.shape)
//   colour    = direction: blue toward the device (downstream), purple from the device (upstream)
//   shade     = how full that link is in that direction: lighter = spare capacity, darker = full
//   lane      = toward-device and from-device packets use opposite sides of each link
//   spilling  = packets peel off halfway and fade where that direction is over 80%
// Every encoding is also explained in the text legend and the numbers on screen (C4).
import { SHAPES, shapeOf, packetFill, allocateByLoad } from './shapes.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
const LANE = 5;
let frame = null;

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function stopFlow() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function glyph(parent, d, fill, attrs = {}) {
  const p = document.createElementNS(SVG_NS, 'path');
  p.setAttribute('d', d);
  p.setAttribute('fill', fill);
  for (const [k, v] of Object.entries(attrs)) p.setAttribute(k, v);
  parent.append(p);
  return p;
}

function icon(d, fill) {
  const s = document.createElementNS(SVG_NS, 'svg');
  s.setAttribute('viewBox', '-6 -6 12 12');
  s.setAttribute('width', '13');
  s.setAttribute('height', '13');
  s.setAttribute('aria-hidden', 'true');
  glyph(s, d, fill, { stroke: 'currentColor', 'stroke-width': '0.6' });
  return s;
}

/** Text legend (outside the scrolling diagram) using the same shapes and colours. */
function renderLegend(target, catalog, round, animating) {
  if (!target) return;
  target.replaceChildren();
  if (!animating) return;
  const used = new Set(round.start.accessSwitches.flatMap((s) => s.deviceGroups.map((g) => g.deviceTypeId)));
  const row = (title, items) => {
    const line = document.createElement('span');
    line.className = 'legend-row';
    const b = document.createElement('strong');
    b.textContent = `${title}: `;
    line.append(b);
    for (const [d, fill, text] of items) {
      const span = document.createElement('span');
      span.className = 'legend-item';
      span.append(icon(d, fill), document.createTextNode(` ${text}`));
      line.append(span);
    }
    return line;
  };
  const types = catalog.deviceTypes.filter((t) => used.has(t.id));
  const grey = 'hsl(220 8% 55%)';
  target.append(
    row('Shape = device', types.map((t) => [shapeOf(t), grey, t.label])),
    row('Colour = direction', [
      [SHAPES.circle, packetFill('to-device', 0.4), 'blue: toward the device (downstream)'],
      [SHAPES.circle, packetFill('from-device', 0.4), 'purple: from the device (upstream)'],
    ]),
    row('Shade = how full the link is', [
      [SHAPES.circle, packetFill('to-device', 0), 'light: lots of spare capacity'],
      [SHAPES.circle, packetFill('to-device', 0.4), 'half full'],
      [SHAPES.circle, packetFill('to-device', 0.8), 'dark: at or over the 80% limit (packets peel off and fade when spilling)'],
    ]),
  );
}

/** Offset perpendicular to the segment from→to by `d` px (left of the direction of travel). */
function laneOffset(from, to, d) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: (dy / len) * d, y: (-dx / len) * d };
}

/** Share of a direction's packets that spill: the part of the load above 80% of capacity. */
function spillShare(load, capacity) {
  if (load <= 0 || load * 100 <= 80 * capacity) return 0;
  return 1 - (0.8 * capacity) / load;
}

/**
 * One stream = one direction on one link. `types` is the ordered device-type sequence for its
 * packets; `utilization` sets the shade; `share` of packets spill.
 */
function makeStream(layer, catalog, { from, to, direction, types, utilization, share, spillTypes }) {
  const off = laneOffset(from, to, LANE);
  const a = { x: from.x + off.x, y: from.y + off.y };
  const b = { x: to.x + off.x, y: to.y + off.y };
  const fill = packetFill(direction, utilization);
  const spillEvery = share > 0 ? Math.max(1, Math.round(1 / Math.max(share, 0.15))) : 0;
  const packets = types.map((typeId, i) => {
    const t = catalog.deviceTypes.find((x) => x.id === typeId);
    const el = glyph(layer, shapeOf(t), fill, {
      class: `packet ${direction}`, 'data-device': typeId, 'data-util': utilization.toFixed(3),
      transform: `translate(${a.x.toFixed(1)} ${a.y.toFixed(1)})`, // no flash at (0, 0)
    });
    const spills = spillTypes ? spillTypes.has(typeId) && i % 2 === 0 : (spillEvery > 0 && i % spillEvery === 0);
    return { phase: i / types.length, el, spills };
  });
  return { a, b, packets };
}

/**
 * startFlow({ svg, layout, components, round, catalog, staticTarget, legendTarget, before })
 */
export function startFlow({ svg, layout, components, round, catalog, staticTarget, legendTarget, before }) {
  stopFlow();
  const layer = svg.querySelector('#flow-layer');
  layer.replaceChildren();

  // Spill markers are static text, so they show with or without motion.
  for (const c of components) {
    if (c.ok && c.portIssues.length === 0) continue;
    const pos = c.tier === 'aggregation' ? layout.agg : layout.access[c.switchId];
    const t = document.createElementNS(SVG_NS, 'text');
    const isAgg = c.tier === 'aggregation';
    t.setAttribute('x', String(isAgg ? pos.x - 118 : pos.x + 8));
    t.setAttribute('y', String(isAgg ? pos.y + 4 : pos.y + 38));
    t.setAttribute('text-anchor', isAgg ? 'end' : 'start');
    t.setAttribute('class', 'spill-label');
    t.textContent = c.portIssues.length ? 'port too slow' : 'spilling';
    layer.append(t);
  }

  const reduced = prefersReducedMotion();
  renderLegend(legendTarget, catalog, round, !reduced);
  if (staticTarget) staticTarget.replaceChildren();
  if (reduced) {
    if (staticTarget) {
      const lines = components.map((c) => {
        const b = before?.find((x) => x.switchId === c.switchId);
        const name = c.tier === 'aggregation' ? 'Aggregation' : round.start.accessSwitches.find((s) => s.id === c.switchId).label;
        const state = c.ok && c.portIssues.length === 0 ? 'delivering' : 'spilling';
        return `${name}: ↑ ${c.upMbps.toLocaleString('en-US')} ↓ ${c.downMbps.toLocaleString('en-US')} Mbps, ${b ? `${b.utilizationPct}% → ` : ''}${c.utilizationPct}% (${state})`;
      });
      const p = document.createElement('p');
      p.className = 'static-flow';
      p.textContent = `Packet flow (static, reduced motion): ${lines.join(' · ')}`;
      staticTarget.append(p);
    }
    return;
  }

  const dt = (id) => catalog.deviceTypes.find((t) => t.id === id);
  // Per-switch, per-direction load by device type (aggregation = all switches combined).
  const loadsFor = (switches, dir) => {
    const by = new Map();
    for (const s of switches) for (const g of s.deviceGroups) {
      const t = dt(g.deviceTypeId);
      by.set(t.id, (by.get(t.id) ?? 0) + g.count * (dir === 'from-device' ? t.upMbps : t.downMbps));
    }
    return [...by].map(([id, load]) => ({ id, load }));
  };

  const maxLoad = Math.max(...components.flatMap((c) => [c.upMbps, c.downMbps]), 1);
  const density = (load) => (load > 0 ? Math.max(2, Math.round(2 + 12 * (load / maxLoad))) : 0);
  const streams = [];
  for (const c of components) {
    const lower = c.tier === 'aggregation' ? layout.agg : layout.access[c.switchId];
    const upper = c.tier === 'aggregation' ? layout.core : layout.agg;
    const bottom = { x: lower.x, y: lower.y - 22 };
    const top = { x: upper.x, y: upper.y + 22 };
    const switches = c.tier === 'aggregation' ? round.start.accessSwitches : round.start.accessSwitches.filter((s) => s.id === c.switchId);
    for (const [direction, load, from, to] of [
      ['from-device', c.upMbps, bottom, top], // upstream: from the devices toward the core
      ['to-device', c.downMbps, top, bottom], // downstream: toward the devices
    ]) {
      streams.push(makeStream(layer, catalog, {
        from, to, direction,
        types: allocateByLoad(loadsFor(switches, direction), density(load)),
        utilization: load / c.capacityMbps,
        share: spillShare(load, c.capacityMbps),
      }));
    }

    if (c.tier === 'access') {
      // End-user device links: shade = each device's own demand ÷ the port speed it actually gets.
      const sw = switches[0];
      const cls = catalog.switchClasses.find((x) => x.id === c.classId);
      const dev = layout.devices[c.switchId];
      const devTop = { x: dev.x, y: dev.y - 22 };
      const accBottom = { x: lower.x, y: lower.y + 22 };
      const tooFast = new Set(c.portIssues.map((p) => p.deviceTypeId));
      for (const g of sw.deviceGroups) {
        const t = dt(g.deviceTypeId);
        const port = Math.min(t.portMbps, cls.maxPortMbps);
        streams.push(makeStream(layer, catalog, { from: devTop, to: accBottom, direction: 'from-device',
          types: Array(3).fill(t.id), utilization: t.upMbps / port, share: 0, spillTypes: tooFast }));
        streams.push(makeStream(layer, catalog, { from: accBottom, to: devTop, direction: 'to-device',
          types: Array(3).fill(t.id), utilization: t.downMbps / port, share: 0, spillTypes: tooFast }));
      }
    }
  }
  // Spread device-link packets of different types along the link instead of stacking them.
  streams.forEach((s, k) => s.packets.forEach((p) => { p.phase = (p.phase + k * 0.137) % 1; }));

  const t0 = performance.now();
  const tick = (now) => {
    // rAF timestamps can precede t0; wrap into [0, 1) so packets never run behind their origin.
    const t = Math.max(0, now - t0) / 3200;
    for (const s of streams) {
      for (const p of s.packets) {
        const f = (((t + p.phase) % 1) + 1) % 1;
        let x = s.a.x + (s.b.x - s.a.x) * f;
        let y = s.a.y + (s.b.y - s.a.y) * f;
        let opacity = 1;
        if (p.spills && f > 0.5) {
          // Spilled packets peel off halfway along, drift sideways, and fade.
          const k = (f - 0.5) * 2;
          x = s.a.x + (s.b.x - s.a.x) * 0.5 + k * 28;
          y = s.a.y + (s.b.y - s.a.y) * 0.5 + k * 18;
          opacity = 1 - k;
        }
        p.el.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
        p.el.setAttribute('opacity', opacity.toFixed(2));
        p.el.classList.toggle('spill', p.spills && f > 0.5);
      }
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
