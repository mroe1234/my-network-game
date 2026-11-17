// Minimal continuous packet flow (T021). Packets move along every uplink over the committed
// design; components over 80% visibly spill. Purely illustrative: never times, blocks or
// scores anything (FR-011). Reduced motion → static before/after view (FR-025).

const SVG_NS = 'http://www.w3.org/2000/svg';
let frame = null;

export const prefersReducedMotion = () =>
  typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function stopFlow() {
  if (frame !== null) cancelAnimationFrame(frame);
  frame = null;
}

function circle(layer, cls, at) {
  const c = document.createElementNS(SVG_NS, 'circle');
  c.setAttribute('r', '3.5');
  c.setAttribute('class', cls);
  // Start at the stream origin so nothing flashes at (0, 0) before the first frame.
  c.setAttribute('cx', String(at.x));
  c.setAttribute('cy', String(at.y));
  layer.append(c);
  return c;
}

/**
 * startFlow({ svg, layout, components, round, staticTarget, before })
 * staticTarget: element for the reduced-motion before/after text view.
 * before: components of the round start, for the before/after view.
 */
export function startFlow({ svg, layout, components, round, staticTarget, before }) {
  stopFlow();
  const layer = svg.querySelector('#flow-layer');
  layer.replaceChildren();

  // Spill markers are static text, so they show with or without motion.
  for (const c of components) {
    if (c.ok && c.portIssues.length === 0) continue;
    const pos = c.tier === 'aggregation' ? layout.agg : layout.access[c.switchId];
    const t = document.createElementNS(SVG_NS, 'text');
    // Aggregation: left of its box (its uplinks run above and below). Access: just below the box.
    const isAgg = c.tier === 'aggregation';
    t.setAttribute('x', String(isAgg ? pos.x - 118 : pos.x + 8));
    t.setAttribute('y', String(isAgg ? pos.y + 4 : pos.y + 38));
    t.setAttribute('text-anchor', isAgg ? 'end' : 'start');
    t.setAttribute('class', 'spill-label');
    t.textContent = c.portIssues.length ? 'port too slow' : 'spilling';
    layer.append(t);
  }

  if (staticTarget) staticTarget.replaceChildren();
  if (prefersReducedMotion()) {
    if (staticTarget) {
      const lines = components.map((c) => {
        const b = before?.find((x) => x.switchId === c.switchId);
        const name = c.tier === 'aggregation' ? 'Aggregation' : round.start.accessSwitches.find((s) => s.id === c.switchId).label;
        const state = c.ok && c.portIssues.length === 0 ? 'delivering' : 'spilling';
        return `${name}: ${b ? `${b.utilizationPct}% → ` : ''}${c.utilizationPct}% (${state})`;
      });
      const p = document.createElement('p');
      p.className = 'static-flow';
      p.textContent = `Packet flow (static, reduced motion): ${lines.join(' · ')}`;
      staticTarget.append(p);
    }
    return;
  }

  // One stream per uplink group. Density scales with the busier-direction load (capped), so a
  // busy uplink visibly carries more packets; speed is constant so motion never implies a timer.
  const maxLoad = Math.max(...components.map((c) => c.gradedMbps), 1);
  const streams = components.map((c) => {
    const lower = c.tier === 'aggregation' ? layout.agg : layout.access[c.switchId];
    const upper = c.tier === 'aggregation' ? layout.core : layout.agg;
    const from = { x: lower.x, y: lower.y - 22 };
    const to = { x: upper.x, y: upper.y + 22 };
    const failing = !c.ok || c.portIssues.length > 0;
    const count = Math.max(3, Math.round(4 + 14 * (c.gradedMbps / maxLoad)));
    // Share of packets that spill = the part of the load above 80% of capacity (all, for port problems).
    const over = c.portIssues.length ? 0.5 : Math.max(0, 1 - (0.8 * c.capacityMbps) / Math.max(c.gradedMbps, 1));
    const spillEvery = failing ? Math.max(1, Math.round(1 / Math.max(over, 0.15))) : 0;
    return {
      from, to, spillEvery,
      packets: Array.from({ length: count }, (_, i) => ({ phase: i / count, el: circle(layer, 'packet', from) })),
    };
  });

  const t0 = performance.now();
  const tick = (now) => {
    // rAF timestamps can precede t0; wrap into [0, 1) so packets never run behind their origin.
    const t = Math.max(0, now - t0) / 3200;
    for (const s of streams) {
      s.packets.forEach((p, i) => {
        const f = (((t + p.phase) % 1) + 1) % 1;
        let x = s.from.x + (s.to.x - s.from.x) * f;
        let y = s.from.y + (s.to.y - s.from.y) * f;
        // Spilled packets peel off the overloaded uplink halfway up, fall away and fade.
        const spills = s.spillEvery > 0 && i % s.spillEvery === 0 && f > 0.5;
        let opacity = 1;
        if (spills) {
          const k = (f - 0.5) * 2; // 0 → 1
          x += k * 26;
          y = s.from.y + (s.to.y - s.from.y) * 0.5 + k * 40;
          opacity = 1 - k;
        }
        p.el.setAttribute('cx', x.toFixed(1));
        p.el.setAttribute('cy', y.toFixed(1));
        p.el.setAttribute('opacity', opacity.toFixed(2));
        p.el.setAttribute('class', spills ? 'packet spill' : 'packet');
      });
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);
}
