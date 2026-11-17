# Feature Specification: Capacity Flows — Survival Growth

**Feature Branch**: `master` (spec directory `002-survival-growth`)

**Created**: 2026-11-17

**Status**: Draft. Supersedes `specs/001-capacity-flows-game/` under constitution v2.0.0.

**Input**: User description: "There should be no distinct levels. Over time traffic should
increase and the network should grow. Your score is how long you last before you spill traffic
for more than 15 seconds. Every switch should have a mix of at least 3 different end-user
devices." Carried over from 001: the network model, the action card, the packet encoding (shape
= device type, colour = direction, shade = link fullness) and the arrival queues.

## Clarifications

### Session 2026-11-17

- Q: How should the survival timer and score fit the constitution (old C3 forbade countdowns
  and speed scoring)? → A: Amend the constitution (v2.0.0): timed play is allowed, but the
  player can always pause, and the ending rule and countdown are always visible.
- Q: How does the player change the network during play? → A: Pause to plan at any time
  (pausing stops the clock); changes apply instantly, whether paused or running.
- Q: How are the 15 seconds of spilling counted? → A: Continuously. The game ends once the
  network has spilled for 15 seconds in a row; fixing every problem resets the countdown.
- Q: How does growth work? → A: A scripted timeline, identical every game, followed by
  endless deterministic growth waves.
- Q: What stops a player from maxing out every switch at once? → A: A budget. Credits are earned
  from delivered traffic, and every upgrade costs credits.
- Q: (change request) Can a switch be split? → A: Yes. Splitting buys a second switch of the
  same class (its class price, 1 uplink) and moves floor(n ÷ 2) of each device type onto it;
  both halves must keep ≥ 3 device types; at most 2 splits per game (FR-115).
- Q: Does a game ever end without spilling? → A: No. Growth repeats until even the largest
  design can't cope, so survival time is a true score.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Keep the packets flowing as long as possible (Priority: P1)

A junior network engineer reads one briefing (uplinks, the 80% rule, switch classes, budget, and
the 15-second rule) and presses Start. Traffic flows continuously through a small campus network
whose access switches each serve at least three kinds of device. After 20 seconds the Studio
gains eight workstations and its uplink goes over 80%. Packets visibly spill, the status panel
names the cause with numbers, and a 15-second countdown starts. The player pauses, opens the
Studio's action card, buys a second uplink for 40 credits, and resumes. The countdown resets.
The game continues, growing, until the network spills for 15 seconds in a row; the summary then
shows how long the network survived.

**Why this priority**: This is the whole game loop: real-time pressure, fair pause, cost-aware
fixes, and an honest score.

**Independent Test**: Start a game and do nothing; it must end at exactly 35.0 s of simulation
time (spilling begins at 20.0 s and runs 15.0 s). Then start again, fix the Studio at 24 s, and
confirm the countdown resets and the game continues past 35 s.

**Acceptance Scenarios**:

1. **Given** the briefing is shown, **When** the player presses Start, **Then** the simulation
   clock starts at 0.0 s and packets flow; nothing moves before Start.
2. **Given** the Studio is over 80% at 20.0 s, **When** no fix is made, **Then** a countdown from
   15 s is visible and the game ends at 35.0 s with "Survived 0:35".
3. **Given** the countdown is running, **When** the player pauses, **Then** the clock, the
   countdown and income all stop; every action remains available.
4. **Given** the player buys a second Studio uplink (40 credits) while spilling, **When** the
   next simulation step runs, **Then** the Studio is at 42% or below, the countdown resets to 0,
   and the status panel says why the fix worked.
5. **Given** the player has fewer credits than an upgrade costs, **When** they view that action,
   **Then** it is disabled and says how many more credits are needed.

---

### User Story 2 - The network grows, and new concepts arrive on the way (Priority: P2)

As time passes, devices are added, demand rises and new access switches appear: a Lobby with
Wi-Fi 7 access points (5G ports), render servers (10G ports) in the Studio, an atrium full of
access points that pushes aggregation past 80%, and a new wing. The first time a new concept
matters (device-port speed, aggregation), play pauses and a short notice explains it. After the
authored opening, endless growth waves keep raising demand until even 25G switches and 2 × 100G
aggregation cannot cope.

**Why this priority**: This delivers the "organic growth" and "device type sizing" outcomes and
keeps the score meaningful.

**Independent Test**: Let the timeline run while fixing everything instantly (test mode or
scripted actions). Confirm each event happens at its authored time, every access switch always
has at least 3 device types, notices pause play, and growth eventually exceeds the largest
possible design.

**Acceptance Scenarios**:

