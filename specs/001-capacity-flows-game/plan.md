# Implementation Plan: Capacity Flows — First Playable

**Branch**: `001-capacity-flows-game` (working on `master`) | **Date**: 2026-11-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-capacity-flows-game/spec.md`, the project
[PLAN.md](../../PLAN.md) (stack, file layout, slices), and constitution v1.0.1.

## Summary

A static browser game. The player keeps packets flowing through a small three-tier campus network
by adding uplinks and replacing access/aggregation switches, so that no switch or uplink exceeds
80% utilization in its busier direction and every device's port speed is supported. Packets
animate continuously over the **committed** design, but only Submit grades. Grading is a pure,
integer-arithmetic evaluator over authored level data. The level data is checked on load by a
validator that searches every possible design per round. Six rounds follow the sequence link
capacity → device sizing → organic growth. Each round starts from the previous reference design
plus new devices.

## Technical Context

**Language/Version**: HTML5, CSS3, JavaScript (ES2022, native ES modules)

**Primary Dependencies**: none (no framework, bundler, or rendering library)

**Storage**: authored content in `data/levels.json`; session state in memory only

**Testing**: dependency-free browser test runner at `tests/index.html` (rules, content, state
suites), plus the manual checks in [quickstart.md](./quickstart.md)

**Target Platform**: current desktop browsers; static hosting (including a GitHub Pages subpath)

**Project Type**: single-page static web game

**Performance Goals**: content validation (≤ ~2 000 designs per round × 6) under 100 ms on load;
ambient animation at display refresh rate, never blocking input

**Constraints**: no backend, account, AI, or API key (C5); works at 360 px width; keyboard-only;
`prefers-reduced-motion`; 60-minute workshop build

**Scale/Scope**: 3 levels × 2 rounds; 1 aggregation switch + 1–3 access switches per round;
3 switch classes; about 4 device types

All Technical Context unknowns are resolved; see [research.md](./research.md).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-checked after Phase 1 design.*

| Principle | How the design complies | Status |
| --- | --- | --- |
| C1 Technical truth | Integer Mbps with an exact 80% boundary (R3); rules documented in the spec's Technical Model; content validator rejects ambiguous or contradictory rounds (R9); sources identified (R1, R2) | Pass (ratio settled as ≈4:1 on 2026-11-17; exact source section recorded in T005) |
| C2 Teaches through a decision | Only action is a design choice; values for calculation shown; reasonCode-specific explanations ([evaluator](./contracts/evaluator.md)); hints are method then worked step; worked solution recorded as assistance | Pass |
| C3 Honest progress | Invalid input does not count; Submit disabled and guarded after success; ambient flow never scores (FR-011); on-screen numbers reflect committed design only (R8); separate attempts/assistance/completion | Pass |
| C4 Access | Native controls, focus moves on view change, live-region feedback, text topology table, reduced-motion static view, scroll container | Pass (verified manually, quickstart V5) |
| C5 Deterministic, self-contained | Static files only; pure evaluator; authored, non-random growth | Pass |
| C6 Content vs logic | All content in `data/levels.json`; `rules.js` has no DOM or state; reference solution validated against the evaluator, never overriding it | Pass |
| C7 Done is demonstrated | Test runner and quickstart checks with recorded pass/fail/not run; spec updated in step with plan decisions (FR-004a, FR-014) | Pass |

**Post-design re-check (after Phase 1)**: no new violations. Two planning decisions changed the
spec, and both are recorded there: FR-014 (authored start per round, user decision) and FR-004a
(device-port-speed rule, R5).

## Project Structure

### Documentation (this feature)

```text
specs/001-capacity-flows-game/
├── plan.md              # This file
├── research.md          # Phase 0 decisions R1–R10
├── data-model.md        # Entities, derived values, state transitions
├── quickstart.md        # Run + validation guide (V1–V7)
├── contracts/
│   ├── evaluator.md     # evaluate() contract, reason codes, required cases
│   └── level-data.md    # levels.json shape + validation rules
├── checklists/requirements.md
└── tasks.md             # Phase 2 (/speckit-tasks — not created here)
```

### Source Code (repository root)

```text
index.html               Semantic shell, module entry
style.css                Layout, focus, pass/fail states, reduced motion, narrow layout
main.js                  Load → validate → start; loading and content-error screens
engine/
  rules.js               Pure evaluate() — contracts/evaluator.md
  content.js             validateContent() incl. exhaustive search — contracts/level-data.md
  state.js               Session transitions, attempts, assistance, restart
  feedback.js            EvaluationResult → explanation text (wording from data + values)
ui/
  render.js              Briefing, round (SVG topology + text table), feedback, summaries
  flow.js                Ambient packet animation over committed design; static view if reduced motion
  controls.js            Upgrade selectors, Submit/Hint/Solution/Next/Restart, focus management
data/
  levels.json            Sources, switch classes, device types, 3 levels × 2 rounds
tests/
  index.html             Runner with totals and failed IDs; zero tests = failure
  rules.test.js          Hand-computed cases per round + per reasonCode
  content.test.js        One broken fixture per rejection rule; shipped file validates
  state.test.js          Transition and counting rules
README.md                Run, simplifications/exclusions, sources, verification log
```

**Structure Decision**: single static project at the repository root, following the project
PLAN.md layout, plus `ui/flow.js` to keep animation separate from grading and rendering.

## Implementation Slices

| Slice | Deliverable | Evidence before next slice |
| --- | --- | --- |
| 1 · Prove the rule | `rules.js` + `rules.test.js` with hand-computed cases | All rules cases pass, including exactly-80% and +1 Mbps |
| 2 · Complete one round | Level 1 round 1 data, validator core, state, render, feedback | Quickstart V2 passes in the browser |
| 3 · Add the curriculum | All 6 rounds, exhaustive-search validation, hints, solution, summaries | content + state suites pass; V3, V4 |
| 4 · Make it usable | Flow polish (minimal flow ships in slice 2), reduced motion, keyboard/focus, narrow layout, error states | V5 recorded |
| 5 · Package | README (simplifications, sources, verification log) | V6, V7 recorded; fresh-start playthrough |

## Open Items

1. **Root docs sync**: record the exact source section for ≈20:1 / ≈4:1, and sync root SPEC.md
   and PLAN.md with these feature docs (task T005, C7).
2. **Content numbers**: device-type demands must create real bottlenecks (R1 note). Pick
   plausible high-demand types (e.g., video workstation, multigigabit Wi-Fi AP) and state in the
   briefing that the values are illustrative.

## Complexity Tracking

No constitution violations to justify.
