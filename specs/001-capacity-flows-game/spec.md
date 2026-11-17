# Feature Specification: Capacity Flows — First Playable

**Feature Branch**: `master` (no feature branch created; spec directory `001-capacity-flows-game`)

**Created**: 2026-11-17

**Status**: Draft (regenerated 2026-11-17 from SPEC.md against constitution v1.0.1)

**Input**: User description: "Use SPEC.md" — Bobby Bits has to keep the packets flowing through
the network. The player is a network engineer in a three-tier campus network. Each round shows
ingress and egress traffic and asks the player to upgrade pieces of the network. A correct
decision delivers all packets; an incorrect decision spills/drops packets. The network grows
slowly and organically with new devices. The session ends when all packets have been delivered.

## Clarifications

### Session 2026-11-17

- Q: When the player "upgrades a link", what exactly can they change? → A: A link upgrade
  activates more uplink ports at the switch class's fixed uplink speed (e.g., 1 → 4 × 10G); a
  faster uplink requires replacing the switch with another class.
- Q: What number is a switch's capacity for the 80% rule? → A: Its total active uplink
  bandwidth (active uplinks × uplink speed); datasheet switching-fabric capacity is not graded.
- Q: How is each end device's traffic demand set? → A: Authored once per device type (fixed,
  displayed values in level data, consistent across all rounds); the 20:1 and 3:1 ratios are
  taught as planning rules of thumb, not as the grading formula.
- Q: Are ingress and egress graded separately or as one value? → A: Each device type has an
  upstream (ingress toward core) and a downstream (egress toward devices) demand; both are shown,
  and the 80% rule is applied to the busier direction of each link and switch (full-duplex).
- Q: Which tiers can the player change, and is the core ever a bottleneck? → A: Access and
  aggregation switches and their uplinks are changeable and graded; the core is a fixed,
  ungraded endpoint with sufficient capacity (aggregation-to-core uplinks are still graded).
- Q: (plan phase) How is each round's starting network set, given over-provisioning passes?
  → A: Authored per round in level data as the previous round's reference solution plus the new
  devices; the player's extra upgrades are not carried forward, and the briefing says so.
- Q: (specify phase) How does "packets never stop flowing" relate to rounds and timing? → A:
  Packets flow continuously as an ambient visualization; nothing is timed, and grading happens
  only on Submit (FR-011).
- Q: (specify phase) Is an over-provisioned design correct? → A: Yes, if every component is
  ≤ 80%; the explanation lists each unnecessary upgrade as an efficiency note (FR-005).
- Q: (analysis) Which upgrades does each round offer? → A: Each round declares its allowed
  upgrade types. Level 1 offers only "add uplinks"; Levels 2–3 offer "add uplinks" and
  "replace switch" (FR-010).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Fix one bottleneck in a single round (Priority: P1)

A junior network engineer opens the game and reads a short briefing on link capacity and the 80%
utilization rule, with a worked example that differs from the challenge. They then see a small
three-tier topology (end devices → access switch → aggregation → core) with each link's capacity,
load, and utilization shown as numbers. One link is over 80% utilized and packets are visibly
spilling there. The player finds the access switch whose uplinks are over 80%, adds uplinks to it,
and submits. Packets
then flow through the new design, and the game explains the result using the relevant values.

**Why this priority**: This is the core mechanic and the smallest slice that teaches the target
skill: find the bottleneck, and see that upgrading anything else does not help. It is a viable
MVP on its own.

**Independent Test**: Play one round from briefing to result. Submit one wrong design (add
uplinks on a switch that is not over 80%) and one correct design, and confirm each outcome and
explanation.

**Acceptance Scenarios**:

1. **Given** a round where only one access switch's uplinks (access → aggregation) exceed 80%,
   **When** the player adds enough uplinks on that switch to bring it to ≤ 80% and submits, **Then** the round is
   marked correct, all packets are shown delivered, and the explanation states the before/after
   utilization and why it now fits.