1. **Given** 60.0 s is reached, **When** the Lobby switch is added with 4 Wi-Fi 7 APs on a
   1G-class switch, **Then** play pauses with a notice explaining device-port speed, and the
   Lobby shows "port too slow".
2. **Given** any moment of play, **When** the topology is inspected, **Then** every access switch
   has at least 3 different device types.
3. **Given** the authored timeline has ended, **When** each 30-second growth wave arrives,
   **Then** demand rises by 10% (capped at each device's port speed) and devices are added
   deterministically.

---

### User Story 3 - Honest results and help (Priority: P3)

A stuck player can ask for a hint about the current worst problem (a method, then the specific
switch). When the game ends, a summary shows survival time, what finally failed and why, credits
earned and spent, upgrades bought, and hints used, with hints shown separately from the score.
The player can restart after confirming.

**Why this priority**: Supports learning and honest reporting (C2, C3); the core loop works
without it.

**Independent Test**: Use a hint, lose, and confirm the summary lists the hint as assistance and
names the failing switch and reason; restart and cancel, then restart and confirm.

**Acceptance Scenarios**:

1. **Given** something is spilling, **When** the player asks for a hint, **Then** the first hint
   gives a method and the second names the worst switch, its value and the kind of fix; both are
   counted as assistance.
2. **Given** the game has ended, **When** the summary is shown, **Then** it shows survival time,
   cause, credits earned, credits spent, upgrades, hints used, and the best time this session.
3. **Given** Restart is pressed, **When** cancelled, **Then** nothing changes; **When**
   confirmed, **Then** a new game starts paused on the briefing with the budget and timeline
   reset.

---

### Edge Cases

- Exactly 80% passes, anything above fails (unchanged from 001).
- A device on a port faster than its switch supports counts as spilling.
- The countdown reaches 15.0 s on the same step a fix is applied: the fix takes effect first,
  so the game continues if the network is then healthy.
- Credits never go negative; an unaffordable action is disabled, never partially applied.
- Removing an uplink is allowed, free, and gives no refund.
- A wave cannot add devices beyond a switch's 48 ports; extra devices are skipped.
- The tab becomes hidden: play auto-pauses.
- Reduced motion: packets don't animate; a static per-switch view and all numbers remain.
- Invalid scenario data (e.g., a switch with fewer than 3 device types): the game shows a
  content error and does not start.

## Requirements *(mandatory)*

### Technical Model

Unchanged from 001 unless stated. Rules of thumb: ≈20:1 access → distribution, ≈4:1
distribution → core (Cisco HA campus guide). Grading rule (this game's own): a switch and its
uplinks pass when the busier direction is at or below 80% of active uplink capacity; a device on
a too-slow port fails. Switch classes: 1G (4 × 10G uplinks, 1G ports), nbase-t (4 × 25G, 10G
ports), 25G (2 × 100G, 25G ports; the only aggregation class). 48 device ports per switch.

- **New, game economy (not a networking claim)**: credits are earned from delivered traffic and
  spent on upgrades. Prices are illustrative, not real equipment prices.
- **Device types**: laptop (■), workstation (▲), camera (◆), Wi-Fi 7 AP (●, 5G port), render
  server (⬢, 10G port). Demand values are illustrative.
- **Excluded**: as 001 (QoS, latency, bursts, buffering, TCP, redundancy, routing, wireless,
  core capacity, WAN, aggregation port counts). Cost is now included only as the game economy.

### Functional Requirements

**Simulation and ending**

- **FR-101**: The game MUST run on a simulation clock that advances in fixed 0.25 s steps,
  independent of frame rate, and only while running (not paused, not ended).
- **FR-102**: After each step, a switch is **spilling** if its busier direction exceeds 80% of
  its active uplink capacity, or any of its devices needs a faster port than the switch has.
  The network is spilling if any switch is.
- **FR-103**: A spill countdown MUST increase by 0.25 s for each step that ends spilling and
  reset to 0 after any step that ends healthy. When it reaches 15.0 s, the game ends.
- **FR-104**: The score MUST be the simulation time at the end of the game, shown as m:ss.
  Hints MUST NOT change the score; they are reported separately.
- **FR-105**: While the countdown runs, the game MUST show it ("Spilling: 11 s left") and name
  the cause of each spilling switch with values, in text.

**Budget**

- **FR-110**: The game starts with 100 credits. At each whole simulation second, it MUST add
  floor(delivered ÷ 2,000) credits, where delivered is the total downstream demand (Mbps) of
  access switches that are not spilling, or 0 if aggregation is spilling.
- **FR-111**: Adding uplinks MUST cost the class's uplink price per added uplink (1G 40;
  nbase-t 80; 25G 200). Replacing a switch MUST cost the new class's price (1G 100; nbase-t
  300; 25G 800) plus its uplink price for each uplink beyond the first. Removing uplinks is free
  with no refund.
