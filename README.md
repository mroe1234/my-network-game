# Capacity Flows

**Keep the packets flowing: find the real bottleneck in a campus network and size the fix.**

Capacity Flows is a browser game for junior network engineers. You play as Bobby Bits, the
network engineer for a growing three-tier campus network, deciding which switches need more
uplinks or a bigger switch class so that no part of the network runs above 80% utilization. Each
round explains the result with the actual numbers, so you can use what you learned on the next,
larger network.

A project from **NAF AC6 — Loop Engineering, Spec-Driven Development & the Future of VibeOps**.

| Project | Details |
| --- | --- |
| Status | Playable; automated checks pass; manual accessibility and play-time checks not yet run (see Verification) |
| Networking topic | Campus capacity planning: oversubscription, uplink sizing, switch-class (port-speed) sizing |
| Typical session | Target 5–10 minutes for 6 rounds (not yet measured with a player) |
| Live demo | Not published yet |
| Built by | Munroe Sollog, with Claude Code |

The canonical specification and plan are in `specs/001-capacity-flows-game/`. The root
`SPEC.md`, `PLAN.md` and `CONSTITUTION.md` are the workshop planning inputs, kept in sync with it.

## The challenge

In the first round, the Studio switch has 21 video-editing workstations at 400 Mbps downstream
each: 8,400 Mbps on a single 10,000 Mbps uplink, or 84%. Packets visibly spill there. Next door,
the Edit suite switch is at exactly 80% (20 × 400 = 8,000 Mbps), which still passes. You choose
how many uplinks each switch uses and submit. Adding uplinks to the Edit suite does nothing for
the Studio and the game says so. A second Studio uplink (8,400 ÷ 20,000 = 42%) fixes it.

Later rounds add Wi-Fi 7 access points with 5G ports, which a 1G switch can't serve however many
uplinks it has. Then an atrium full of APs pushes the aggregation uplinks to the core over the
limit too.

## What you'll learn

| By the end, you can… | You'll practice by… |
| --- | --- |
| Calculate the load on an uplink from the devices behind it (LO1) | Multiplying device counts by per-device demand in each direction and comparing the busier direction with 80% of uplink capacity |
| Identify the true bottleneck and see that upgrading anything else doesn't help | Submitting a design and reading which switch is still over the limit |
| Compare switch classes and apply the right one (LO2) | Replacing a switch when device ports are too slow or its uplinks are already maxed out |
| Re-plan as the network grows | Re-checking access and aggregation after each round adds devices |

**Before playing:** interface types and speeds, and basic QoS concepts. Each level's briefing
teaches the rest, with a worked example.

## Play locally

Clone or download this repository and open a terminal in the project root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

On Windows with the Python launcher:

```powershell
py -m http.server 8000 --bind 127.0.0.1
```

Open **http://127.0.0.1:8000** in your browser. Keep the terminal running; **Ctrl+C** stops the
server. If port 8000 is busy, use 8001 in both the command and the URL.

The game loads JavaScript modules and JSON over HTTP, so open it through the server URL, not by
double-clicking `index.html`.
[Why modules need serving](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules).

## How to play

1. Read the briefing: the concept, its terms, a worked example, what the game simplifies, and sources.
2. Inspect the topology and the table: each switch's class, active uplinks, capacity, upstream and
   downstream load, utilization, and the devices behind it.
3. Choose active uplinks for any switch (and, from Level 2, a different switch class), then **Submit design**.
4. Read the explanation. A wrong design leaves the round open to retry; a correct one enables **Next**.
5. Use **Hint** (method first, then a worked step) or **Show worked solution** if you're stuck.
6. Finish 3 levels × 2 rounds to reach the session summary.

| Control | Action |
| --- | --- |
| Uplink / class drop-downs | Plan a change; it shows as "planned" and is not graded until you submit |
| Submit design | Grades the whole design (disabled once the round is solved) |
| Next | Moves to the next round, level summary, or session summary |
| Hint / Show worked solution | Reveals help; recorded as assistance, never as an attempt |
| Restart (header) | Asks for confirmation; Cancel changes nothing, OK returns to the first briefing with progress cleared |
| Keyboard | Tab / Shift+Tab between controls; arrow keys change a drop-down; Enter / Space press buttons |

