# Contract: Domain evaluator

Module: `engine/rules.js`. Pure: no DOM, timers, randomness, network, or session mutation (FR-006, C6).

```text
evaluate(catalog, round, committed, design) → EvaluationResult
```

- `catalog`: `{ switchClasses, deviceTypes }` (validated content)
- `round`: validated Round
- `committed`: the design currently on screen (round start or last submission — research R8)
- `design`: the player's changes to apply on top of `committed`

## Result

```text
{
  status: "correct" | "incorrect" | "invalid-input" | "content-error",
  reasonCode: string,           // primary, stable (table below)
  components: ComponentResult[],// see data-model.md; empty for invalid-input / content-error
  violations: string[],         // switchIds failing capacity or port checks, worst first
  efficiencyNotes: string[],    // switchIds changed although not violating at round start
  guidance: string | null       // only for invalid-input
}
```

## Algorithm

1. **Input check** → `invalid-input` if: no changes vs. `committed` (`no-change`); unknown
   switch (`unknown-switch`); class not allowed in that tier (`class-not-allowed`); uplinks out
   of range (`uplinks-out-of-range`, guidance names the class maximum and that more bandwidth
   needs another class); a class change in a round whose `allowedUpgrades` lacks `replace`
   (`upgrade-not-allowed`). No attempt is counted (FR-018).
2. **Apply** `design` over `committed` → evaluated topology.
3. **Per access switch**, per direction: `load = Σ count × demand`; `cap = uplinks × uplinkMbps`;
   `ok = max(up, down) × 100 ≤ 80 × cap`; `portIssues` = device types with
   `portMbps > class.maxPortMbps`.
4. **Aggregation**: load = Σ access loads per direction; same capacity test.
5. **Status**: `correct` if every component is `ok` with no `portIssues`; otherwise `incorrect`.
6. **Efficiency notes** (correct or incorrect): every switch changed from round start that had
   no violation at round start (FR-005).
7. **Primary reasonCode** (first match):

| reasonCode | When | Explanation must include |
| --- | --- | --- |
| `fits` | correct, no efficiency notes | each changed component: before → after utilization |
| `fits-overprovisioned` | correct, with efficiency notes | as above + list of unnecessary upgrades |
| `device-port-unsupported` | a port issue exists | device type, its port speed, class max port speed |
| `upgraded-non-bottleneck` | incorrect and every changed switch was not violating at start | the still-violating switch, its utilization, that the upgraded one was not the bottleneck |
| `uplinks-maxed-need-class` | a violating access switch is at `maxUplinks` of its class | demand, max capacity at 80%, a class that would fit |
| `undersized-class` | a violating switch was replaced with another class | demand vs. 80% of new capacity |
| `over-capacity` | any other violation | switch, direction, load, capacity, utilization |

`content-error` is produced only by `engine/content.js` before a round is shown. `evaluate`
assumes validated content.

## Required test cases (hand-computed, recorded independently — SC-002)

For every shipped round: (a) reference solution → `correct`; (b) start + a non-bottleneck
upgrade → `incorrect/upgraded-non-bottleneck`; (c) a design at exactly 80% → passes; (d) the same
+1 Mbps of demand → fails. Plus one fixture per reasonCode and per invalid-input code.
