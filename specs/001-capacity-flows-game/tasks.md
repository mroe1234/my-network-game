---

description: "Task list for Capacity Flows — First Playable"
---

# Tasks: Capacity Flows — First Playable

**Input**: Design documents from `specs/001-capacity-flows-game/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/evaluator.md,
contracts/level-data.md, quickstart.md

**Tests**: Required. Constitution C1/C7, SC-002 and the plan's slice 1 ("prove the rule") mandate
hand-computed expected results recorded independently of the evaluator. Expected values in tests
MUST be written by hand from the spec. Never generate them by calling `evaluate`.

**Organization**: Grouped by user story so that each story is independently testable. All paths
are relative to the repository root (single static project, see plan.md "Project Structure").

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on incomplete tasks)
- **[Story]**: US1 / US2 / US3 from spec.md

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create the static project skeleton and the test runner.

- [X] T001 Create directories `engine/`, `ui/`, `data/`, `tests/` and empty module files listed in plan.md "Source Code" at the repository root
- [X] T002 [P] Create semantic page shell in `index.html`: header, `<main>` with briefing/round/summary regions, a labeled scroll container for the topology, an `aria-live="polite"` feedback region, and `<script type="module" src="main.js">` (relative paths only)
- [X] T003 [P] Create base styles in `style.css`: CSS custom properties, visible `:focus-visible` outline, pass/fail states that also carry a text label, `@media (prefers-reduced-motion: reduce)` hook, and a layout at 360 px width where action buttons stay outside the scrolling topology container
- [X] T004 [P] Implement the dependency-free test runner in `tests/index.html` plus `tests/harness.js` (`test(id, fn)`, `assertEqual`, `assertDeep`): imports `rules.test.js`, `content.test.js`, `state.test.js`; renders total/passed/failed and failed case IDs; reports **zero discovered tests as failure** (quickstart V1)

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The domain rule, the shared catalog and the content-loading path that every story needs.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [X] T005 Confirm research.md R1 sources: open the Cisco HA campus design guide and record the exact section heading that gives ≈20:1 (access → distribution) and ≈4:1 (distribution → core) in spec.md "Technical Model". Then sync root `SPEC.md` with the clarified decisions: all entries in spec.md › Clarifications, the ≈4:1 aggregation → core ratio, FR-004a port speeds, the FR-014 starting-network rule, "Excluded behavior" and "Authoritative references". Fill the root `PLAN.md` placeholders: `[GAME NAME]` → Capacity Flows; `[EXPLICIT DOMAIN ALGORITHM]` → a link to `specs/001-capacity-flows-game/contracts/evaluator.md`; `[VISUAL METAPHOR FROM SPEC]` → packets flowing through a three-tier topology; `[SPECIFIC DOMAIN-RELEVANT EFFECT]` → packets spilling at a component over 80%; feedback example → the `upgraded-non-bottleneck` case (C1, C7). This blocks briefing text in T015, T024 and T025, not code
- [X] T006 Author the global catalog in `data/levels.json`: `schemaVersion: 1`, `sources` (Source.id, Source.title, Source.url, Source.section, Source.claim per data-model.md; Cisco HA campus guide and Catalyst 9300 data sheet from spec.md Technical Model), the exactly-three `switchClasses` (SwitchClass.id, SwitchClass.maxPortMbps, SwitchClass.devicePorts, SwitchClass.uplinkMbps, SwitchClass.maxUplinks, SwitchClass.roles per data-model.md and research.md R5/R6), and every `deviceTypes` entry used by any level, including the multigigabit type Level 2 needs (DeviceType.id, DeviceType.portMbps, DeviceType.upMbps, DeviceType.downMbps per data-model.md). Demands are chosen high enough to create bottlenecks (plan.md Open Item 2), with an illustrative-values note; `levels: []` for now
- [X] T007 [P] Write hand-computed evaluator tests in `tests/rules.test.js` against small inline fixtures, not `data/levels.json`: one fixture per reasonCode in contracts/evaluator.md (`fits`, `fits-overprovisioned`, `device-port-unsupported`, `upgraded-non-bottleneck`, `uplinks-maxed-need-class`, `undersized-class`, `over-capacity`); one per invalid-input code (`no-change`, `unknown-switch`, `class-not-allowed`, `uplinks-out-of-range`, `upgrade-not-allowed`); an exactly-80% case that passes and the same case +1 Mbps that fails (research R3); a case where downstream is busier than upstream and decides the result (FR-003); and a check that per-uplink load = switch load ÷ active uplinks (research R4). Tests MUST fail before T008
- [X] T008 Implement pure `evaluate(catalog, round, committed, design)` in `engine/rules.js` per contracts/evaluator.md algorithm steps 1–7: integer Mbps with `max(up,down) × 100 ≤ 80 × capacity` (ComponentResult.ok in data-model.md); access and aggregation loads per direction; device-port check against SwitchClass.maxPortMbps; input checks on Design.classId and Design.activeUplinks, and on Round.allowedUpgrades (`upgrade-not-allowed`) (data-model.md); efficiency notes from ComponentResult.changed / ComponentResult.wasViolating; reasonCode precedence as in the contract table. No DOM, timers, randomness or session mutation. Make T007 pass
- [X] T009 [P] Write content-validator tests in `tests/content.test.js`: one broken fixture per rejection rule in contracts/level-data.md groups 1–2 (structural: missing field, duplicate id, dangling source/class/device/switch ref, wrong `schemaVersion`; model: switch class count ≠ 3, DeviceType.upMbps or DeviceType.downMbps > DeviceType.portMbps, DeviceGroup.count total > SwitchClass.devicePorts, class/role mismatch on Topology.aggregation or Topology.accessSwitches, uplinks out of range), each asserting an error naming the level/round ID; plus a test that the shipped `data/levels.json` validates in under 100 ms, measured with `performance.now()` (plan.md Performance Goals)
- [X] T010 Implement `validateContent(doc)` structural and model checks (contract groups 1–2) in `engine/content.js`, returning `{ok, catalog, levels}` or `{ok:false, errors:[{levelId, roundId, path, message}]}`. Cover Source.id, Source.title, Source.url, Source.section, Source.claim; SwitchClass.id, SwitchClass.maxPortMbps, SwitchClass.devicePorts, SwitchClass.uplinkMbps, SwitchClass.maxUplinks, SwitchClass.roles; DeviceType.id (unique), DeviceType.portMbps, DeviceType.upMbps, DeviceType.downMbps; Topology and DeviceGroup.count, all as constrained in data-model.md. Make the T009 group 1–2 cases pass
- [X] T011 Implement the session state machine in `engine/state.js` per data-model.md "State transitions" and SessionState.view: `loading`, `content-error`, `briefing`, `round`, `level-summary`, `session-summary`; track SessionState.committedDesign and SessionState.pendingDesign (research R8) and SessionState.perRound attempts / completed / lastResult; increment attempts only on `correct`/`incorrect` while unsolved (FR-017, FR-018); set `committed = submitted` after a graded Submit
- [X] T012 Implement `main.js`: fetch `data/levels.json` by relative URL, run `validateContent`, then render a loading view, a content-error view (naming level/round, with a Retry button that reloads) or the first briefing (FR-023, C1)

**Checkpoint**: `tests/` shows rules and content group 1–2 suites green. The evaluator is proven independently of any UI.

---

## Phase 3: User Story 1 - Fix one bottleneck in a single round (Priority: P1) 🎯 MVP

**Goal**: Level 1 ("link capacity", LO1) playable end to end: briefing → inspect → choose uplinks → Submit → explanation → retry or Next.

**Independent Test**: quickstart.md V2. Empty Submit gives guidance with 0 attempts; a non-bottleneck upgrade gives `upgraded-non-bottleneck` and the round stays open; adding uplinks on the bottleneck gives `fits` and enables Next; a repeated Submit is a no-op.

### Tests for User Story 1

- [X] T013 [P] [US1] Add Level 1 hand-computed cases to `tests/rules.test.js`: for each Level 1 round, (a) Round.reference → `correct`, (b) Round.start plus one non-bottleneck uplink change → `incorrect/upgraded-non-bottleneck`, (c) a design landing exactly on 80% → passes (contracts/evaluator.md "Required test cases"; data-model.md Round.reference, Round.start). Record the arithmetic in comments
- [X] T014 [P] [US1] Add state tests to `tests/state.test.js`: invalid input leaves attempts unchanged; incorrect → attempts+1 and round still open; correct → completed, Submit then a no-op with no second award (FR-017); Next advances from round 1 to round 2 of the level

### Implementation for User Story 1

- [X] T015 [US1] Add Level 1 to `data/levels.json`: Level.id, Level.title, Level.outcome = `LO1`, Level.sourceIds, Level.briefing (concept, terms, a workedExample that differs from every Round.start, simplifications) and Level.rounds (exactly 2), per data-model.md. Each round has Round.id, Round.intro, Round.start, Round.addedDevices, Round.allowedUpgrades = `["uplinks"]`, Round.claims.uplinkOnly = true, Round.hints and Round.reference per data-model.md. The briefing teaches the ≈20:1 / ≈4:1 heuristic, states that grading uses the 80% rule on the demand shown, and says "aggregation (also called distribution)" at first mention (FR-007). Round 2's Round.start = round 1 Round.reference applied + Round.addedDevices, and its Round.intro says so (FR-014). Briefing text waits on T005
- [X] T016 [US1] Extend `engine/content.js` with contract group 3–4 checks: Round.start has ≥ 1 violation; Round.reference passes via `evaluate`; Round.reference uses only Round.allowedUpgrades and Level 1 rounds do not allow `replace` (data-model.md); Round.claims verified by exhaustive design search over the allowed upgrade types (research R9: every allowed class × uplink count per switch, ≤ ~2 000 designs); workedExample ≠ any Round.start; Round.hints length exactly 2; Level.sourceIds non-empty; round-to-round continuity including Round.addedSwitches and Round.addedDevices (data-model.md "Cross-round rule"). Add one broken fixture per check to `tests/content.test.js`
- [X] T017 [P] [US1] Implement `engine/feedback.js`: map EvaluationResult (contracts/evaluator.md) to explanation text for every reasonCode, including the bottleneck switch, direction, load, capacity and utilization (1 dp), before → after values for changed components, the efficiency-note list (FR-005), and the cited Source title and section for the 80% rule (FR-028). Fixed wording comes from data; numbers come from the result
- [X] T018 [US1] Implement briefing and round views in `ui/render.js`: the briefing view (concept, terms, worked example, simplifications, source links; Start button); the round view with an SVG topology (core → aggregation → access → device groups) showing on each link capacity, up/down load and utilization as text, plus an equivalent `<table>` (FR-009, FR-024). Values always come from SessionState.committedDesign; pending changes are marked "planned" with no recomputed utilization (research R8)
- [X] T019 [US1] Implement round controls in `ui/controls.js`: a native `<select>`/number input per changeable switch for active uplinks (bounded by SwitchClass.maxUplinks from data-model.md; options beyond the class maximum are not offered and an inline note says another class is needed); Submit (disabled after success); Next (enabled only after success); focus moves to the feedback heading after Submit and to the view heading after Next
- [X] T020 [US1] Wire everything in `main.js`: briefing → round → Submit → `evaluate` → `state` → `feedback` → render feedback into the live region; Next → round 2 → a Level 1 completion screen (temporary until US3 adds summaries)
- [X] T021 [US1] Implement minimal continuous flow in `ui/flow.js`: packet dots on every link over SessionState.committedDesign (data-model.md), with a text "spilling" marker on each component where ComponentResult.ok is false (data-model.md). Under `prefers-reduced-motion: reduce`, show a static before/after view instead. Starts when the round is shown, never stops while it is shown, and never times, blocks or scores anything (FR-011, FR-025; constitution › First-Release Scope)

**Checkpoint**: quickstart.md V2 passes in the browser; rules, content and state suites are green. MVP done.

---

## Phase 4: User Story 2 - Size devices correctly as the network grows (Priority: P2)

**Goal**: Levels 2 ("device type sizing", LO2) and 3 ("organic growth"), with switch replacement and device-port checks, completing the six-round curriculum.

**Independent Test**: quickstart.md V3. Maxed uplinks on an overloaded 1G-class switch give `uplinks-maxed-need-class`; replacing it with the nbase-t class gives `fits`; multigigabit devices on a 1G-class switch give `device-port-unsupported`; each round starts from the previous reference design.

### Tests for User Story 2

- [X] T022 [P] [US2] Add Level 2 and Level 3 hand-computed cases to `tests/rules.test.js`: per round, reference → correct; best uplinks-only design → incorrect (`uplinks-maxed-need-class` or `device-port-unsupported`); aggregation-only upgrade → `upgraded-non-bottleneck` (spec US2 scenario 2); an undersized replacement → `undersized-class`
- [X] T023 [P] [US2] Add content tests to `tests/content.test.js`: a fixture whose Round.claims.requiresClassChange is contradicted by an uplinks-only passing design is rejected; the full shipped file has exactly 3 levels × 2 rounds (FR-015); a continuity break between Level 1 round 2 and Level 2 round 1 is rejected

### Implementation for User Story 2

- [X] T024 [US2] Add Level 2 to `data/levels.json` (Level.outcome = `LO2`, fields per data-model.md Level and Round). Each round has Round.allowedUpgrades = `["uplinks","replace"]` (data-model.md). It uses the multigigabit device type from T006 (no new catalog entries) and has at least one round with Round.claims.requiresClassChange = true. Round 1's Round.start continues from the Level 1 round 2 Round.reference (FR-014). Briefing text waits on T005
- [X] T025 [US2] Add Level 3 ("organic growth") to `data/levels.json`: two rounds that each add devices (Round.addedDevices) and may add access switches (Round.addedSwitches; total Topology.accessSwitches ≤ 3, per data-model.md); each has Round.allowedUpgrades = `["uplinks","replace"]` and Round.claims.requiresClassChange = true (data-model.md) (SC-004)
- [X] T026 [US2] Enable the full-curriculum checks in `engine/content.js`: exactly 3 levels × 2 rounds; continuity across level boundaries; make the T023 cases pass
- [X] T027 [US2] Extend `ui/controls.js` with a "replace switch" selector per switch, shown only when Round.allowedUpgrades includes `replace` (data-model.md), listing only classes whose SwitchClass.roles allow that tier (data-model.md; the aggregation tier only offers the 25G class, research R6). Changing the class resets the uplink bounds to the new SwitchClass.maxUplinks
- [X] T028 [US2] Extend `ui/render.js` to show each switch's class label, its max device-port speed (SwitchClass.maxPortMbps) and each device group's DeviceType.portMbps / upMbps / downMbps, so the port and capacity checks can be reasoned about from the screen (C2, FR-009)
- [X] T029 [US2] Extend `engine/feedback.js` wording for `device-port-unsupported`, `uplinks-maxed-need-class` (name a class that would fit) and `undersized-class`, and show the round intro line stating the start is the previous reference design (FR-014)

**Checkpoint**: all six rounds play in sequence; quickstart.md V3 passes; all suites green.

---

## Phase 5: User Story 3 - Get help and see honest progress (Priority: P3)

**Goal**: Hints, worked solution, level and session summaries, and restart, with assistance recorded separately.

**Independent Test**: quickstart.md V4. Hints 1 and 2 and the solution leave attempts unchanged; the summary shows completed / attempts / assistance separately; Restart → Cancel changes nothing, Confirm clears everything; reload starts fresh.

### Tests for User Story 3

- [X] T030 [P] [US3] Add state tests to `tests/state.test.js`: hint 1 then 2 sets SessionState.perRound.hintsViewed (0–2, data-model.md) without changing attempts; viewing the solution sets `solutionViewed`, and solving afterwards counts as "completed with assistance"; level-summary and session-summary values are computed per round and kept separate (FR-021); Restart cancel → identical state; Restart confirm → level 1 briefing with progress cleared (FR-022)

### Implementation for User Story 3

- [X] T031 [US3] Extend `engine/state.js` with `viewHint()` (increments SessionState.perRound.hintsViewed, capped at 0–2 per data-model.md), `viewSolution()`, `requestRestart()` / `confirmRestart()` / `cancelRestart()`, and level/session summary selectors. After the last round of a level, Next goes to `level-summary`; after the last level it goes to `session-summary` (FR-016)
- [X] T032 [US3] Extend `ui/controls.js` and `ui/render.js` with Hint (reveals Round.hints[0] then [1] per data-model.md, method first), Show solution (renders Round.reference as a list of changes and records assistance), Restart with a native confirm dialog, and the level and session summary views showing completed rounds, valid attempts and assistance as three separate figures

**Checkpoint**: quickstart.md V4 passes; all three stories work.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Ambient flow, accessibility, packaging and recorded evidence.

- [X] T033 Refine the ambient flow in `ui/flow.js` (built in T021): smooth `requestAnimationFrame` animation, packet density scaled to each link's load, and a visible spill effect at components where ComponentResult.ok is false (data-model.md). Keep the reduced-motion static view working (FR-025) and never block input (FR-011)
- [X] T034 [P] Write `README.md`: a line stating that `specs/001-capacity-flows-game/` is the canonical spec and plan, what the game teaches, run instructions (`python3 -m http.server 8000 --bind 127.0.0.1`; `/tests/`), the Technical Model simplifications and exclusions from spec.md (FR-027), sources with sections (from T005), the illustrative-demand note, and a "Verification" table (check, pass/fail/not run, date, browser, evidence)
- [ ] T035 (automated parts recorded in README 2026-11-17; keyboard-only, screen-reader, SC-005 teammate and SC-001 timing checks need a person) Run quickstart.md V1–V7 and record each result in the `README.md` Verification table, including keyboard-only full session, 360 px layout, reduced motion, same-origin-only network requests, the actual first-play time, and the SC-005 teammate explanation check from quickstart V2 step 5 (SC-001, SC-005, SC-006, SC-007). Keep failed and not-run checks visible (C7)
- [X] T036 Review every briefing, hint, Round.intro (data-model.md: each round after the first says it starts from the previous reference design) and explanation in `data/levels.json` and `engine/feedback.js` against spec.md Technical Model and the cited sources; fix any disagreement before release (C1)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup; blocks all stories. T008 depends on T007; T010 on T009; T011 and T012 on T008/T010.
- **US1 (Phase 3)**: depends on Foundational. T015 and T016 before T020; T017–T019 can run in parallel with T015/T016; T021 after T018.
- **US2 (Phase 4)**: depends on US1's content checks (T016) and controls (T019); content continues from Level 1's reference.
- **US3 (Phase 5)**: depends on Foundational state (T011) and US1 views; independent of US2.
- **Polish (Phase 6)**: T033 after T021; T034–T036 after all stories.
- **T005** (resolve the R1 ratio) blocks the briefing text in T015, T024 and T025, and T036.

### User Story Dependencies

- **US1 (P1)**: none beyond Foundational. This is the MVP.
- **US2 (P2)**: builds on US1 data continuity (FR-014) and controls; testable alone via quickstart V3.
- **US3 (P3)**: needs a playable round (US1); does not need US2.

### Within Each Story

Tests first, and they must fail → data → engine → UI → wiring → checkpoint validation.

### Parallel Opportunities

- Phase 1: T002, T003, T004.
- Phase 2: T007 ∥ T009 (different test files); T005 ∥ all code tasks.
- US1: T013 ∥ T014; T017 ∥ T018 after T016.
- US2: T022 ∥ T023; T027 ∥ T028 after T024.
- US3 can proceed in parallel with US2 once US1 is done.

---

## Parallel Example: User Story 1

```bash
Task: "Add Level 1 hand-computed cases to tests/rules.test.js"   # T013
Task: "Add state tests to tests/state.test.js"                    # T014
# after T016:
Task: "Implement engine/feedback.js"                              # T017
Task: "Implement briefing and round views in ui/render.js"        # T018
```

---

## Implementation Strategy

### Minimum Release Set (60-minute build)

Phases 1–3 (MVP plus continuous flow T021), Level 2 (T022–T024, T027–T029), US3 (T030–T032),
and T034–T036. Level 3 (T025, T026) and flow polish (T033) are deferrable, in that order (see
below). Anything deferred is recorded as an explicit scope reduction in spec.md and README (C7).
If Level 3 is deferred, amend FR-015 and the level-count check in `engine/content.js` to
2 levels × 2 rounds, or the shipped file will fail its own validation.

### MVP First (User Story 1 Only)

1. Phase 1 → Phase 2 (evaluator proven by T007) → Phase 3.
2. **Stop and validate** with quickstart.md V2.
3. Demo Level 1.

### Incremental Delivery

1. Setup + Foundational → rule proven (plan slice 1).
2. US1 → one complete level (slice 2).
3. US2 → full curriculum (slice 3).
4. US3 → help and honest progress (slice 3).
5. Polish → usable and packaged (slices 4–5).

If time runs short (C7), cut in this order: (1) Level 3 (T025, T026); (2) flow polish (T033).
**Never cut continuous packet flow itself (T021)**: it is the first release's core mechanic
(constitution › First-Release Scope, FR-011). Record any reduction in spec.md (FR-015) and the
README. Never cut T007, T016, T021 or T036.

---

## Notes

- [P] = different files, no dependency on incomplete tasks.
- `data/levels.json` is edited by T006, T015, T024 and T025 in sequence, so none of those are [P].
- Commit after each task or checkpoint.
- A checked box is not proof (C7): record evidence in the README Verification table.