**Progress:** only a submitted, valid design counts as an attempt. A submission with no change
gets guidance and isn't counted. A round completes only on a correct design, and a repeated
Submit can't count twice. Summaries show completed rounds, valid attempts and assistance as
separate figures. Packets flow all the time, but nothing is timed. Reloading the page starts a
fresh session; nothing is saved.

## What this game models

A three-tier campus network (access → aggregation → core) built from three generic switch classes:

| Class | Device ports up to | Uplinks |
| --- | --- | --- |
| 1G access switch | 1G | up to 4 × 10G |
| nbase-t access switch | 10G (multigigabit) | up to 4 × 25G |
| 25G switch (the only class allowed as aggregation) | 25G | up to 2 × 100G |

- Each device type has a fixed upstream and downstream demand, shown on screen. The values are
  illustrative and deliberately heavy enough to create bottlenecks.
- A switch's load is the sum of the demand of every device behind it, per direction, shared
  evenly across its active uplinks. Aggregation carries the sum of all access switches.
- **Grading rule (this game's own rule, not taken from the sources):** a switch and its uplinks
  pass when the busier direction is at or below 80% of active uplink capacity. Arithmetic uses
  whole Mbps, so exactly 80% passes and 80% + 1 Mbps fails.
- A device whose port is faster than its switch supports is a sizing error. Adding uplinks doesn't fix it.
- Planning rules of thumb taught in the briefings: about 20:1 oversubscription from access ports
  to access uplinks, and about 4:1 from aggregation (distribution) to core. They help you plan;
  the 80% rule decides pass or fail.
- Each round starts from the previous round's reference solution plus the new devices. Your own
  extra upgrades aren't carried over, so every round starts with a real bottleneck.

**Outside the model:** QoS queuing and prioritization; latency and jitter; bursty traffic and
buffering; TCP behavior; redundancy, link-aggregation failover and spanning tree; routing
protocols; wireless; core-tier capacity; upstream WAN/internet links; aggregation port counts;
and cost. Packet "spills" illustrate sustained overload, not real drop mechanics. A device on a
too-slow port is treated as an error rather than modelled as negotiating down.

| Reference | What it supports |
| --- | --- |
| Cisco, *Campus Network for High Availability Design Guide*, Design Best Practices, QoS congestion figure (labels "Typical 20:1 data oversubscription" and "Typical 4:1 data oversubscription") — https://www.cisco.com/c/en/us/td/docs/solutions/Enterprise/Campus/HA_campus_DG/hacampusdg.html | The ≈20:1 (access → distribution) and ≈4:1 (distribution → core) rules of thumb |
| Cisco, *Catalyst 9300 Series Switches Data Sheet*, network module (uplink) options — https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html | That campus access switches of this family offer multigigabit ports and 10G/25G/100G uplink options. The game's classes are generic, not specific models. |

## How it was built

The project follows the workshop's Spec Kit workflow: **constitution → specify → clarify → plan →
tasks → analyze → implement**. The implementation ran as a self-pacing `/loop` of `/speckit-implement`.

- **Stack:** semantic HTML, CSS and native JavaScript modules; SVG for the topology. No framework, bundler or runtime dependencies.
- **Build tools:** Claude Code with GitHub Spec Kit (1.4.2.dev0).
- **Runtime:** static files only. No account, backend, AI model or API key.
- **Planning inputs:** `CONSTITUTION.md`, `SPEC.md`, `PLAN.md` (repository root).
- **Working artifacts:** `.specify/memory/constitution.md` (v1.0.1); `specs/001-capacity-flows-game/`
  (`spec.md`, `plan.md`, `research.md`, `data-model.md`, `contracts/`, `quickstart.md`, `tasks.md`).
- **Code layout:** `engine/rules.js` (pure grading), `engine/content.js` (content validation,
  including a search of every possible design per round), `engine/state.js` (session),
  `engine/feedback.js`, `ui/` (rendering, controls, packet flow), `data/levels.json` (all
  content and fixed wording), `tests/` (browser test runner).
- **One useful design decision:** analysis found that carrying the player's own design into the
  next round, combined with accepting over-provisioned designs, would let a player upgrade
  everything in round 1 and pass every later round without thinking. Each round now starts from
  the previous round's *reference* design, and the content validator checks that relationship.
  Planning also found that with even load sharing, uplink and switch utilization are always equal,
  so switch class needed its own rule. That became the device-port-speed check.

## Verification

**Last checked:** 2026-11-17, macOS, Google Chrome 157 (headless), uncommitted working tree.

Run the server and open **http://127.0.0.1:8000/tests/** for the automated suite. It shows
totals and failed case IDs, and reports zero tests as a failure. The browser click-through
drivers used below were run from a scratch location and are not part of the repository.

| Check | Result | Evidence / notes |
| --- | --- | --- |
| Correct, incorrect and boundary cases (V1, SC-002) | Pass | `tests/`: 98/98. Includes hand-computed cases for all 6 shipped rounds, every reason code, exactly-80% passes and +1 Mbps fails, and the downstream-vs-upstream direction |
| Content validation and rejection rules (V1) | Pass | 1 broken fixture per rule rejected with level/round named; shipped file validates in < 100 ms |
| Core round: empty submit, wrong switch, fix, repeat submit, Next (V2) | Pass (automated) | Click-through driver: 24/24, normal and reduced motion |
| Device sizing, growth, hints, solution, summaries, restart cancel/confirm (V3, V4) | Pass (automated) | Full-session driver: 30/30, normal and reduced motion; totals 6/6 rounds, 10 attempts, 2 assisted rounds |
| Reduced motion (V5) | Pass (automated) | With `prefers-reduced-motion`, no packet animation; static before/after text shown; feedback immediate |
| Narrow layout, 375 px (V5) | Pass (screenshot reviewed) | Topology scrolls in its labeled container; Submit and Next stay visible |
| Results readable without colour (V5) | Pass (inspection) | Every status is also text: OK / OVER 80% / PORT TOO SLOW / "spilling" |
| Keyboard-only full session (V5, SC-006) | Not run | Needs a person: all controls are native elements, but not yet played without a mouse |
| Screen-reader pass | Not run | Not claimed; no accessibility certification |
| Same-origin only (V6, SC-007) | Pass | Chrome net log: every page request went to the local server. The other entries were Chrome's own background update traffic. The code fetches only `data/levels.json`. |
| Briefings and explanations checked against sources (C1, T036) | Pass, with 2 open items | All hint and briefing arithmetic re-checked. Ratios confirmed from the Cisco guide's figure text, but its surrounding section heading wasn't machine-readable, so confirm by eye. Catalyst 9300 data sheet section heading not verified (the page served a landing page to automated fetches). |
| Teammate explains the bottleneck from a wrong-answer message (SC-005) | Not run | Needs a person (quickstart V2 step 5) |
| First-play time 5–10 minutes (V7, SC-001) | Not run | Needs a first-time player |
| Fresh checkout run instructions | Not run | Run from the working tree only |

## Known limitations and next steps

- **Known limitation:** the 80% threshold is the game's own grading rule with no external
  source; the briefing and feedback say so.
- **Known limitation:** keyboard-only, screen-reader, teammate and play-time checks haven't been run.
- **Next improvement:** a third hint level that previews recomputed utilization for a planned
  change, recorded as assistance. This would help learners who are stuck on the arithmetic
  without giving away the answer.

Found an incorrect answer or unclear explanation? Open an issue with the level/round, input
values, your choice, expected result, actual result, and a reference if available.

## Credits

Created by Munroe Sollog. Workshop by John Capobianco, Joksan Flores, and Elliot Conner. Adapted
from the [NAF AC6 workshop materials](https://github.com/automateyournetwork/NAF_AC6) and
[Networking Video Game Starter Kit](https://github.com/automateyournetwork/NetworkingVideoGameStarterKit),
using [GitHub Spec Kit](https://github.com/github/spec-kit).

**Assets and dependencies:** original code and SVG drawn at runtime; no third-party assets or libraries.

**License:** no license file has been added to this repository yet.
