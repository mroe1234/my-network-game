# [Capacity Flows] · First playable specification

## The pitch

**Bobby Bits has to keep the packets flowing through the network.**

The player is Network Engineer in 3 teir campus network. Each round shows ingress and egress traffic and asks the player to upgrade pieces of the network. A correct decision will successfully deliver all packets; an incorrect decision will spill/drop packets. The session ends when all packets have been delivered.

## Who this is for

- **Learner:** Junior Network Engineer.
- **Assumed knowledge:** interface types and speeds, basic QoS concepts.
- **What the briefing teaches:** how to identify bottlenecks and the source of bottlenecks, and the most efficient way to address them.
- **Why interaction helps:** the player will understand that upgrading non-constrained links or devices will not improve user-perceived speed.
- **Session target:** 5–10 minutes for a first playthrough, with unlimited thinking time.

## Learning outcomes and evidence

Use observable verbs such as identify, calculate, order, compare, or diagnose. Replace the rows with your topic's skills.

| ID | After playing, the learner can… | The game asks them to… | Evidence of success |
| --- | --- | --- | --- |
| LO1 | Link Capacity | calculate predicted capacity of link based on end device | link never exceeds 80% utilization|
| LO2 | device type sizing | compare different device types and apply them to the correct situation | device never exceeds 80% capacity |

## The technical model

> The detailed, clarified version of this specification is `specs/001-capacity-flows-game/spec.md`
> (canonical). This section is kept in sync with it.

- **Rule being taught:** understanding oversubscription. Planning rules of thumb: approximately
  20:1 from end-device ports to the access switch's uplinks (access → aggregation), and
  approximately 4:1 from aggregation (also called distribution) to core. *(Earlier drafts said
  1:3 from switch to aggregation; changed 2026-11-17 to match the cited source.)* Grading rule: a
  switch and its uplinks are adequately sized when utilization (load ÷ capacity) in the busier
  direction is ≤ 80%.
- **Context:** Generic switch classes: 1G access switch with 4×10G uplinks (1G device ports);
  nbase-t access switch with 4×25G uplinks (up to 10G device ports); 25G switch with 2×100G
  uplinks (up to 25G ports; the only class allowed as aggregation). 48 device ports each. The
  core is fixed and not graded.
- **Assumptions:** a switch's capacity is its total active uplink bandwidth, shared evenly
  across uplinks. Each device type has a fixed upstream and downstream demand (illustrative
  values). A device whose port is faster than its switch supports is a sizing error. Other
  figures come from the Cisco Catalyst 9300 data sheet and are not graded.
- **Excluded behavior:** QoS queuing and prioritization; latency and jitter; bursty traffic and
  buffering; TCP behavior; redundancy, link-aggregation failover and spanning tree; routing
  protocols; wireless; core-tier capacity; upstream WAN/internet links; aggregation port counts;
  and cost. Packet "spills" show sustained overload, not real drop mechanics.
- **Authoritative references:**
  - Cisco, *Campus Network for High Availability Design Guide*, Design Best Practices, QoS
    congestion figure (labels "Typical 20:1 data oversubscription" and "Typical 4:1 data
    oversubscription"):
    https://www.cisco.com/c/en/us/td/docs/solutions/Enterprise/Campus/HA_campus_DG/hacampusdg.html
  - Cisco, *Catalyst 9300 Series Switches Data Sheet*, network module (uplink) options:
    https://www.cisco.com/c/en/us/products/collateral/switches/catalyst-9300-series-switches/nb-06-cat9300-ser-data-sheet-cte-en.html

Tell the learner about these boundaries in plain language. If two answers can both be valid, define how the game accepts them or remove that ambiguity from the first version.

## The repeatable game loop

1. **Brief:** introduce one concept, its terms, and a worked example different from the challenge.
2. **Inspect:** show topology and packets with all decision-relevant values visible.
3. **Choose:** the player selects links and switches and upgrades and explicitly submits the decision.
4. **Explain:** display the result, the relevant values, and the rule that connects them.
5. **Retry or advance:** a wrong answer leaves the round playable; a correct answer enables Next.
6. **Reflect:** the level summary shows completed rounds, valid attempts, and assistance used.

**Worked interaction:** The player sees a graphical representation of the network with links, when done packets start flowing to test to see if the design is appropriate.  The end devices change and get harder with each round.

## Decisions recorded during clarification (2026-11-17)

- Packets flow continuously as an ambient visualization; nothing is timed and grading happens
  only on Submit.
- An over-provisioned design is correct; the explanation lists unnecessary upgrades.
- Upgrades are: add uplinks (up to the class maximum) or replace a switch with another class.
  Level 1 offers only "add uplinks".
- Switch capacity = total active uplink bandwidth; ingress and egress are both shown and the
  busier direction is graded.
- Access and aggregation are changeable; the core is fixed and ungraded.
- Each round starts from the previous round's reference solution plus new devices (and possibly
  a new access switch); the player's extra upgrades are not carried forward.
- Three levels × two rounds: link capacity → device type sizing → organic growth.
