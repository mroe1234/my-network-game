// Scenario validation tests — contracts/scenario-data.md. Each case breaks one rule in a copy of
// the shipped scenario and expects a specific error.
import { test, assert, assertEqual, loadJSON } from './harness.js';
import { validateScenario } from '../engine/content.js';

const shipped = async () => loadJSON('../data/scenario.json');
async function expectError(mutate, match, eventId) {
  const doc = await shipped();
  mutate(doc);
  const res = validateScenario(doc);
  assertEqual(res.ok, false, 'should be rejected');
  const hit = res.errors.find((e) => match.test(`${e.path} ${e.message}`) && (eventId === undefined || e.eventId === eventId));
  assert(hit, `expected ${match}${eventId ? ` for ${eventId}` : ''}; got ${JSON.stringify(res.errors)}`);
}
const sw = (doc, id) => doc.start.accessSwitches.find((s) => s.id === id);
const ev = (doc, id) => doc.timeline.find((e) => e.id === id);

test('scenario/shipped file validates in under 100 ms', async () => {
  const doc = await shipped();
  const t0 = performance.now();
  const res = validateScenario(doc);
  const ms = performance.now() - t0;
  assert(res.ok, JSON.stringify(res.errors));
  assert(ms < 100, `${ms.toFixed(1)} ms`);
});

// 1 · structure
test('scenario/schemaVersion must be 2', () => expectError((d) => { d.schemaVersion = 1; }, /schemaVersion/));
test('scenario/duplicate device type id', () => expectError((d) => { d.deviceTypes[1].id = d.deviceTypes[0].id; }, /duplicate/));
test('scenario/dangling source in briefing', () => expectError((d) => { d.briefing.sourceIds = ['nope']; }, /unknown source/));
test('scenario/dangling class at start', () => expectError((d) => { sw(d, 'studio').classId = 'sw-x'; }, /unknown switch class/));
test('scenario/event adds devices to a switch that does not exist yet', () =>
  expectError((d) => { ev(d, 'render-servers').addDevices[0].switchId = 'east-wing'; }, /unknown access switch "east-wing" at this time/, 'render-servers'));

// 2 · catalog
test('scenario/exactly 3 switch classes', () => expectError((d) => { d.switchClasses.pop(); }, /exactly 3/));
test('scenario/prices must be positive', () => expectError((d) => { d.switchClasses[0].uplinkPrice = 0; }, /uplinkPrice/));
test('scenario/unknown shape', () => expectError((d) => { d.deviceTypes[0].shape = 'star'; }, /deviceTypes\[0\]\.shape/));
test('scenario/demand above port speed', () => expectError((d) => { d.deviceTypes[0].downMbps = d.deviceTypes[0].portMbps + 1; }, /downMbps/));
test('scenario/event demand above port speed', () =>
  expectError((d) => { ev(d, 'video-calls').demand[0].downMbps = 1001; }, /must not exceed the 1000 Mbps port/, 'video-calls'));

// 3 · device mix (FR-132)
test('scenario/start switch with only 2 device types', () =>
  expectError((d) => { sw(d, 'studio').deviceGroups.pop(); }, /at least 3 different device types/));
test('scenario/event-added switch with only 2 device types', () =>
  expectError((d) => { ev(d, 'lobby-opens').addSwitches[0].deviceGroups.pop(); }, /at least 3 different device types/, 'lobby-opens'));
test('scenario/wave template with only 2 device types', () =>
  expectError((d) => { d.waves.newSwitchTemplate.deviceGroups.pop(); }, /newSwitchTemplate.*at least 3/));
test('scenario/maxSplits out of range', () => expectError((d) => { d.rules.maxSplits = 3; }, /maxSplits/));
test('scenario/minDeviceTypesPerSwitch below 3 is rejected', () =>
  expectError((d) => { d.rules.minDeviceTypesPerSwitch = 2; }, /at least 3/));

// 4 · growth
test('scenario/event times must ascend', () =>
  expectError((d) => { ev(d, 'video-calls').at = 15; }, /strictly ascending/, 'video-calls'));
test('scenario/event time must be a multiple of 0.25 s', () =>
  expectError((d) => { ev(d, 'studio-hires').at = 20.1; }, /multiple of 0.25/, 'studio-hires'));
test('scenario/too many devices after an event (ports)', () =>
  expectError((d) => { ev(d, 'office-wifi').addDevices[0].count = 5; }, /office would have 49 devices on 48 ports/, 'office-wifi'));
test('scenario/too many access switches', () =>
  expectError((d) => {
    const extra = structuredClone(ev(d, 'east-wing').addSwitches[0]);
    extra.id = 'west-wing';
    ev(d, 'east-wing').addSwitches.push(extra);
  }, /more than 4 access switches/, 'east-wing'));
test('scenario/concept event needs a notice', () =>
  expectError((d) => { delete ev(d, 'atrium').notice; }, /needs a notice/, 'atrium'));
test('scenario/waves must start after the last event', () =>
  expectError((d) => { d.waves.startAt = 150; }, /startAt/));

// 5 · text
test('scenario/missing hint', () => expectError((d) => { delete d.hints.port; }, /hints\.port/));
test('scenario/missing message', () => expectError((d) => { delete d.messages.fixed; }, /messages\.fixed/));