2. **Given** the same round, **When** the player adds uplinks only on a switch that is not over
   80% and submits, **Then** the round is marked incorrect, packets are shown dropping at the
   still-constrained uplinks, the explanation names that switch and its utilization and notes that
   the upgraded switch was not the bottleneck, and the round stays playable.
3. **Given** the player has made no upgrade selection, **When** they press Submit, **Then** the
   game gives input guidance and does not count an attempt.
4. **Given** a round already solved, **When** the player presses Submit again, **Then** no
   additional progress or attempt is recorded and Next stays available.

---

### User Story 2 - Size devices correctly as the network grows (Priority: P2)

In later rounds, new end devices join the network (more users, devices with faster ports). The
player must decide not only which links to upgrade but which switch class each location needs
(1G access with 4×10G uplinks, nbase-t access with 4×25G uplinks, or 25G with 2×100G uplinks), so
that no link and no switch exceeds 80% of its capacity.

**Why this priority**: Applies the foundation to device selection (LO2) and delivers the organic
growth step in the constitution's learning sequence.

**Independent Test**: Play a growth round where the existing access switch cannot carry the new
demand at ≤80% even with all its uplinks in use. Confirm that only a switch-class change passes.

**Acceptance Scenarios**:

1. **Given** a round where added devices push a 1G-class access switch's total uplink capacity
   over 80%, **When** the player replaces it with an nbase-t-class switch and submits, **Then** the
   round is correct and the explanation shows the demand, the new uplink capacity, and the
   resulting utilization.
2. **Given** the same round, **When** the player only adds uplinks on the aggregation switch
   (aggregation → core), **Then** the round is incorrect and the explanation identifies the
   access switch as the constraint.
3. **Given** a completed round, **When** the player presses Next, **Then** the next round's
   topology starts from the previous round's reference solution with new devices added (the
   briefing states this), and its concept briefing, if it introduces one, appears first.

---

### User Story 3 - Get help and see honest progress (Priority: P3)

A stuck player opens a hint (a method first, then a worked step) or a worked solution. At the end
of each level and of the session, a summary shows rounds completed, valid attempts, and
assistance used as separate figures. The player can restart the session after confirming.

**Why this priority**: Supports learning and honest reporting (constitution C2, C3), but the core
loop works without it.

**Independent Test**: Use a hint and a worked solution in one round, complete the session, and
confirm the summary records assistance separately. Restart and cancel; then restart and confirm.

**Acceptance Scenarios**:

1. **Given** an unsolved round, **When** the player requests a hint, **Then** the first hint
   describes a method (e.g., "compare each link's load to 80% of its capacity") and the second
   gives a worked step; neither submits an answer nor counts as an attempt.
2. **Given** the player viewed a worked solution, **When** they later solve the round, **Then**
   the round is counted as completed with assistance.
3. **Given** the player presses Restart, **When** they cancel the confirmation, **Then** nothing
   changes; **When** they confirm, **Then** the session returns to the first briefing with all
   counts cleared.

---

### Edge Cases

- A link or switch at exactly 80% utilization passes; anything above 80% fails.
- The player upgrades the bottleneck correctly *and* also upgrades unconstrained parts: the
  design is correct, and the explanation lists each unnecessary upgrade with its before/after
  utilization (see FR-005).
- Spills seen before Submit (ambient flow over a still-overloaded design) never count as an
  attempt, a failure, or a penalty.
- The player tries to add more uplinks than the switch class allows (e.g., a fifth 10G uplink
  on a 1G-class switch): the option is not offered, and the game explains that a faster or wider
  uplink needs a different switch class.
- A round's authored data is missing a value, references an unknown switch class, admits no
  passing design, or makes a claim (e.g., "requires a class change") contradicted by checking
  every possible design: the round is shown as unavailable with an explanation, cannot be graded,
  and no attempt is counted. More than one passing design is normal and is not an error (FR-005).
- Reduced-motion preference is on: the packet-flow result is shown as a static before/after
  utilization view; feedback and controls appear immediately.
