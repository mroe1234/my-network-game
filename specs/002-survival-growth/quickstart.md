# Quickstart & Validation: Capacity Flows — Survival Growth

Run from the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

Game: http://127.0.0.1:8000/ · Tests: http://127.0.0.1:8000/tests/

Record each check as pass / fail / not run in the README Verification table (C7).

## V1 · Automated tests

`/tests/` shows totals and failed IDs; zero tests is a failure. Suites: rules (001 evaluator
cases), scenario (one broken fixture per rule, including every ≥ 3-device-type case), sim
(hand-computed: idle loss at 35.0 s, reset on fix, last-moment save, income, prices,
shortfall, waves, determinism, greedy reference player 3–8 min).

## V2 · Core loop (US1)

1. Read the briefing (rules, prices, 15-second rule, pause) and press Start: 0:00, 100 credits.
2. At 0:20 the Studio spills: "Spilling: 15 s left" and the status names 84.1% downstream.
3. Press **P**: the clock and countdown stop. Select the Studio, buy "+ uplink (40 cr)".
4. Resume: "Healthy", and "Fixed: Studio switch is now at 42%".
5. Do nothing from a fresh start: the game ends at exactly 0:35.

## V2a · Split a switch (FR-115)

At 0:01 open the Studio's card and press "Split into two switches (100 cr)": "Studio switch B"
appears with 5 workstations, 4 laptops and 2 cameras; the 0:20 hires no longer spill. The Office
card then shows the split's shortfall.

## V3 · Growth (US2)

1. 0:45 the Office spills (90.9%); the quick "+ uplink" in the switch list fixes it.
2. 1:00 play pauses on the device-port-speed notice; focus moves to it; the Lobby shows "port
   too slow"; the HUD shows "Spilling: 15 s left (paused)".
3. Replace the Lobby with nbase-t (300 cr) once affordable; a shortfall is shown until then.
4. 2:00 the aggregation notice pauses play. Every switch always shows ≥ 3 device types.

## V4 · Help and results (US3)

1. Hint shows a method, then the worst switch and the kind of fix.
2. On a loss the summary shows survival time, cause, credits earned/spent, upgrades, best this
   session, and hints used (separate from the score).
3. Restart → Cancel keeps playing; Restart → OK returns to the briefing with a fresh game.
4. Switch tabs: the game auto-pauses.

## V5 · Access and motion

Keyboard only (Tab, Enter/Space, P); reduced motion (static view, all numbers remain); 360 px
width; colour never the only cue (shape, lane, text).
