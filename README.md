# Capacity Flows

**Keep the packets flowing for as long as you can: find the real bottleneck in a growing campus
network and fix it within your budget before it spills for 15 seconds.**

Capacity Flows is a browser game for junior network engineers. You play as Bobby Bits, the
network engineer for a campus network that never stops growing. Devices keep arriving and
demand keeps rising. You earn credits for the traffic you deliver and spend them on uplinks and
bigger switch classes. If any part of the network spills for 15 seconds in a row, the game ends,
and your score is how long you survived.

A project from **NAF AC6 — Loop Engineering, Spec-Driven Development & the Future of VibeOps**.

| Project | Details |
| --- | --- |
| Status | Playable; automated checks pass; manual accessibility and play-time checks not yet run (see Verification) |
| Networking topic | Campus capacity planning: uplink sizing, switch-class (port-speed) sizing, aggregation, oversubscription |
| Typical session | A reference player survives about 5:45; every game eventually ends |
| Live demo | Not published yet |
| Built by | Munroe Sollog, with Claude Code |

The canonical spec and plan are in `specs/002-survival-growth/`, which supersedes
`specs/001-capacity-flows-game/` (the first, round-based build). The root `SPEC.md`, `PLAN.md`
and `CONSTITUTION.md` are the workshop planning inputs, kept in sync.

## The challenge

You start with two access switches, the Studio and the Office, each serving at least three
kinds of device. At 0:20 the Studio hires eight video editors: 8,408 Mbps downstream on one
10,000 Mbps uplink, or 84%. Packets spill, and a 15-second countdown starts. Pause, buy a second
uplink for 40 credits, and the countdown resets. Then video calls go company-wide, a Lobby opens
with Wi-Fi 7 access points that need 5G ports, render servers arrive with 10G ports, an atrium
full of access points pushes aggregation past 80%, and a new wing opens. After that, growth
waves keep coming until even the biggest switches can't keep up.

## What you'll learn

| By the end, you can… | You'll practice by… |
| --- | --- |
| Calculate the load on an uplink from the devices behind it (LO1) | Reading device counts and per-device demand, and comparing the busier direction with 80% of uplink capacity |
| Identify the true bottleneck | Watching which switch spills and spending credits only where it helps |
| Choose the right switch class (LO2) | Replacing a switch when device ports are too slow or its uplinks are maxed out |
| Plan for growth within a budget | Watching the arrival queues and saving credits for the next expansion |

**Before playing:** interface types and speeds, and basic QoS concepts. The briefing teaches
the rest, and play pauses to explain each new concept the first time it matters.

## Play locally

Clone or download this repository and open a terminal in the project root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows: `py -m http.server 8000 --bind 127.0.0.1`. Open **http://127.0.0.1:8000**. Keep the
terminal running; **Ctrl+C** stops the server. Use the server URL rather than opening
`index.html` directly, because the game loads JavaScript modules and JSON over HTTP.

## How to play

1. Read the briefing and press **Start**. The clock runs; nothing moves before that.
2. Watch the status panel. Whenever a switch spills it says which one, why, and by how much, and
   the HUD shows "Spilling: N s left".
3. Press **P** (or the Pause button) whenever you want to think. The clock, countdown and income
   stop, and you can still buy anything.
4. Click a switch, its uplinks or its devices (or Tab to it and press Enter) to open its card:
   **+ / − uplink**, pick a class and **Replace**, or **Split** the switch into two (about half
   of each device type moves to a new switch of the same class). The switch list has quick
   "+ uplink" buttons. Every action shows its price; anything you can't afford shows how many credits you
   still need.
5. Fix every problem to reset the countdown. Spill for 15 seconds in a row and the game ends.

| Control | Action |
| --- | --- |
| P / Pause button | Pause or resume (the tab also auto-pauses when hidden) |
| Click / Tab + Enter on a diagram item | Open that switch's card: values, devices, + / − uplink, Replace, Split |
| Switch list | Status of every switch, quick "+ uplink", Details |
| Hint | A method, then the worst current problem and the kind of fix; counted as assistance |
| Restart (header) | Asks for confirmation; Cancel keeps playing |