- **FR-112**: An action MUST be disabled when unaffordable, showing the shortfall. Credits MUST
  never go negative.
- **FR-115** *(change request 2026-11-17)*: The player MUST be able to split an access switch
  into two. The split costs the switch's class price and adds a new switch of the same class
  with 1 uplink, labelled "<name> B", directly after the original. For each device type the new
  switch takes floor(n ÷ 2) devices and the original keeps the rest (and its uplinks). A split
  MUST be refused, with the reason shown, if either half would have fewer than 3 device types,
  if 2 splits have already been made, or if it is unaffordable. Split switches MUST NOT count
  toward the 4-switch limit that governs scripted and wave growth, and later events that add
  devices to the original switch still add them to the original.

**Play and controls**

- **FR-120**: The game MUST start paused on the briefing; Start begins the clock.
- **FR-121**: Pause/Resume MUST be available at all times by button and the **P** key. Pausing
  stops the clock, countdown and income. The game MUST auto-pause when the tab is hidden.
- **FR-122**: All upgrades (action card and side-panel controls, as in 001 FR-010/FR-010a) MUST
  apply instantly when bought, whether paused or running, and take effect from the next step.
- **FR-123**: The diagram, numbers, packets and queues MUST always show the current network.

**Growth**

- **FR-130**: Growth MUST follow an authored timeline in the scenario data: events at stated
  simulation times that add devices, add access switches, or change a device type's demand.
- **FR-131**: After the last authored event, growth waves MUST arrive every 30 s: every device
  type's demand rises 10% (rounded to whole Mbps, capped at its port speed), and each access
  switch gains 2 laptops, 1 workstation and 1 camera, within its free ports. Every third wave
  adds a new access switch if there are fewer than 4.
- **FR-132**: Every access switch MUST have at least 3 different device types at all times,
  including at the start, after every event and in every wave template. The content validator
  MUST check this.
- **FR-133**: The first event that introduces a concept (device-port speed; aggregation) MUST
  pause play and show a notice explaining it, with a source where it states a networking rule.
- **FR-134**: Growth MUST be deterministic: the same scenario and the same player actions at
  the same simulation times MUST produce the same result and score.

**Help, results, access**

- **FR-140**: Hint MUST give a method first, then the worst spilling switch, its value and the
  kind of fix (more uplinks, a different class, or aggregation). Each use counts as assistance.
- **FR-141**: The end-of-game summary MUST show survival time, cause (switch, direction or port,
  values), credits earned and spent, upgrades bought, hints used, and the best time this session.
- **FR-142**: Restart MUST require confirmation; cancel changes nothing. Reload starts fresh.
- **FR-143**: Carried over from 001: the action card (FR-010a), packet encoding (FR-011),
  arrival queues (FR-011b), text table, keyboard operation, reduced-motion static view, narrow
  layout, and self-contained static files (FR-024–FR-027).
- **FR-144**: Scenario content (devices, classes, prices, economy, timeline, waves, notices,
  hints, messages, sources) MUST be editable data, validated before the game starts.

### Key Entities

- **Scenario**: catalog (switch classes with prices, device types with shape), economy, rules
  (step, spill limit, max switches), start topology, briefing, timeline, wave rules, messages,
  sources.
- **Timeline event**: time, title, optional notice and concept, devices to add, switches to add,
  demand changes.
- **Simulation state**: time, running/paused/ended, network configuration, current device
  demands, credits (earned/spent), spill countdown, next event and wave, log of purchases and
  hints.
- **Purchase**: time, switch, from → to (class and uplinks), cost.
- **Result**: survival time, cause, totals, assistance.

## Success Criteria *(mandatory)*

- **SC-101**: Doing nothing ends the game at exactly 35.0 s (hand-checked).
- **SC-102**: A reference "fix the worst affordable problem after 4 s" player survives
  between 3 and 8 minutes (engine result: 345 s, failing at aggregation after 11 purchases), and no player can survive indefinitely.
- **SC-103**: 100% of hand-checked cases pass: spill countdown and reset, game-over timing,
  income, prices, shortfall, wave arithmetic, the ≥ 3-device-type rule, and determinism (same
  action log, same score).
- **SC-104**: A keyboard-only player can start, pause, upgrade and restart without a pointer.
- **SC-105**: After a loss, a teammate can say from the summary alone what failed and why.

## Assumptions

- Economy numbers were tuned with a model player (research S2); they are game balance, not
  networking truth.
- Session is in-memory only; the best time lasts until reload.
- Feature 001's hand-computed evaluator cases still apply to the per-switch rule.
