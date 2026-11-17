# Contract: Scenario data (`data/scenario.json`)

Shape and field rules: [../data-model.md](../data-model.md) › Scenario. Validated in full by
`validateScenario(doc)` in `engine/content.js` before the game starts (FR-144):

```text
validateScenario(doc) → { ok: true, scenario } | { ok: false, errors: [{ path, eventId?, message }] }
```

Rejected (content-error screen, game does not start):

1. Structure: wrong `schemaVersion` (≠ 2), missing or mistyped fields, duplicate ids, dangling
   references (source, class, device type, switch).
2. Catalog: not exactly 3 classes; a non-positive price; an unknown shape; demand > port speed.
3. Device mix: any access switch with fewer than `rules.minDeviceTypesPerSwitch` device types,
   at the start, after any timeline event (replayed), or in the wave template.
4. Growth: event times not strictly ascending or not multiples of the step; more than 48
   devices on a switch after an event; more than `rules.maxAccessSwitches` switches; a concept
   event with no notice; `waves.startAt` not after the last event.
5. Text: a missing hint or message key.
