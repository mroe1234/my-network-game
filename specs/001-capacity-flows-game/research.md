# Research: Capacity Flows — First Playable

**Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md) | **Plan**: [plan.md](./plan.md)

Each item below records a decision, why it was made, and what else was considered.

## R1 · Source for the oversubscription ratios

- **Decision**: Cite Cisco's *Campus Network for High Availability Design Guide*
  (https://www.cisco.com/en/US/docs/solutions/Enterprise/Campus/HA_campus_DG/hacampusdg.html)
  for the planning rule of thumb. Its oversubscription section gives ≈20:1 access → distribution
  and ≈4:1 distribution → core. The briefing presents these as planning rules of thumb, not as
  the grading rule (spec FR-007).
- **Resolved (user, 2026-11-17)**: the briefing teaches ≈4:1 aggregation (distribution) →
  core, matching the cited guidance. SPEC.md's earlier ≈3:1 "switch to aggregation" figure is
  retired; root SPEC.md is synced in task T005.
- **Verification status**: the ratios are confirmed from secondary summaries (Cisco Live
  BRKCRS-2031 write-up; Cisco Community answers). The primary section text has not yet been read.
  Record the exact section heading when the briefing is authored. Newer Cisco material
  (*Enterprise Campus Infrastructure Best Practices Guide*, 2014, "Campus Network
  Oversubscription Best Practices") may serve as a more current source.
- **Alternatives considered**: deriving demand from the ratio (port speed ÷ 20). Rejected in
  clarification Q3: with realistic numbers a 48-port 1G switch is only 2.4G and never stresses a
  10G uplink.

## R2 · Source for the switch classes

- **Decision**: Cite the *Cisco Catalyst 9300 Series Switches Data Sheet*
  (https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html),
  network module and uplink tables, for the general claim that access switches of this family
  offer 10G, 25G, and 100G uplink options. The three switch classes are **generic** and
  deliberately not mapped one-to-one to SKUs; the README and briefing say so (FR-027).
- **Rationale**: Search results show module/uplink options vary by model and datasheet
  revision. Mapping to exact SKUs would invite technically incorrect details.
- **Alternatives considered**: naming real SKUs per class. Rejected as brittle and vendor-specific.

## R3 · Arithmetic and the 80% boundary

- **Decision**: All bandwidth values are stored and computed as **integer Mbps**. A component
  passes when `load_mbps × 100 ≤ 80 × capacity_mbps`. Utilization percentages are computed only
  for display, rounded to one decimal place.
- **Rationale**: Exactly-80% is a required boundary case (SC-002). Floating-point division
  (e.g., 0.8 × 30 000) can misclassify it.
- **Alternatives considered**: floats with an epsilon. Rejected because the outcome then depends
  on tolerance choice.

## R4 · Link vs. switch utilization under even sharing

- **Finding**: With traffic shared evenly across active uplinks (clarification Q2), each uplink's
  utilization equals the switch's utilization: `(L ÷ n) ÷ s = L ÷ (n × s)`.
- **Decision**: The evaluator computes one **uplink group** check per switch per direction and
  reports it both as the switch result and as each uplink's result. SC-003 and SC-004 are
  therefore satisfied together. The device-sizing lesson (LO2) gets its own check in R5.
- **Alternatives considered**: unequal hashing across uplinks. Rejected: not deterministic from
  the shown values, and excluded (link-aggregation behaviour).

## R5 · What makes switch class matter beyond uplink speed

- **Decision**: Each switch class has a **maximum access-port speed**. 1G class: 1G.
  nbase-t class: 10G (multigigabit). 25G class: 25G. A device type whose port speed exceeds the
  access switch's maximum port speed makes the design **incorrect** with reason
  `device-port-unsupported`. This gives growth rounds a real class decision (e.g., Wi-Fi APs
  with 5G ports) and backs SC-004's "growth rounds require a switch-class decision".
- **Rationale**: Matches the spec's "device type sizing" outcome. It is checkable from values
  shown on screen.
- **Also decided**: each access switch has 48 device ports. A round whose device count exceeds
  this is a **content error**, not a player error, because the player cannot add switches in v1.
  Aggregation downlink ports are assumed to match any access uplink speed. This is listed as a
  simplification in the README.

## R6 · Which switch classes can sit in which tier

- **Decision**: Access slots accept all three classes. The aggregation slot accepts only the 25G
  class (2×100G uplinks), so aggregation decisions are uplink count (1–2). The core is fixed and
  ungraded (clarification Q5).
- **Rationale**: Keeps the topology to a single aggregation switch and one to three access
  switches, which fits six rounds in 5–10 minutes. A 1G-class aggregation switch would be
  technically absurd.

## R7 · Starting design for each round

- **Decision** (user, 2026-11-17): each round's starting design is authored as the previous
  round's reference solution plus added devices. The content validator checks this relationship
  and checks that the start has at least one violation (FR-014).
- **Rationale**: Prevents a "max everything in round 1" strategy, since cost is excluded. Every
  round stays independently testable.

## R8 · What the ambient flow and on-screen numbers reflect

- **Decision**: Ambient packet flow, utilization numbers, and spill markers always reflect the
  **committed design**: the round's start, or the last submitted design. Pending selections
  appear as "planned" changes (new class / uplink count shown) **without** recomputed
  utilization.
- **Rationale**: LO1 asks the player to *calculate* predicted load. Live recomputation would let
  the player find the answer by trial and error with no attempt recorded, which conflicts with
  C3's honest attempt counts. All inputs needed to calculate (demands, counts, capacities) stay
  visible (C2).
- **Alternatives considered**: live preview. Rejected for the reason above. It could be offered
  later as a hint level, recorded as assistance.

## R9 · Content validation by exhaustive search

- **Decision**: The content validator enumerates every possible design for each round. Each
  access switch has up to 3 classes × up to 4 uplinks, and the aggregation switch 1–2 uplinks,
  so with ≤ 3 access switches the space is ≤ 2 000 designs. The validator checks: start fails;
  reference solution passes; level-specific claims hold (`requiresClassChange` → no
  uplink-count-only design passes; `uplinkOnly` → some uplink-count-only design passes).
- **Rationale**: Turns the authored claims behind SC-004 and the learning sequence into checks
  (C1, C6). It is fast enough to run on load.
- **Alternatives considered**: hand-assert only. Rejected: content claims could silently drift.

## R10 · Stack, serving, and tests

- **Decision**: As in the project PLAN.md: semantic HTML, CSS, native JavaScript ES modules, SVG
  for the topology, `data/levels.json`, static hosting, and a dependency-free browser test runner
  at `tests/index.html`. No framework, bundler, or rendering library.
- **Rationale**: C5 (self-contained) and the 60-minute build budget.
- **Packet animation**: CSS/SVG animation driven by `requestAnimationFrame`. It is disabled under
  `prefers-reduced-motion: reduce`, where a static before/after utilization view is shown instead
  (FR-025).
