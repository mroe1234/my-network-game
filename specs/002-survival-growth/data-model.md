# Data Model: Capacity Flows — Survival Growth

All bandwidth is integer Mbps; all times are simulation seconds (multiples of 0.25). Entities
not listed (Source, Topology, DeviceGroup, ComponentResult) are as in
[001 data-model](../001-capacity-flows-game/data-model.md).

## Scenario (`data/scenario.json`, schemaVersion 2)

| Field | Rules |
| --- | --- |
| switchClasses[] | 001 fields plus `price` (int > 0) and `uplinkPrice` (int > 0); exactly 3 |
| deviceTypes[] | 001 fields plus `shape` (circle / triangle / hexagon / square / diamond) |
| economy | `startCredits` (int ≥ 0), `mbpsPerCredit` (int > 0) |
| rules | `stepSeconds` = 0.25, `spillLimitSeconds` (int > 0), `maxAccessSwitches` (1–4; scripted and wave growth only), `minDeviceTypesPerSwitch` (≥ 3), `maxSplits` (0–2) |
| briefing | concept, terms[], workedExample.text, simplifications[], sourceIds[] (≥ 1) |
| start | Topology; every access switch has ≥ `minDeviceTypesPerSwitch` types |
| timeline[] | TimelineEvent, strictly ascending `at` |
| waves | `startAt` (> last event), `every` (> 0), `growthPct` (> 0), `addPerSwitch[]` {deviceTypeId, count}, `newSwitchEvery` (int > 0), `newSwitchTemplate` (access switch with ≥ min types; label may contain `{n}`) |
| hints | `method` (text), `capacity`, `port`, `aggregation` (text with {placeholders}) |
| messages | `status-capacity`, `status-port`, `status-aggregation`, `fixed`, `game-over-capacity`, `game-over-port`, `game-over-aggregation` |

### TimelineEvent

| Field | Rules |
| --- | --- |
| id, title | strings, id unique |
| at | multiple of 0.25, > 0 |
| concept | optional; `port-speed` or `aggregation`; the first event with each concept pauses play |
| notice | required when `concept` is set; text |
| sourceIds | optional; each resolves |
| addSwitches[] | access switches (unique new ids); total switches ≤ max |
| addDevices[] | {switchId, deviceTypeId, count}; switch exists by then; total ports ≤ 48 |
| demand[] | {deviceTypeId, upMbps, downMbps}; each ≤ the type's port speed |

The validator replays the timeline to check port limits, switch counts and the ≥ 3-type rule
after every event.

## Game (simulation state, `engine/sim.js`)

| Field | Meaning |
| --- | --- |
| status | `briefing` / `running` / `paused` / `ended` |
| t | simulation time |
| network | current Topology (aggregation + access switches with device groups); a switch made by splitting has `splitFrom` = the original's id |
| deviceTypes | current demands (start from scenario; changed by events and waves) |
| credits, earned, spent | integers; credits = start + earned − spent ≥ 0 |
| spill | countdown seconds (0 … 15) |
| eventIndex, waveCount, nextWaveAt | growth progress |
| conceptsSeen | concepts already introduced (for pausing notices) |
| notice | the current pausing notice, or null |
| recent | arrivals from the latest event or wave {switchId → deviceTypeId → count}, `until` = time + 10 s |
| log | purchases {t, switchId, from, to, cost} and events {t, id} |
| hintsUsed | count |
| version | increments on any change to network, demand or credits; drives re-rendering |
| result | on end: {score: t, cause: ComponentResult of the worst spilling switch, totals} |

### Transitions

```text
briefing --start--> running <--pause/resume--> paused
running --notice event--> paused (notice shown) --resume--> running
running --spill reaches limit--> ended
any --restart(confirm)--> briefing (new game)
```
