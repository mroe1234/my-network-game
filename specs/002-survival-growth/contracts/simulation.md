# Contract: Simulation (`engine/sim.js`)

Pure module: no DOM, timers or randomness. Mutates and returns the `game` object it is given
(callers clone for tests or replays).

```text
createGame(scenario) → Game               status 'briefing', t = 0, credits = startCredits
start(game) → Game                         briefing → running
pause(game) / resume(game) → Game          resume also clears a pausing notice
step(game) → Game                          one 0.25 s step; no-op unless running
priceOf(game, switchId, change) → { cost, ok, shortfall, reason }
buy(game, switchId, change) → { ok, cost, reason }   applies instantly if affordable
evaluateNetwork(game) → ComponentResult[]   current network (rules.js computeComponents)
splitPriceOf(game, switchId) → { ok, cost, reason, shortfall?, moved? }
splitSwitch(game, switchId) → { ok, cost, newSwitchId, reason }   research S7, FR-115
useHint(game) → { method, detail }          increments hintsUsed
replay(scenario, actions, until) → Game     actions: [{ t, type: 'buy'|'hint'|'pause'|'resume', ... }]
```

## Step order

See [research S1](../research.md): apply due events and waves → evaluate → countdown → advance t
→ income at whole seconds → end if countdown ≥ spill limit.

## Pricing

- Same class, more uplinks: (new − old) × class.uplinkPrice.
- Same class, fewer or equal uplinks: 0 (no refund).
- Different class: new class.price + (uplinks − 1) × new class.uplinkPrice.
- `ok` is false if the change is invalid (unknown switch, class not allowed in the tier, uplinks
  out of range, no change) or unaffordable (`shortfall` = cost − credits).

## Waves (from `waves.startAt`, every `waves.every`)

1. For each device type: up = min(port, round(up × (100 + growthPct) ÷ 100)); same for down.
2. For each access switch in order: add each `addPerSwitch` entry, limited by free ports.
3. If waveCount is a multiple of `newSwitchEvery` and switches < max: add `newSwitchTemplate`
   with id `wave-switch-{n}` and label `{n}` replaced by the switch's number.

## Required hand-computed cases

Idle game ends at 35.0 s; a fix at 24.0 s resets the countdown; a fix on the step the countdown
would hit 15 saves the game; income at t = 1 is floor(9 820 ÷ 2 000) = 4; prices for uplinks,
class changes and refunds; a shortfall is reported and nothing is applied; wave 1 arithmetic;
port-limited additions; replaying an action log gives the same score.