- Narrow browser window: the topology area scrolls within its own labeled container; Submit,
  Hint, and Next stay visible.

## Requirements *(mandatory)*

### Technical Model

Constitution C1 (v1.0.1) makes this section the single documented source of the model taught.

- **Rule being taught**: oversubscription-based capacity planning. Planning heuristic:
  approximately 20:1 from end-device ports to access-switch uplinks (access → aggregation), and
  approximately 4:1 from aggregation (also called distribution) to core. Grading rule: a link or switch is adequately sized when its utilization
  (load ÷ capacity) is ≤ 80%.
- **Context**: a three-tier campus network (access, aggregation, core) built from three generic
  switch classes: 1G access switch with 4×10G uplinks; nbase-t access switch with 4×25G uplinks;
  25G switch with 2×100G uplinks.
- **Assumptions**: a switch's graded capacity is its total active uplink bandwidth; traffic is
  shared evenly across active uplinks. Other performance figures not stated in the game come
  from the Cisco Catalyst 9300 series datasheets and are not graded. Switch classes are
  otherwise generic and not vendor-branded. Demand is authored per device type, shown to the player, and steady (not
  bursty). The ≈20:1 and ≈4:1 ratios are planning rules of thumb taught in the briefing; they
  are not the grading formula.
- **Excluded behavior (v1)**: QoS queuing and prioritization; latency and jitter; bursty traffic
  and buffering; TCP behavior; redundancy, link-aggregation failover, and spanning tree; routing
  protocols; wireless; core-tier capacity; upstream WAN/internet links; and cost. Packet
  "spills" show sustained overload; they do not model real drop mechanics. *(Proposed here because SPEC.md leaves this
  blank; confirm or edit.)*
- **Authoritative references** *(identified during planning; see research.md R1–R2)*:
  - Cisco, *Campus Network for High Availability Design Guide* — Design Best Practices, QoS
    congestion figure (illustration 119839), labels "Typical 20:1 data oversubscription"
    (access → distribution) and "Typical 4:1 data oversubscription" (distribution → core).
    Verified from the PDF text on 2026-11-17; the surrounding body heading could not be
    extracted automatically and should be confirmed by eye:
    https://www.cisco.com/en/US/docs/solutions/Enterprise/Campus/HA_campus_DG/hacampusdg.html
  - Cisco, *Catalyst 9300 Series Switches Data Sheet* — network module / uplink tables
    (heading not yet verified: the page served a landing page to automated fetches):
    https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html
  - Resolved 2026-11-17: the briefing teaches ≈4:1 aggregation → core, matching the cited
    guide; the earlier ≈3:1 figure from SPEC.md is retired.

### Functional Requirements

**Model and grading**

- **FR-001**: The game MUST model a three-tier campus network: end devices, access switches,
  aggregation, and core, connected by links with stated capacities. Only access and aggregation
  switches and their uplinks (access → aggregation, aggregation → core) are changeable and
  graded. The core is a fixed endpoint treated as having sufficient capacity; it is never graded
  or offered as an upgrade.
- **FR-002**: The game MUST offer exactly three switch classes in v1, as listed in the Technical
  Model.
- **FR-003**: Each end device MUST belong to a device type (e.g., laptop, camera, access point)
  whose port speed, upstream demand (ingress, toward core), and downstream demand (egress, toward
  devices) are authored once in level data, displayed to the player, and identical in every
  round. For each direction, a switch's load MUST equal the total demand of all devices behind it,
  split evenly across its active uplinks (uplink load = switch load ÷ active uplinks). Links are
  full-duplex: a link's or switch's graded load is the busier of its two directions, and both
  directions MUST be displayed.
- **FR-004**: A switch's capacity MUST be its total active uplink bandwidth (active uplinks ×
  the class's uplink speed). A link's capacity is its uplink speed. A link or switch MUST be
  graded as adequately sized when its utilization (load ÷ capacity) is ≤ 80%. Datasheet
  switching-fabric capacity MUST NOT be used for grading.
