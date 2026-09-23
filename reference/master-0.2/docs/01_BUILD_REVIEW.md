# Build review: preserve the simulation, improve the presentation

2026-09-23. **Evidence basis: the user's delivery summary, the supplied master prompt, the original reference image and our artwork. Original game source and logs were unavailable.** All assessments of prototype 0.1 below are conditional; they are not a source audit.

## Judgment

The reported scope is well chosen for a first playable: one map, a mirrored faction, six roles, ten structures, ordinary opponent AI, a complete economy and basic save/replay infrastructure. If the reported artifacts pass reproduction, this is a foundation worth preserving. A React interface can improve navigation, information hierarchy, accessibility and appearance while leaving the fixed-tick TypeScript simulation and Canvas battlefield intact.

Do not restart in Unreal or Godot to obtain a better-looking HUD. Do not make Electron the next milestone merely because it wraps HTML. First reproduce the current game, inspect its fairness hypothesis, measure the actual Mac experience, and then adapt the presentation. Tauri should remain optional until it solves a demonstrated need beyond what the browser offers.

## Evidence assessment

| Reported item | What it would establish if reproduced | What it does not establish |
|---|---|---|
| Single offline ~118 KB HTML | Convenient distribution and a small initial runtime | Asset-heavy builds will remain 118 KB; all browser persistence is portable |
| 29 simulation tests | The particular tested invariants pass | Full coverage, fun, fair opponent information, absence of untested edge cases |
| 23 browser checks | The particular scripted interactions pass | Human usability, long-session behavior or WebKit support |
| Replay, save/load and Node/browser hash agreement | Agreement for the supplied cases and runtimes | Cross-platform or cross-version deterministic behavior in general |
| ~2.2 ms/tick, 100 units per side | A container simulation measurement at the tested load | Mac frame rate, GPU time, rendering cost, p95/p99 spikes, battery or thermals |
| Mirror match decided at 13:53, side two won | One run completed with one observed outcome | A systematic side advantage, balanced pacing or human match duration |
| Save/load/autosave and accessibility settings | Reported feature coverage | Corrupt-save recovery, schema migration, race handling or accessible contrast |
| Godot/Unreal version and feasibility claims | A decision described by the prior implementer | Independently verified engine availability in this session |

The prior run's test counts, timestamps, hashes and benchmarks must retain their provenance. Do not combine them with this kit's tests as if all were rerun together.

## Priorities and revisions

| Priority | Action | Reason | Evidence needed |
|---|---|---|---|
| P0 | Obtain archive; inventory source, docs, lockfiles, logs, built HTML and git state | Establish a reproducible baseline | Original archive hash, exact commands, fresh logs |
| P0 | Keep browser launch as the default | Satisfies the no-Apple-enrollment preference | Offline run on Air with local assets |
| P1 | Diagnose side bias with paired seeds and swaps | One win is insufficient; deterministic ordering may still create bias | Structured paired results and state diffs |
| P1 | Surface delivered Data, Code net rate, capacity deficits, stability and suspended programs | These are the digital civilization's decisions | UI values verified against authoritative state |
| P1 | Add React around the simulation, behind an adapter | Modern UI without replacing working RTS logic | Before/after replay comparison and command tests |
| P1 | Measure full rendered frames and long-run behavior on Air | Container tick average is incomplete | Frame/simulation percentiles, memory and thermal notes |
| P2 | Export controlled individual art assets and atlases | Concept sheets are not production sprites | Correct pivots, alpha, bounds, silhouette and performance checks |
| P2 | Add optional Tauri, only after browser acceptance | Avoid packaging becoming a blocker | Native run/build and platform smoke tests |
| Later | Additional factions, cinematic video, installers, paid signing | Do not obscure core playtest questions | Demonstrated player or distribution need |

## Concrete design corrections made in this kit

1. Canonical units are Runner, Ping, Bulwark, Lancer, Patcher and Breaker. Earlier Worker/Miner/Scout/Defender/Ranged/Support/Siege/Commander names are legacy concepts. Runner carries the worker/miner visual responsibility; Fork is a power, not evidence of a seventh unit.
2. Canonical structures are the supplied ten. Research Lab and Repair Station are not silently added. Compute Node and Memory Bank receive distinct silhouettes.
3. Compute is shown as requested/used capacity against supply. Earlier allocation sliders are removed because they were not established in the delivery summary.
4. Code is shown as a stock and net rate. A reserve estimate is only shown for a negative net rate and is explicitly conditional on that rate remaining unchanged.
5. Stability and suspension receive a compact recovery-oriented panel. Exact rations, brownout and reactivation rules must be read from the original implementation.
6. Hash remains fictional and match-local; no wallet, miner, financial chart or online AI inference is introduced.
7. The game's core rendering stays a battlefield. The UI does not replace gameplay with business-dashboard charts.

## Risks to inspect in the real code

These are investigation targets, **not confirmed defects**: player-index processing order, in-loop damage causing first-mover advantages, unequal node travel costs, diagonal path asymmetry, global target queries bypassing fog, cache/reservation accounting, dead-unit capacity release, suspended-unit memory accounting, gate nav invalidation, command double-dispatch, RNG restoration, autosave interruption and hidden-tab time accumulation.

For Fork, inspect duration, eligible targets, population/compute reservations, clone expiration, refund/death rules and save restoration. Do not assume that a visually dramatic clone ability is balanced or that its representation can mutate simulation state.

## Release recommendation

Use this as a **presentation and review revision**. Do not promote prototype 0.1 to a gameplay 0.2 release until its source is integrated, existing tests are rerun, the Air benchmark is performed, and at least a short human playtest finds the supply/defense loop understandable.
