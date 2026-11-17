---
# ARCADE SUBMISSION — fill this file in, commit it to the ROOT of your game repository as ARCADE.md,
# then send John your GitHub URL. Everything between the two --- lines is machine-read.
arcade_version: 1

game:
  title: "Capacity Flows"
  slug: capacity-flows
  tagline: "Keep a growing campus network from spilling packets for as long as you can"
  summary: "You are the network engineer for a campus that never stops growing. Spend credits earned from delivered traffic on uplinks, bigger switch classes and switch splits so no switch goes over 80% or runs a device on a too-slow port; spill for 15 seconds in a row and the game ends. You learn to calculate uplink load, find the real bottleneck, and size switches by port speed and uplink capacity."
  topics: [capacity planning, oversubscription, uplinks, multigigabit, campus switching]
  category: switching
  skill_level: beginner
  play_minutes: 6            # a scripted reference player survives 5:45; an idle player loses at 0:35
  levels: 1                  # one continuous scenario: scripted growth, then endless growth waves
  card_image: assets/arcade-card.png
  card_image_alt: "The game mid-play: a campus topology with a split Studio switch, packets flowing on uplinks, the Office switch spilling at 90.9% with a 14-second countdown, and the credits and survival clock above."
  repo: "https://github.com/mroe1234/my-network-game"
  repo_path: ""
  license: MIT

creator:
  name: "Munroe Sollog"
  github: mroe1234
  location: ""
  organization: ""
  links: []
  first_spec_project: true
  workshop: "NAF AC6"
  consent_to_publish: true

build:
  started: "2026-11-17"
  finished: "2026-11-17"
  wall_time: unknown
  spec_driven:
    framework: GitHub Spec Kit
    framework_version: "1.4.2.dev0"   # from .specify/init-options.json; `specify version` was not run
    artifacts: [constitution, spec, clarify, plan, tasks, analysis, checklists]
    task_count: 16                    # specs/002-survival-growth/tasks.md (the superseded 001 build had 40)
    loops_or_phases: 4                # 001 was built in a 4-stage /loop of /speckit-implement; 002 in 4 phases
  model: "claude-opus-5-5"
  helper_models: ["web-fetch sub-agent (model id not reported)"]
  harness: Claude Code
  harness_version: unknown
  mcp_servers: ["claude.ai Claude Docs (connected, not used)"]
  rag_and_sources: ["Cisco Campus Network for High Availability Design Guide (PDF; figure text extracted)", "Cisco Catalyst 9300 Series Switches Data Sheet (page did not load for automated fetches)", "web search results summarising Cisco campus oversubscription guidance", "NAF AC6 StarterKit ARCADE.md template"]
  skills_and_plugins: [speckit-constitution, speckit-specify, speckit-clarify, speckit-plan, speckit-tasks, speckit-analyze, speckit-implement, loop]
  other_tools: ["Google Chrome 157 headless (test runner, click-through drivers, screenshots)", "Python 3 http.server", "Python (economy tuning model, PDF text extraction)", curl, git]
  human_prompts: 26           # counted in the final session; an earlier session before /clear is not included
  usage:
    input_tokens: unknown
    output_tokens: unknown
    cost_note: "not reported by the harness in this session"
  ai_generated_assets: ["code and runtime-drawn SVG: Claude Code (claude-opus-5-5)", "card image: headless Chrome screenshot of the game", "audio: none"]

runtime:
  kind: static-web
  stack: [HTML, CSS, JavaScript ES modules, SVG]
  start: "python3 -m http.server 8000 --bind 127.0.0.1"
  url_after_start: "http://127.0.0.1:8000"
  hosted_url: ""
  static_root: "."
  requires_install: false
  requires_network: false
  requires_api_key: false
  uses_ai_at_runtime: false
  browsers: ["Chrome 157 (headless)"]
  accessibility: "Keyboard controls (Tab, Enter/Space, P to pause) and reduced motion are implemented; reduced motion and keyboard events were checked by automated drivers; no full keyboard-only or screen-reader playthrough by a person yet"
  save_state: "none (in memory; reload starts a fresh game)"

verification:
  tests: "python3 -m http.server 8000 --bind 127.0.0.1, then open http://127.0.0.1:8000/tests/"
  tests_passing: 75
  facts_sourced_from: ["Cisco Campus Network for High Availability Design Guide (Typical 20:1 and 4:1 data oversubscription)", "Cisco Catalyst 9300 Series Switches Data Sheet (uplink options; section heading not verified)"]
  known_limits: ["the 80% limit, prices and income are game rules, not networking facts", "traffic is steady per device type; QoS, latency, bursts, buffering, TCP and failover are not modelled", "the core never bottlenecks", "a device on a too-slow port counts as spilling rather than negotiating down", "late in a game credits pile up, so the budget mainly shapes the first three minutes", "real-time animation was verified only by stepping frames in headless Chrome"]
---

## In one paragraph

Capacity Flows is a browser game for junior network engineers about campus capacity planning.
Traffic keeps growing: editors join the Studio, video calls spread, a Lobby opens with Wi-Fi 7
access points that need 5G ports, render servers arrive with 10G ports, and an atrium pushes
aggregation past 80%. You pause whenever you like and spend credits on uplinks, bigger switch
classes or splitting a switch, and your score is how long the network survives before it spills
for 15 seconds in a row.

## How it was built

We followed GitHub Spec Kit in order: constitution, specify, clarify (five questions on upgrade
types, switch capacity, demand, ingress/egress and tiers), plan, tasks, analyze, then a
four-stage /loop of implement. Analysis caught a cut list that would have dropped the core
packet flow, and the user settled the oversubscription ratio at 4:1 to match the Cisco source.
The first build had six graded rounds. The user then asked for clickable switches, colour-coded
packets, arrival queues, and packet shape by device type. Then they replaced levels with
survival play, which needed a recorded MAJOR constitution amendment because the original rules
forbade countdowns. A Python model tuned the budget: stopping income while spilling caused a
death spiral, so income now comes only from delivered traffic. Things that broke and were fixed:
the packet flow wiping the attempt counter, negative animation time, a "Healthy" HUD while paused
on a problem, and headless Chrome on macOS never running animation frames, which the tests now
step by hand. Splitting a switch came last.

## What we'd tell the next builder

- Write the hand-computed numbers into the tests before the code. Every balance and boundary bug was caught by a test whose expected value came from arithmetic in a comment.
- Model the game economy before you write UI. A 60-line script found the death spiral and the "max everything at once" exploit in minutes.
- Don't trust headless Chrome to run your animations. Stub `requestAnimationFrame` and step the frames yourself, or your "animated" checks may pass by luck.