- **FR-004a**: Each switch class MUST have a maximum device-port speed (1G class: 1G; nbase-t
  class: 10G; 25G class: 25G) and 48 device ports. A design in which a device type's port speed
  exceeds its access switch's maximum port speed MUST be graded incorrect, and the explanation
  MUST name the device type and both speeds. *(Added in planning — research.md R5.)*
- **FR-005**: A design MUST be graded correct only when every link and switch in the round is
  adequately sized and FR-004a is satisfied. Over-provisioning does not make a design incorrect, but the explanation MUST
  name every upgraded component that was not over 80% before the upgrade, as an efficiency note.
- **FR-006**: Grading MUST be deterministic: the same round and the same design always produce
  the same result, reason, and explanation values.
- **FR-007**: The briefing MUST teach the oversubscription heuristic (≈20:1 and ≈4:1) and state
  that grading uses the 80% utilization rule on the demand shown. It MUST use the term
  "aggregation (also called distribution)" at first mention, to match the cited sources.

**Game loop**

- **FR-008**: Each level MUST start with a briefing that introduces one concept, its terms, and a
  worked example different from the challenge.
- **FR-009**: Each round MUST show the topology with every decision-relevant value (capacity,
  load, utilization %) as text, not only as color or animation, including ingress and egress
  traffic.
- **FR-010**: Players MUST be able to select links and switches, choose an upgrade for each, and
  explicitly submit the design (only access and aggregation switches; see FR-001). Exactly two
  upgrade types exist: (a) **add uplinks** — set the
  number of active uplink ports on a switch, from 1 up to its class maximum, each at the class's
  fixed uplink speed; (b) **replace switch** — change a switch to another switch class. A link's
  speed changes only by replacing the switch it attaches to. Each round MUST declare which
  upgrade types it allows, and only those MUST be offered: Level 1 rounds allow only add uplinks;
  Level 2 and 3 rounds allow both (constitution C2: introduce a concept before testing it).
- **FR-011**: Once the game starts, packets MUST flow continuously through the current design as
  an ambient visualization, visibly spilling at any component over 80%. This flow is purely
  illustrative: it MUST NOT time, force, or score a decision, and grading happens only on Submit.
  After submission, the flow MUST reflect the submitted design (delivered where capacity
  suffices, spilling where it does not), alongside an explanation naming the rule and the
  relevant values.
- **FR-012**: An incorrect design MUST leave the round playable, and the explanation MUST name
  the specific mistake (e.g., upgraded a non-bottleneck; chose an undersized switch class).
- **FR-013**: A correct design MUST explain why it works and enable an explicit Next action.
- **FR-014**: Between rounds, the network MUST grow deterministically by adding authored end
  devices. Each round's starting design MUST be authored in level data as the previous round's
  reference solution plus the new devices, and MUST contain at least one component over 80%.
  The player's own previous design is not carried forward; the round briefing MUST say so.
- **FR-015**: v1 MUST contain three levels in the sequence link capacity → device type sizing →
  organic growth, with two rounds each (six rounds total).
- **FR-016**: The session MUST end with a summary once all rounds are completed (all packets
  delivered in the final round).

**Progress and help**

- **FR-017**: A round MUST complete only on a valid, correct submission. Submit MUST be disabled
  after success, and repeated submission MUST NOT award progress twice.
- **FR-018**: An empty or malformed submission MUST give input guidance and MUST NOT count as an
  attempt.
- **FR-019**: Each round MUST provide ordered hints (method first, then a worked step) and a
  worked solution. Using either MUST be recorded as assistance and MUST NOT count as an attempt.
- **FR-020**: The game MUST have no lives, countdown, speed bonus, or penalty for hints or
  retries.
- **FR-021**: Level and session summaries MUST show completed rounds, valid attempts, and
  assistance used as separate values.
- **FR-022**: Restart MUST require confirmation. Cancelling changes nothing; confirming returns
  to the first briefing with progress cleared. Reloading the page MUST start a fresh session.

