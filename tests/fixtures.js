// Small hand-built fixtures. All values in Mbps. Expected results in the tests are
// computed BY HAND in comments, never by calling evaluate() (constitution C1, SC-002).

export const CLASSES = [
  { id: 'sw-1g', label: '1G access (4×10G uplinks)', maxPortMbps: 1000, devicePorts: 48, uplinkMbps: 10000, maxUplinks: 4, roles: ['access'] },
  { id: 'sw-nbaset', label: 'nbase-t access (4×25G uplinks)', maxPortMbps: 10000, devicePorts: 48, uplinkMbps: 25000, maxUplinks: 4, roles: ['access'] },
  { id: 'sw-25g', label: '25G switch (2×100G uplinks)', maxPortMbps: 25000, devicePorts: 48, uplinkMbps: 100000, maxUplinks: 2, roles: ['access', 'aggregation'] },
];

export const DEVICES = [
  { id: 'dt-a', label: 'Office laptop', portMbps: 1000, upMbps: 100, downMbps: 200 },
  { id: 'dt-a201', label: 'Laptop +1', portMbps: 1000, upMbps: 100, downMbps: 201 },
  { id: 'dt-heavy', label: 'Video workstation', portMbps: 1000, upMbps: 300, downMbps: 400 },
  { id: 'dt-x', label: 'Render node', portMbps: 1000, upMbps: 200, downMbps: 900 },
  { id: 'dt-cam', label: 'Uploading camera', portMbps: 1000, upMbps: 200, downMbps: 10 },
  { id: 'dt-mg', label: 'Wi-Fi 7 AP', portMbps: 5000, upMbps: 500, downMbps: 1000 },
];

export const CATALOG = { switchClasses: CLASSES, deviceTypes: DEVICES };

const agg = (activeUplinks = 1) => ({ id: 'agg', classId: 'sw-25g', activeUplinks });
const access = (id, classId, activeUplinks, deviceTypeId, count) =>
  ({ id, label: id.toUpperCase(), classId, activeUplinks, deviceGroups: [{ deviceTypeId, count }] });

export function round(start, allowedUpgrades = ['uplinks', 'replace']) {
  return { id: 'r-test', intro: 'test', start, addedSwitches: [], addedDevices: [], allowedUpgrades, claims: {}, hints: ['m', 'w'], reference: {} };
}

// F1: a1 = 41 × dt-a on sw-1g, 1 uplink → down 8 200 / 10 000 = 82 % (fail), up 4 100.
//     a2 = 10 × dt-a on sw-1g, 1 uplink → down 2 000 / 10 000 = 20 %.
//     agg: down 10 200 / 100 000 = 10.2 %.
export const F1 = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 1, 'dt-a', 41), access('a2', 'sw-1g', 1, 'dt-a', 10)] });

// F2: a1 = 48 × dt-heavy on sw-1g, 1 uplink → down 19 200 (up 14 400) / 10 000 = 192 %.
export const F2 = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 1, 'dt-heavy', 48)] });

// F3: a1 = 48 × dt-x on sw-1g, 2 uplinks → down 43 200 / 20 000 = 216 %.
//     Max on sw-1g: 4 × 10 000 = 40 000 → 108 % (fail). nbase-t × 2 = 50 000 → 86.4 % (fail).
//     nbase-t × 4 = 100 000 → 43.2 % (pass).
export const F3 = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 2, 'dt-x', 48)] });

// F4: a1 = 4 × dt-mg (5G ports) on sw-1g (1G ports), 2 uplinks → down 4 000 / 20 000 = 20 %,
//     but port speed 5 000 > 1 000 → port issue at start.
export const F4 = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 2, 'dt-mg', 4)] });

// F5: a1 = 41 × dt-cam, sw-1g, 1 uplink → up 8 200 (82 %, fail), down 410. Upstream decides.
export const F5 = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 1, 'dt-cam', 41)] });

// F6: boundary. a1 = 40 × dt-a, 1 uplink → down 8 000 / 10 000 = exactly 80 % (pass).
//     a2 = 41 × dt-a, 1 uplink → 82 % (fail) so the round starts broken.
export const F6 = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 1, 'dt-a', 40), access('a2', 'sw-1g', 1, 'dt-a', 41)] });

