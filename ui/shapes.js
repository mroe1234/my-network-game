// Packet and queue glyphs. Shape = device type (from DeviceType.shape in data/scenario.json);
// colour = direction (blue toward the device, purple from the device); shade = how full the
// link is (darker = less spare capacity). Shared by ui/flow.js and ui/render.js.

const hexagon = (() => {
  const pts = Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return `${(4.4 * Math.cos(a)).toFixed(2)},${(4.4 * Math.sin(a)).toFixed(2)}`;
  });
  return `M${pts.join(' L')} Z`;
})();

export const SHAPES = {
  circle: 'M-3.8,0 a3.8,3.8 0 1,0 7.6,0 a3.8,3.8 0 1,0 -7.6,0',
  triangle: 'M0,-4.6 L4.4,3.4 L-4.4,3.4 Z',
  square: 'M-3.4,-3.4 h6.8 v6.8 h-6.8 Z',
  diamond: 'M0,-4.8 L4.2,0 L0,4.8 L-4.2,0 Z',
  hexagon,
};
export const SHAPE_NAMES = { circle: '●', triangle: '▲', square: '■', diamond: '◆', hexagon: '⬢' };
export const shapeOf = (deviceType) => SHAPES[deviceType?.shape] ?? SHAPES.circle;

const darkScheme = () => typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;

/**
 * Fill for a packet. direction: 'to-device' (blue) | 'from-device' (purple).
 * utilization: load ÷ capacity for that direction (0 … ≥ 1). Darker as the link fills up;
 * it reaches the darkest shade at the 80% limit and stays there above it.
 */
export function packetFill(direction, utilization) {
  const hue = direction === 'to-device' ? 213 : 272;
  const fill = Math.max(0, Math.min(1, utilization / 0.8));
  const [light, dark] = darkScheme() ? [82, 42] : [74, 26];
  const l = light - (light - dark) * fill;
  return `hsl(${hue} 70% ${l.toFixed(0)}%)`;
}

/** Split `count` packets among device types in proportion to their load (largest remainder). */
export function allocateByLoad(parts, count) {
  const total = parts.reduce((n, p) => n + p.load, 0);
  if (total <= 0 || count <= 0) return [];
  const raw = parts.map((p) => ({ ...p, exact: (p.load / total) * count }));
  const out = raw.map((p) => ({ ...p, n: Math.floor(p.exact) }));
  let left = count - out.reduce((n, p) => n + p.n, 0);
  for (const p of out.slice().sort((a, b) => (b.exact - b.n) - (a.exact - a.n))) {
    if (left <= 0) break;
    p.n += 1;
    left -= 1;
  }
  // Interleave so a mixed stream alternates types instead of arriving in blocks.
  const seq = [];
  const pools = out.map((p) => ({ id: p.id, n: p.n }));
  while (seq.length < count) {
    for (const p of pools) if (p.n > 0) { seq.push(p.id); p.n -= 1; }
  }
  return seq;
}