**Content, access, and self-containment**

- **FR-023**: Level content (briefings, topologies, devices, demands, hints, sources) MUST be
  authored as editable data and validated before any round is presented. Invalid content MUST
  show a content error naming the level/round and MUST NOT be graded.
- **FR-024**: All core actions MUST be operable by keyboard with visible focus and readable
  labels. Results MUST be stated in text as well as color. The topology MUST have a text
  equivalent (e.g., a table of links with capacity, upstream and downstream load, and
  utilization).
- **FR-025**: The game MUST respect reduced-motion preferences, and animation MUST NOT delay
  feedback or controls.
- **FR-026**: The game MUST be playable with no account, backend, live device, AI model, or API
  key.
- **FR-027**: Briefings and the README MUST state the model's simplifications and exclusions
  (see Technical Model) wherever they affect what the player can conclude.
- **FR-028**: Each networking rule shown in a briefing or explanation MUST cite a source record
  (title, link, section).

### Key Entities

- **Level**: an ordered group of rounds teaching one concept; has an ID, title, learning outcome,
  briefing (with worked example), and source references.
- **Round**: one design challenge; has an ID, starting topology, devices added at the start of
  the round, allowed upgrade types (add uplinks and/or replace switch), ordered hints, and a worked
  solution.
- **Topology**: the set of nodes (end-device groups, access switches, aggregation, core) and the
  links connecting them.
- **Switch class**: one of the three generic models; defines maximum device-port speed, device
  port count (48), uplink speed, maximum uplinks, and allowed tier (only the 25G class may be
  aggregation).
- **Link**: connects two nodes; has a capacity, a computed upstream and downstream load, and a
  utilization based on the busier direction.
- **Device type**: a named kind of end device with a fixed port speed and per-device upstream and
  downstream demand, shared by all rounds.
- **End-device group**: a count of devices of one device type attached to one access switch; the
  source of all traffic.
- **Design / Submission**: the set of upgrades the player selected for a round — per switch, its
  switch class and its number of active uplinks.
- **Evaluation result**: correct / incorrect / invalid input / content error, with a reason and
  the values used to explain it.
- **Session progress**: completed rounds, valid attempts, and assistance per round.
- **Source reference**: title, link, section, and the claim it supports.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A first-time player completes all six rounds in 5–10 minutes (no time limit is
  enforced).
- **SC-002**: 100% of shipped rounds pass hand-checked correct, incorrect, and boundary (exactly
  80%) cases, recorded independently of the game's grading.
- **SC-003 (LO1)**: In every completed round, no link in the accepted design exceeds 80%
  utilization.
- **SC-004 (LO2)**: In every completed round, no switch in the accepted design exceeds 80% of its
  capacity, and growth rounds require at least one switch-class decision. (With traffic shared
  evenly, switch and uplink utilization are equal, so SC-004's distinct checks are the class
  decision and the device-port check of FR-004a.)
- **SC-005**: After a deliberately wrong submission, a reviewing teammate can say from the
  explanation alone which component was the bottleneck and why the chosen upgrade did not help.
- **SC-006**: A keyboard-only player can complete the full session without a pointer.
- **SC-007**: A fresh browser session plays the full game using only the project's static files,
  with no network service contacted for grading or content.

## Assumptions

- **Learner**: a junior network engineer who knows interface types and speeds and basic QoS
  concepts.
- **Curriculum size**: three levels × two rounds fits the 5–10 minute session and the 60-minute
  workshop build budget.
- **Traffic model**: the oversubscription ratios are a planning heuristic taught in the briefing;
  grading uses only the authored device-type demands and the 80% rule.
- **Session**: in-memory only; no persistence across reloads; single player; no audio.
- **Dependency**: SPEC.md's "Excluded behavior" and "Authoritative references" fields are blank.
  The values in the Technical Model above are proposals and should be copied back to SPEC.md once
  confirmed, so the two documents agree (constitution C7).