// F6b: as F6 but a1 uses dt-a201 → 40 × 201 = 8 040 → 80.4 % (fail): the +1 Mbps case.
export const F6b = round({ aggregation: agg(), accessSwitches: [access('a1', 'sw-1g', 1, 'dt-a201', 40), access('a2', 'sw-1g', 1, 'dt-a', 41)] });

// F7: aggregation bottleneck. a1, a2 = 48 × dt-x on nbase-t, 4 uplinks → 43 200 / 100 000 = 43.2 % each.
//     agg (1 uplink): down 86 400 / 100 000 = 86.4 % (fail); 2 uplinks → 43.2 % (pass).
export const F7 = round({ aggregation: agg(1), accessSwitches: [access('a1', 'sw-nbaset', 4, 'dt-x', 48), access('a2', 'sw-nbaset', 4, 'dt-x', 48)] });

// Level-shaped fixture used by content tests: teaching-valid (starts broken, reference passes,
// round 2 = round 1 reference + 20 added devices).
//   r1: a1 = 21 × dt-heavy, sw-1g, 1 uplink → down 8 400 / 10 000 = 84 % (fail).
//       reference 2 uplinks → 8 400 / 20 000 = 42 % (pass).
//   r2: a1 = 41 × dt-heavy, sw-1g, 2 uplinks → 16 400 / 20 000 = 82 % (fail).
//       reference 3 uplinks → 16 400 / 30 000 = 54.7 % (pass).
const MESSAGE_KEYS = ['rule', 'fits', 'fits-overprovisioned', 'device-port-unsupported', 'upgraded-non-bottleneck',
  'uplinks-maxed-need-class', 'undersized-class', 'over-capacity', 'no-change', 'unknown-switch',
  'class-not-allowed', 'uplinks-out-of-range', 'upgrade-not-allowed'];
export const MESSAGES = Object.fromEntries(MESSAGE_KEYS.map((k) => [k, `msg ${k} {switch}`]));

export function validDoc() {
  return {
    schemaVersion: 1,
    messages: { ...MESSAGES },
    sources: [
      { id: 'src-a', title: 'Source A', url: 'https://example.com/a', section: 'Section 1', claim: 'Claim A' },
    ],
    switchClasses: structuredClone(CLASSES),
    deviceTypes: structuredClone(DEVICES),
    levels: [
      {
        id: 'lvl-1', title: 'Link capacity', outcome: 'LO1', sourceIds: ['src-a'],
        briefing: {
          concept: 'Utilization = load ÷ capacity; stay at or below 80 %.',
          terms: ['uplink', 'utilization'],
          workedExample: { text: '10 devices × 500 Mbps = 5 000 Mbps on a 10 000 Mbps uplink → 50 %.' },
          simplifications: ['Traffic is steady.'],
        },
        rounds: [
          {
            id: 'r1', intro: 'Fix the overloaded uplink.',
            start: { aggregation: agg(1), accessSwitches: [access('a1', 'sw-1g', 1, 'dt-heavy', 21)] },
            addedSwitches: [], addedDevices: [],
            allowedUpgrades: ['uplinks'], claims: { uplinkOnly: true },
            hints: ['Compare each switch’s load to 80 % of its uplink capacity.', 'a1 needs 8 400 Mbps ≤ 0.8 × capacity.'],
            reference: { a1: { classId: 'sw-1g', activeUplinks: 2 } },
          },
          {
            id: 'r2', intro: 'This round starts from the previous reference design, with 20 more workstations.',
            start: { aggregation: agg(1), accessSwitches: [access('a1', 'sw-1g', 2, 'dt-heavy', 41)] },
            addedSwitches: [], addedDevices: [{ switchId: 'a1', deviceTypeId: 'dt-heavy', count: 20 }],
            allowedUpgrades: ['uplinks'], claims: { uplinkOnly: true },
            hints: ['Recompute the load with the new devices.', '41 × 400 = 16 400 Mbps.'],
            reference: { a1: { classId: 'sw-1g', activeUplinks: 3 } },
          },
        ],
      },
    ],
  };
}
