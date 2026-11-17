---
description: "Task list for Capacity Flows — Survival Growth"
---

# Tasks: Capacity Flows — Survival Growth

**Input**: `specs/002-survival-growth/` (spec, plan, research, data-model, contracts)

**Tests**: Required (constitution C1, C3, C7; SC-101–SC-103). Expected values are computed by
hand in comments, never by calling the code under test.

## Phase 1: Simulation core (blocks everything)

- [X] T101 Author `data/scenario.json` (schema 2) per data-model.md › Scenario: classes with `price` / `uplinkPrice`, 5 device types with `shape` (adds Render server, hexagon), economy, rules, briefing, start (Studio, Office: ≥ 3 types each), timeline (20, 45, 60 port-speed notice, 90, 120 aggregation notice, 150, 180), waves, hints, messages, sources (research S2, S3, S6)
- [X] T102 [P] Write hand-computed simulation tests in `tests/sim.test.js` per contracts/simulation.md › Required cases
- [X] T103 Implement `engine/sim.js` per contracts/simulation.md (step order research S1; pricing; waves; concept pauses; recent arrivals; result); make T102 pass
- [X] T104 [P] Write scenario-validation tests in `tests/content.test.js`: one broken fixture per rule in contracts/scenario-data.md, including each ≥ 3-device-type case; shipped file validates in < 100 ms
- [X] T105 Replace `engine/content.js` with `validateScenario` per contracts/scenario-data.md (replays the timeline); make T104 pass
- [X] T106 Retire round-based code: delete `engine/state.js`, `tests/state.test.js`, `data/levels.json`; keep the fixture-based evaluator tests in `tests/rules.test.js`, drop its shipped-level cases

## Phase 2: Playable loop (US1, P1)

- [X] T107 [US1] `index.html` / `style.css`: HUD (survival time, credits with income, spill countdown, Pause button), status panel, notice area, switch list; remove Submit / Next / solution
- [X] T108 [US1] `main.js`: load and validate `data/scenario.json`; briefing → Start; fixed-step loop on `requestAnimationFrame` (≤ 8 steps per frame); P key; auto-pause on `visibilitychange`; re-render the network only when `game.version` changes
- [X] T109 [US1] `engine/feedback.js`: live problem lines per spilling switch (capacity per direction, port, aggregation) and "fixed" lines, from scenario messages and values (FR-105, C2)
- [X] T110 [US1] `ui/controls.js`: action card buys instantly with price on every action, a shortfall when unaffordable, and class replacement via picker + Buy button; switch list with "+ uplink (price)" quick actions (FR-111, FR-112, FR-122)
- [X] T111 [US1] `ui/render.js`: network view from game state (reuses 001 renderer, flow and queues; "new" = arrivals from the latest event or wave), HUD rendering, game-over summary (FR-104, FR-141)

## Phase 3: Growth and help (US2, US3)

- [X] T112 [US2] Concept notices: pause on the first event with each concept and show its notice and sources; event log of recent events (FR-133)
- [X] T113 [US3] Hint button (method, then worst switch and kind of fix), counted; Restart with confirmation; best time this session (FR-140, FR-142)

## Phase 4: Verification and docs

- [X] T114 Rewrite the click-through drivers (scratch, not shipped) to drive frames by hand: idle loss at 35.0 s, pause stops the clock, buy-while-spilling resets the countdown, notices pause at 60 s and 120 s, hint counted, summary, restart cancel/confirm, reduced motion
- [X] T115 Update `README.md`, root `SPEC.md` / `PLAN.md`, and `specs/002-survival-growth/quickstart.md`; record verification results (C7)

## Change request (2026-11-17)

- [X] T116 [US1] Split a switch: `splitPriceOf` / `splitSwitch` in `engine/sim.js`, `rules.maxSplits` in `data/scenario.json` and `engine/content.js`, a Split button with price and reason in the action card (`ui/controls.js`), hand-computed tests in `tests/sim.test.js` (FR-115, research S7)

## Dependencies

T101 → T102/T104 → T103/T105 → T106 → Phase 2 (T107 → T108; T109–T111 in parallel) → Phase 3 → Phase 4.