**Score and progress:** your score is survival time on the game clock (pauses don't count).
The summary also shows the cause of the loss, credits earned and spent, upgrades bought, the
best time this session, and hints used. Hints are shown separately and don't change the score.
Growth is identical every game, so scores are comparable. Reloading starts fresh; nothing is
saved.

**Reading the diagram:** packet **shape** is the device type (● access point, ▲ desktop
workstation, ⬢ server, ■ laptop, ◆ camera). **Colour** is direction: blue toward the device,
purple from the device. **Shade** is how full the link is, darkest at the 80% limit. Spilling
packets peel off and fade. Under each device group, an **arrival queue** shows the demand about
to enter the network, with devices that just arrived outlined. Queues show offered load only;
buffering isn't modelled.

## What this game models

| Class | Device ports up to | Uplinks | Price (credits) |
| --- | --- | --- | --- |
| 1G access switch | 1G | up to 4 × 10G | 100, then 40 per extra uplink |
| nbase-t access switch | 10G (multigigabit) | up to 4 × 25G | 300, then 80 per extra uplink |
| 25G switch (the only aggregation class) | 25G | up to 2 × 100G | 800, then 200 per extra uplink |

- **Grading rule (this game's own, not from the sources):** a switch and its uplinks are healthy
  when the busier direction is at or below 80% of active uplink capacity (whole Mbps, so exactly
  80% passes). A device whose port is faster than its switch supports is spilling.
- **Splitting:** costs the switch's class price; the new switch has 1 uplink and takes half of
  each device type (rounded down). Both halves must keep at least 3 device types; up to 2 splits
  per game. Aggregation still carries the same total.
- **Economy (game balance, not real prices):** 100 starting credits; each second you earn 1
  credit per 2,000 Mbps of downstream traffic delivered by healthy access switches, or nothing if
  aggregation spills. Removing uplinks is free but not refunded.
- **Growth:** a scripted timeline for the first 3 minutes, then a wave every 30 s: demand +10%
  (capped at port speed) and +2 laptops, +1 workstation, +1 camera per switch (within 48 ports).
- **Rules of thumb taught:** about 20:1 oversubscription from access ports to access uplinks, and
  about 4:1 from aggregation (distribution) to core.

**Outside the model:** QoS queuing, latency, jitter, bursts and buffering; TCP; redundancy,
link-aggregation failover and spanning tree; routing; wireless; core capacity; WAN links;
aggregation port counts; real equipment prices. A device on a too-slow port is treated as
spilling rather than negotiating down.

| Reference | What it supports |
| --- | --- |
| Cisco, *Campus Network for High Availability Design Guide*, Design Best Practices, QoS congestion figure ("Typical 20:1 data oversubscription", "Typical 4:1 data oversubscription") — https://www.cisco.com/c/en/us/td/docs/solutions/Enterprise/Campus/HA_campus_DG/hacampusdg.html | The ≈20:1 and ≈4:1 rules of thumb |
| Cisco, *Catalyst 9300 Series Switches Data Sheet*, network module (uplink) options — https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html | Multigigabit access ports and 10G/25G/100G uplink options (the game's classes are generic) |

## How it was built

The project follows the workshop's Spec Kit workflow (constitution → specify → clarify → plan →
tasks → analyze → implement). The survival redesign required a recorded MAJOR constitution
amendment (v2.0.0), because the original C3 forbade countdowns and timed scoring.

- **Stack:** HTML, CSS and native JavaScript modules; SVG diagram. No dependencies, backend, AI
  model or API key.
- **Code:** `engine/sim.js` (fixed 0.25 s step simulation: growth, budget, spill countdown,
  replay), `engine/rules.js` (per-switch 80% / port rule), `engine/content.js` (scenario
  validation, replaying the timeline), `engine/feedback.js`, `ui/` (diagram, action card, packet
  flow, shapes), `data/scenario.json` (all content, prices and timing), `tests/`.
- **Artifacts:** `.specify/memory/constitution.md` (v2.0.0); `specs/002-survival-growth/`
  (spec, plan, research, data model, contracts, quickstart, tasks); `specs/001-capacity-flows-game/`
  (superseded first build).
- **One useful design decision:** without a cost, the best strategy was to max out every switch
  in the first second. A budget fixes that, but the first version stopped income while anything
  spilled, which created a death spiral. A model player showed that paying only for *delivered*
  traffic keeps early choices tight without trapping the player (research S2).

## Verification

**Last checked:** 2026-11-17, macOS, Google Chrome 157 (headless), uncommitted working tree.
Run the server and open **http://127.0.0.1:8000/tests/**.

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Per-switch rule, scenario validation, simulation (V1) | Pass | `tests/`: 75/75 (including split cases). Includes idle loss at exactly 35.0 s, reset on fix, last-moment save, income, prices, shortfall, wave arithmetic, port limits, determinism, and the ≥ 3-device-type rule at the start, after every event and for 6 waves |
| Reference greedy player (SC-102) | Pass | Survives 345 s (5:45), fails at aggregation after 11 purchases; idle player 35 s |
| Core loop, split, growth, help, results (V2–V4) | Pass (automated) | Survival click-through: 37/37 under normal and reduced motion: start, spill and countdown, P pause, buy while paused, reset and "Fixed" message, quick actions, notice pauses and takes focus, shortfall, replace, hint, game over at 1:45 with cause and totals, restart cancel/confirm, auto-pause when hidden |
| Packet animation | Pass (stepped frames) / real-time not run | Headless Chrome on macOS has no display link, so the game's frame loop was driven by hand. Watching it in a real browser still needs a person |
| Reduced motion | Pass (automated) | Static view; all numbers and the countdown remain |
| Results readable without colour | Pass (inspection) | Every status is also text; packets also differ by shape and lane |
| Keyboard-only full game (SC-104) | Not run | Needs a person |
| Screen-reader pass | Not run | Not claimed |
| Narrow layout, 375 px | Pass (screenshot) | HUD wraps and stays pinned at the top with the countdown and Pause; diagram scrolls in its own box; legend wraps. On narrow screens the status panel sits below the diagram |
| Teammate explains a loss from the summary (SC-105) | Not run | Needs a person |
| Real first-play survival time | Not run | Needs a first-time player |
| Briefing and notices checked against sources | Pass, with 2 open items | Cisco campus guide section heading to confirm by eye; Catalyst 9300 data sheet section heading not verified |

## Known limitations and next steps

- **Limitation:** late in a game credits pile up (the reference player ends with about 9,800
  unspent), so the budget mainly shapes the first three minutes.
- **Limitation:** the 80% threshold and all prices are the game's own rules.
- **Next improvement:** scale prices or income with network size so the budget stays a real
  constraint in the endless phase.

## Credits

Created by Munroe Sollog. Workshop by John Capobianco, Joksan Flores, and Elliot Conner. Adapted
from the [NAF AC6 workshop materials](https://github.com/automateyournetwork/NAF_AC6) and
[Networking Video Game Starter Kit](https://github.com/automateyournetwork/NetworkingVideoGameStarterKit),
using [GitHub Spec Kit](https://github.com/github/spec-kit).

**Assets and dependencies:** original code and SVG drawn at runtime; no third-party assets or libraries.

**License:** [MIT](LICENSE).
