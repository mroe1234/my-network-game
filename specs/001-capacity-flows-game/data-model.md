# Data Model: Capacity Flows — First Playable

**Date**: 2026-11-17 | Source of truth for content shape: [contracts/level-data.md](./contracts/level-data.md)

All bandwidth values are integer **Mbps** (research R3). IDs are lowercase kebab-case and unique
within their collection.

## Authored content (from `data/levels.json`)

### Source
| Field | Type | Rules |
| --- | --- | --- |
| id | string | unique |
| title, url, section, claim | string | all required, non-empty; `url` is https |

### SwitchClass (global, exactly 3 — FR-002)
| Field | Type | Rules |
| --- | --- | --- |
| id | `"sw-1g"` \| `"sw-nbaset"` \| `"sw-25g"` | unique |
| label | string | e.g. "1G access (4×10G uplinks)" |
| maxPortMbps | int | 1 000 / 10 000 / 25 000 (R5) |
| devicePorts | int | 48 |
| uplinkMbps | int | 10 000 / 25 000 / 100 000 |
| maxUplinks | int | 4 / 4 / 2 |
| roles | `("access"\|"aggregation")[]` | 25G class only may include `aggregation` (R6) |

### DeviceType (global, shared by every round — FR-003)
| Field | Type | Rules |
| --- | --- | --- |
| id, label | string | unique id |
| portMbps | int | > 0 |
| upMbps | int | upstream (ingress → core) per device; 0 < upMbps ≤ portMbps |
| downMbps | int | downstream (egress → device) per device; 0 < downMbps ≤ portMbps |
| shape | `"circle"` \| `"triangle"` \| `"hexagon"` \| `"square"` \| `"diamond"` | packet/queue glyph: circle = access point, triangle = desktop/workstation, hexagon = server, square = laptop, diamond = camera |

### Level
| Field | Type | Rules |
| --- | --- | --- |
| id, title | string | three levels, in order: link capacity → device sizing → growth (FR-015) |
| outcome | `"LO1"` \| `"LO2"` | |
| briefing | { concept, terms[], workedExample, simplifications[] } | worked example must not equal any round's start (FR-008) |
| sourceIds | string[] | ≥ 1, each resolves to a Source (FR-028) |
| rounds | Round[] | exactly 2 |

### Round
| Field | Type | Rules |
| --- | --- | --- |
| id | string | unique across all levels |
| intro | string | non-empty; for rounds after the first, tells the player the start is the previous reference design (FR-014). Checked by human content review (T036), not by the validator |
| allowedUpgrades | `("uplinks"\|"replace")[]` | non-empty; Level 1 rounds exactly `["uplinks"]`; Levels 2–3 `["uplinks","replace"]` (FR-010) |
| start | Topology | must have ≥ 1 violation (R7) |
| addedDevices | { switchId, deviceTypeId, count ≥ 1 }[] | devices added this round to an existing or newly added access switch; `switchId` must resolve |
| addedSwitches | AccessSwitch[] (shape as in Topology.accessSwitches) | access switches new this round, possibly empty; ids unique; total access switches ≤ 3 |
| claims | { uplinkOnly?: bool, requiresClassChange?: bool } | verified by exhaustive search (R9) |
| hints | [method, workedStep] | exactly 2, in that order (FR-019) |
| reference | Design | must pass; uses only Round.allowedUpgrades; used as worked solution and next round's base |

### Topology
- `aggregation`: { id, classId (must have role `aggregation`), activeUplinks (1..maxUplinks) }
- `accessSwitches`: 1–3 × { id, label, classId (role `access`), activeUplinks, deviceGroups[] }
- `core`: fixed, no fields graded (FR-001)
- **DeviceGroup**: { deviceTypeId, count ≥ 1 }; total count per access switch ≤ `devicePorts`
  (else content error — R5)

**Cross-round rule (validated)**: `round[n].start` = `round[n-1].reference` applied to
`round[n-1].start`, plus `round[n].addedSwitches`, plus `round[n].addedDevices`. No other
difference is allowed. The first round of the first level has empty `addedSwitches` and
`addedDevices`.

## Player input

### Design (Submission)
`{ [switchId]: { classId, activeUplinks } }` — only entries for changed switches; omitted switches
keep the committed value. Valid only if every id exists, `classId` is allowed for that switch's
role, and `1 ≤ activeUplinks ≤ class.maxUplinks`. A design that changes nothing is
`invalid-input` (FR-018).

## Derived (computed by the evaluator, never authored)

### ComponentResult (one per access switch and one for aggregation)
| Field | Meaning |
| --- | --- |
| switchId, classId, activeUplinks | as evaluated |
| upMbps, downMbps | Σ demand behind the switch, per direction |
| capacityMbps | activeUplinks × uplinkMbps |
| gradedDirection | `"up"` \| `"down"` — the busier one |
| utilizationPct | for display (1 dp) |
| ok | `max(up,down) × 100 ≤ 80 × capacity` |
| portIssues | device types whose `portMbps` > class `maxPortMbps` (access only) |
| perUplinkMbps | { up, down } ÷ activeUplinks — shown on each link (R4) |
| changed, wasViolating | vs. round start; drive efficiency notes (FR-005) |

### EvaluationResult — see [contracts/evaluator.md](./contracts/evaluator.md)

### SessionState
| Field | Meaning |
| --- | --- |
| view | `loading` \| `content-error` \| `briefing` \| `round` \| `level-summary` \| `session-summary` |
| levelIndex, roundIndex | position |
| committedDesign | design shown in ambient flow (R8) |
| pendingDesign | player's unsubmitted selections |
| perRound[roundId] | { attempts, hintsViewed (0–2), solutionViewed, completed, lastResult } |

### State transitions
```text
loading ──valid──▶ briefing ──Start──▶ round
loading ──invalid──▶ content-error ──Retry──▶ loading
round ──Submit(invalid-input)──▶ round (guidance; attempts unchanged)
round ──Submit(incorrect)──▶ round (attempts+1; committed = submitted; retry)
round ──Submit(correct)──▶ round[solved] (attempts+1; Submit disabled; Next enabled)
round[solved] ──Submit──▶ no-op
round[solved] ──Next──▶ next round | briefing (new level) | level-summary → session-summary
any ──Restart(confirm)──▶ briefing (level 1), all progress cleared; cancel → unchanged
Hint / Solution ──▶ assistance recorded; attempts unchanged
```
