# Implementation Plan: Capacity Flows — Survival Growth

**Branch**: `master` | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md) | **Supersedes**: [001 plan](../001-capacity-flows-game/plan.md)

## Summary

Replace rounds and levels with one continuous game. A fixed-step simulation (0.25 s) grows the
network along an authored timeline, then endless waves. The player earns credits from delivered
traffic and spends them on uplinks and switch classes, pausing whenever they like. The game ends
after 15 s of continuous spilling; the score is survival time. The per-switch 80% / port rule,
diagram, action card, packet encoding and arrival queues from 001 are reused.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript ES2022 modules (unchanged)
**Primary Dependencies**: none
**Storage**: `data/scenario.json` (schema 2) replaces `data/levels.json`; session in memory
**Testing**: browser runner `tests/` (rules, scenario, sim suites); click-through drivers drive
`requestAnimationFrame` by hand (001 research R14)
**Target Platform**: current desktop browsers, static hosting
**Performance Goals**: a step under 1 ms with 4 switches; scenario validation under 100 ms;
the diagram re-renders only when the network changes, not every frame
**Constraints**: deterministic (C5); pause always reachable (C4); no backend (C5)
**Scale/Scope**: 1 aggregation + up to 4 access switches, 5 device types, ~7 authored events,
endless waves

## Constitution Check (v2.0.0)

| Principle | How the design complies | Status |
| --- | --- | --- |
| C1 Technical truth | Per-switch rule unchanged and still covered by 001's hand-computed cases; demand capped at port speed; economy labelled as game balance, not networking truth | Pass |
| C2 Every decision teaches | Live status names each spilling switch's cause with values; concepts introduced on the timeline with pausing notices (S4); hints method-first | Pass |
| C3 Scoring honest, pressure fair | Survival time on a deterministic clock; visible countdown; reset on fix; pause anytime and auto-pause when hidden; every price and income rule in data and shown on screen; hints reported separately | Pass |
| C4 Access | Pause on a button and the P key; all purchases keyboard-operable; text table and status; reduced-motion static view | Pass (manual playthrough still required) |
| C5 Deterministic | Fixed steps, authored timeline, formula waves; an action log replays to the same score (test) | Pass |
| C6 Content vs logic | Prices, economy, timeline, waves, notices and hints in `data/scenario.json`, validated; `sim.js` pure (no DOM) | Pass |
| C7 Done is demonstrated | Tests and drivers plus README verification; 001 marked superseded; root docs synced | Pass |

## Project Structure

```text
data/scenario.json      Catalog with prices and shapes, economy, rules, start, briefing, timeline, waves, hints, messages, sources
engine/
  rules.js              Per-switch evaluation (unchanged; computeComponents)
  sim.js                createGame, step, buy, priceOf, waves, result: pure, no DOM
  content.js            validateScenario(doc): structure, ≥ 3 device types everywhere, timeline order, prices
  feedback.js           Live problem descriptions and fix confirmations from messages + values
main.js                 Load → validate → briefing → fixed-step loop → render on change
ui/
  render.js             Network view (reuses 001 renderer), HUD, notices, game-over summary
  controls.js           Action card with prices and shortfall; switch list with quick actions
  flow.js, shapes.js    Packets and queues (unchanged encoding)
tests/
  rules.test.js         001 evaluator cases (fixtures only)
  content.test.js       Scenario validation cases
  sim.test.js           Hand-computed simulation cases
```

Removed: `engine/state.js` (rounds), `data/levels.json`.

## Implementation Slices

| Slice | Deliverable | Evidence |
| --- | --- | --- |
| 1 · Simulation | `sim.js` and `scenario.json` with hand-computed tests | idle = 35.0 s; reset on fix; income; prices; waves; determinism |
| 2 · Playable loop | HUD, pause, purchases via the card, live status, game over | Driver: start, spill, pause, buy, survive past 35 s, lose, summary |
| 3 · Growth and help | Notices that pause, recent-arrival queues, hints, restart | Driver: notices at 60 s and 120 s; hint counted; restart cancel/confirm |
| 4 · Docs | README, quickstart, verification | Recorded results |
