# Research: Capacity Flows — Survival Growth

**Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md) | Earlier decisions R1–R14:
[../001-capacity-flows-game/research.md](../001-capacity-flows-game/research.md) (still apply
unless replaced here).

## S1 · Fixed-step simulation

- **Decision**: A pure `step(state, scenario)` advances 0.25 s. The browser accumulates real
  time and runs as many whole steps as have elapsed (capped at 8 per frame so a stalled tab
  can't fast-forward), and auto-pauses when hidden. Purchases are applied between steps and
  logged with the simulation time.
- **Rationale**: Determinism (C5, FR-134): the same action log replays to the same score. It
  makes the 15 s rule and income testable without a browser clock (R14).
- **Order within a step** (a step covers simulation time [t, t + 0.25)): (1) apply events and
  waves with time ≤ t not yet applied; (2) evaluate the network; (3) countdown += 0.25 if
  spilling, else reset to 0; (4) t += 0.25; (5) if t is a whole second, add that second's income
  using this step's evaluation; (6) if the countdown ≥ 15.0, the game ends with score t.
  Example: an event at 20.0 s that causes spilling, never fixed → 60 spilling steps → the game
  ends at t = 35.0 s. A purchase made before a step is seen by that step's evaluation, so a
  last-moment fix saves the game (spec edge case).

## S2 · Economy tuning (model player)

- **Method**: a Python model of the same rules (scratch, not shipped) with an idle player and a
  greedy player who, 4 s after a switch starts spilling, buys the cheapest fix it can afford.
- **Results**:

| Income rule | Idle | Greedy | Notes |
| --- | --- | --- | --- |
| total downstream ÷ 1 000, 0 while spilling | 34.75 s | 344.75 s | 13 000+ spare credits late: no pressure |
| total ÷ 3 000, 0 while spilling | 34.75 s | stuck at 64 s | death spiral: no income while spilling |
| **delivered downstream ÷ 2 000 (chosen)** | **34.75 s** | **344.75 s** | 85 credits left after the Lobby fix at 64 s; real choices early |
| delivered ÷ 2 500 | 34.75 s | 134.75 s | too tight |

- **Decision**: income each whole second = floor(delivered ÷ 2 000), where delivered counts
  downstream demand of healthy access switches only (0 if aggregation spills). Start 100 credits.
  Prices: uplinks 40 / 80 / 200; classes 100 / 300 / 800.
- **Rationale**: Income from *delivered* traffic avoids the death spiral (healthy switches keep
  earning) and teaches that a spilling switch costs money. Over-provisioning early leaves no
  money for the Lobby at 60 s.

## S3 · Endless waves

- **Decision**: from 210 s, every 30 s: all demands ×1.10 (rounded, capped at port speed); each
  switch +2 laptops, +1 workstation, +1 camera within free ports; every 3rd wave a new switch if
  fewer than 4.
- **Rationale**: Deterministic, simple to hand-check, and guaranteed to exceed 2 × 100G
  aggregation eventually (model: 171 152 Mbps on 200 000 at 344 s), so every game ends (spec
  clarification). Capping at port speed keeps demand physically possible (C1).

## S4 · Concept notices pause play

- **Decision**: Timeline events can carry `concept` and `notice`. The first event with a given
  concept auto-pauses and shows its notice in the status area; the player resumes when ready.
- **Rationale**: C2 "a concept's first appearance pauses play and briefs it"; C3 fairness.

## S5 · What happens to 001 mechanics

- Rounds, levels, reference solutions, Submit and attempt counts are removed. The evaluator's
  per-switch computation (`computeComponents`) is reused unchanged, so 001's hand-computed
  boundary cases still guard the 80% rule.
- Worked solutions are removed (no single answer exists in an open-ended game); hints remain.
- The scenario file replaces `data/levels.json` with `data/scenario.json` (schema 2).

## S7 · Splitting a switch (FR-115)

- **Decision**: a split buys a same-class switch with 1 uplink for the class price; it takes
  floor(n ÷ 2) of each device type; up to 2 splits (`rules.maxSplits`); splits don't count
  toward `maxAccessSwitches`, so growth events can never be blocked by a player's split.
- **Rationale**: Splitting is the realistic answer when a switch's ports or uplinks are the
  constraint. Each half carries less load, while aggregation carries the same total, which
  keeps the 4:1 lesson. Rounding down for the new switch keeps the original's device mix intact;
  the ≥ 3-type check on both halves preserves FR-132. Two extra switches fit the diagram
  (6 access switches at most).
- **Hand-checked effect**: splitting the Studio at 0:01 (100 cr) leaves each half at 2 604 Mbps
  down; the 0:20 hires then take the original to 5 804 Mbps (58%), so nothing spills.

## S6 · Device mix

- **Decision**: add a "Render server" device type (10G port, ↑ 2 500 / ↓ 1 500 Mbps, hexagon) so
  the hexagon shape is used, and author every switch with at least 3 types. The validator checks
  the start, every authored switch, every event's result and the wave template.
