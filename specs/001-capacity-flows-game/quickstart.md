# Quickstart & Validation: Capacity Flows — First Playable

Use this guide to run the game and prove it meets the spec. Record each check as **pass / fail /
not run**, with date, browser, and evidence, in the README "Verification" section (C7).

## Prerequisites

- A current desktop browser (Chrome, Firefox, Safari, or Edge).
- Python 3, used only as a local static file server.

## Run

From the repository root:

```sh
python3 -m http.server 8000 --bind 127.0.0.1
```

- Game: http://127.0.0.1:8000/
- Tests: http://127.0.0.1:8000/tests/

Opening `index.html` with `file://` is not supported; modules and JSON loading need HTTP.

## V1 · Automated checks (tests page)

Expected: a visible summary with total, passed, failed, and failed case IDs. Zero discovered tests
is reported as a failure.

| Suite | Proves | Spec |
| --- | --- | --- |
| rules | per-round reference = correct; non-bottleneck upgrade = incorrect; exactly 80% passes, +1 Mbps fails; each reasonCode ([evaluator](./contracts/evaluator.md)) | FR-003–006, FR-004a, SC-002–004 |
| content | every rejection rule in [level-data](./contracts/level-data.md) produces a content error naming the level/round; the shipped file validates | FR-014, FR-023, FR-028 |
| state | invalid input does not count; repeated Submit is a no-op; hints/solution count as assistance only; Next/Restart/cancel transitions | FR-017–022 |

## V2 · Core round (User Story 1)

1. Start the game, read the Level 1 briefing, and press Start.
2. Without selecting anything, press Submit → guidance appears and the attempt count stays 0.
3. Add uplinks only on a switch that is **not** over 80%, then Submit → incorrect; the explanation
   names the bottleneck and its utilization; the round stays open; attempts = 1.
4. Add uplinks on the bottleneck switch, then Submit → correct, the flow shows all packets
   delivered, and Next is enabled. Press Submit again → nothing changes.
5. Click (or Tab to and press Enter on) the Studio switch in the diagram: an action card shows
   its values and devices. "+ uplink" plans a change (shown as "planned"; attempts unchanged).
   Click the core: it explains that the core is fixed. Packets: shape = device type (▲
   workstation, ● access point), colour = direction (blue toward the device, purple from it),
   shade = how full the link is (the 84% Studio uplink is darker than aggregation at 16.4%). Under each device group an arrival queue shows
   the demand waiting to enter; in round 2 the 20 new workstations appear as outlined ▲ labelled
   "new this round".
6. (SC-005) Show the explanation from step 3 to a teammate who hasn't seen the round. Pass if they
   can say, from the text alone, which switch was the bottleneck and why the chosen upgrade did
   not help. Record their answer.

## V3 · Device sizing and growth (User Story 2)

1. Reach a Level 3 round. Its intro says the network starts from the previous reference design.
2. Max out uplinks on the over-capacity 1G-class switch → incorrect (`uplinks-maxed-need-class`).
3. Replace it with the nbase-t class → correct; the explanation shows demand, new capacity, and
   utilization.
4. In a round with multigigabit devices on a 1G-class switch, confirm
   `device-port-unsupported` is explained by name and speed.

## V4 · Help and honest progress (User Story 3)

1. Open hint 1 (method), then hint 2 (worked step); attempts are unchanged.
2. View the worked solution, then solve; the summary shows the round as completed with assistance.
3. Restart → Cancel: nothing changes. Restart → Confirm: Level 1 briefing, all counts cleared.
4. Reload the page → fresh session.

## V5 · Access, layout, motion (FR-024, FR-025)

- Keyboard only (Tab, Shift+Tab, Enter, Space, arrow keys in selects): complete the full session
  with visible focus throughout (SC-006).
- Results read correctly with color ignored (text states pass/fail and values).
- The topology text table lists every link with capacity, up/down load, and utilization.
- At 360 px width the topology scrolls in its labeled container; Submit, Hint, and Next stay
  visible.
- With OS reduced motion on, no packet animation plays; a static before/after view appears and
  feedback is immediate.

## V6 · Self-contained and truthful (SC-007, C1)

- DevTools Network tab: after load, only same-origin static files are requested.
- Every briefing rule shows a source (title, link, section). The README lists simplifications
  and exclusions from the spec's Technical Model.
- The 3:1 vs 4:1 ratio item in [research.md](./research.md) R1 is resolved before release.

## V7 · Timing (SC-001)

- A first-time tester completes all six rounds in 5–10 minutes. Record the actual time.
