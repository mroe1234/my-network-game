# Capacity Flows Constitution

## Core Principles

### C1 · Technical Truth Is a Release Requirement

The game MUST never reward a technically incorrect answer. Grading MUST be reproducible from a
documented rule and the challenge inputs. Unsupported or ambiguous content is an authoring error:
the game MUST show an explanation that the challenge is unavailable and MUST prevent grading it.

The model being taught MUST be documented in the specification ("The technical model": rule,
context, assumptions, excluded behavior, and authoritative references) before planning begins.
This constitution does not restate that model; the specification is its single source.
Simplifications MUST appear in the briefing and README wherever they affect what the player can
conclude. Fictional worlds and animations (including packet flow) MAY illustrate a rule; they
MUST NOT change it.

**Evidence:** hand-checked correct, incorrect, and boundary cases (e.g., exactly 80%
utilization); a source link and section for each networking rule; review of all shipped
briefings and explanations. Expected results are recorded independently of the implementation
under test.

### C2 · Every Decision Teaches

The player's main action — choosing which links and switches to upgrade, and when — MUST
exercise the target skill. A concept MUST be introduced before it is tested, and the values
needed to reason about it MUST be visible. Whenever part of the network is spilling, the game
MUST explain the specific cause (which switch, which direction or port, and the values) and a
useful next step. When a problem is fixed, it MUST say why the fix works.

Concepts are introduced progressively as the network grows, not in separate levels:
**link capacity** (foundation: predict uplink load from attached end devices) → **device type
sizing** (application: choose the switch class whose ports and uplinks fit) → **aggregation
growth** (transfer: re-plan as devices and demand keep rising). A concept's first appearance on
the growth timeline MUST pause play and brief it. Hints MUST reveal a method before a worked
step; using one is recorded as assistance, never as independent mastery.

**Evidence:** a teammate can connect each player action to a learning outcome and describe what
they learned from a deliberately wrong choice.

### C3 · Scoring Is Honest and Pressure Is Fair

The score is how long the network survives, measured on a deterministic simulation clock. Time
pressure is allowed, but it MUST be fair: the player MUST be able to pause at any moment, pausing
MUST stop the simulation clock, and every action MUST remain available while paused. The rule
that ends a game (continuous spilling for a stated number of seconds) MUST be shown on screen,
with a visible countdown whenever it is running. Fixing the problem MUST reset that countdown.

There are no hidden penalties: every cost, income and growth event follows a documented rule.
Hints are recorded as assistance and shown separately from the score; a score earned with
assistance is not proof of independent mastery. Restart MUST require confirmation. The
specification MUST state exactly what ends a game, how the score is computed, and what resets a
session.

**Evidence:** pause, spill-countdown, reset-on-fix, game-over, budget, hint and restart checks
match the specification.

### C4 · Access Is Part of the Core Game

All core actions MUST be usable by keyboard with visible focus, readable labels, and an
understandable order. Success and failure MUST be explained with text as well as color. Essential
diagrams (topology, utilization) MUST have a text equivalent. Reduced-motion preferences MUST be
respected; animation MUST never delay the availability of feedback or controls. Because play
is timed, a pause control MUST be reachable by keyboard at all times, so no action ever depends
on input speed.

The challenge MUST remain usable on a typical laptop and a narrow browser window. Dense technical
data MAY scroll within its own labeled container, without hiding the action buttons.

**Evidence:** a keyboard-only playthrough, a narrow-window check, and a reduced-motion check.
Record what was actually checked; do not claim full accessibility certification.

### C5 · The First Version Is Deterministic and Self-Contained

The game ships authored content and deterministic domain logic. It MUST require no account,
backend, live device connection, model, or API key. Traffic and growth MUST be deterministic: the
same timeline and the same player actions at the same simulation times MUST always produce the
same result. The simulation MUST advance in fixed steps that do not depend on frame rate. AI MAY help write code and assets during development; its output receives the same
review as any other contribution.

Runtime AI tutoring, generated questions, and free-text AI grading are stretch work. Adding them
requires an explicit amendment to this constitution, the specification, and the verification
approach before implementation.

**Evidence:** a clean browser session can play using only the project's static files; no
external content service decides an answer.

### C6 · Content and Logic Can Be Reviewed Separately

Level content, hints, sources, and difficulty MUST live in editable data. Domain rules MUST be
separate from rendering and progress tracking. Data MUST be validated before a challenge is
presented. Feedback MUST agree with the evaluator's reasoning; a hand-authored answer key MUST
NOT silently override the rule engine.

Adding another challenge that uses the existing mechanic MUST require only a data change and its
checks, not a new scoring path or a new screen implementation.

**Evidence:** inspect one level's data, trace one answer through the evaluator, and add a trial
challenge without modifying the rule engine.

### C7 · Done Is Demonstrated

Only the agreed scope ships. Requirements, plan, tasks, and README MUST describe the same game. A
feature is complete when its acceptance criteria pass and its actual status is recorded. A
screenshot, a checked task box, or the agent saying "done" is insufficient by itself.

When time is short, scope is reduced explicitly. Incorrect teaching and broken core interactions
MUST be fixed before visual effects are added. Failed and untested checks MUST stay visible.

**Evidence:** reproducible run/test commands, recorded verification results, a fresh-start
playthrough, and a README another attendee can follow.

## Purpose and First-Release Scope

**Purpose:** help junior network engineers practice network capacity planning by deciding which
part of a campus network to upgrade.

**First release:** one core mechanic — once the game starts, packets never stop flowing, and the
network grows slowly and organically with new devices — delivered within a 60-minute workshop
build. This budget changes only by updating the agreed scope (SPEC.md and PLAN.md) and recording
the reason.

## Development Workflow and Quality Gates

- Work follows the Spec Kit sequence: constitution → specify → clarify → plan → tasks → analyze →
  implement.
- `/speckit-plan` MUST include a Constitution Check that maps the design to C1–C7; any violation
  is listed with its justification or the design is changed.
- `/speckit-analyze` MUST pass with no unresolved constitution conflicts before implementation.
- Implementation proceeds in vertical slices: prove the rule → complete one round → add the
  curriculum → make it usable → package the result. Each slice's evidence is recorded before the
  next begins.
- Verification results (pass / fail / not run, date, environment, evidence) are recorded in the
  README or a linked verification note.

## Governance

This constitution supersedes other project practices. A conflict with it is resolved openly; the
build agent MUST NOT weaken a principle merely to make its implementation pass.

**Amendment procedure:** for any material change, record the reason, update this file and the
affected spec and plan, and rerun `/speckit-analyze`.

**Versioning policy:** semantic versioning.
- MAJOR — a principle is removed or redefined in a backward-incompatible way.
- MINOR — a principle or section is added or guidance is materially expanded.
- PATCH — clarifications, wording, and typo fixes with no change in meaning.

**Compliance review:** every plan, task list, and review checks conformance with C1–C7. Each
principle's **Evidence** line defines what a reviewer must see before that principle is
considered satisfied.

**Version**: 2.0.0 | **Ratified**: 2026-11-17 | **Last Amended**: 2026-11-17
