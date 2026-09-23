# Integration and acceptance

The archive with original game source is a required dependency. Do not replace it with the fixture diorama or report this lab as a finished RTS.

## Milestones

| Step | Work | Exit criterion |
|---|---|---|
| 0 — Acquire | Preserve original ZIP; inspect archive paths, source, AGENTS instructions, docs, lockfile, git state and logs | Original content inventoried, original launch reproducible |
| 1 — Baseline | Run existing tests and original browser build without modification | Fresh evidence identifies actual pass/fail counts and runtime |
| 2 — Diagnose | Inspect mirror-AI fairness, economy failure recovery, save compatibility and visibility | Confirmed problems separated from hypotheses; targeted regressions |
| 3 — Bridge | Adapt engine state to a cached immutable HUD projection; map UI intentions into the existing command queue | One driver; no duplicate commands; accepted/rejected results shown |
| 4 — Shell | Mount actual Canvas renderer within React; add menu, resource/status/selection/build/queue UI | Original match remains winnable and losable; hotkeys and pointer input work |
| 5 — Art | Use real individual assets at correct pivots and world scale | No collision changes caused by cosmetic image dimensions |
| 6 — Offline | Preserve browser launch; validate saves, origin changes, cache updates and failure recovery | Offline complete match plus save/load on Air |
| 7 — Native optional | Compile Tauri only if requested/useful | Native window runs; platform smoke tests documented |

Integrate in an isolated branch or copy. Keep the original HTML and tests until the successor passes the same acceptance script. Do not change a test's expected replay hash merely to make an unexpected simulation change pass.

## Fairness experiment

The observed side-two win is an open hypothesis. First capture the exact seed, balance data, map version, AI settings and entity order from that run. Reproduce it. Then:

1. Run a paired experiment across, for example, 40 fixed seeds (80 matches): original positions and swapped positions with equivalent AI configuration. This sample size is an initial diagnostic choice, not proof of fairness.
2. Separately vary player processing order and entity insertion order. Preserve stable world IDs when the test is intended to isolate insertion order.
3. Mirror terrain/node positions and compare travel distances, starting stock, rally points, reachable nodes, choke widths and first-contact time.
4. Inspect command phases, target tie-breaking, collision priority and immediate damage/removal. If simultaneous-intent resolution is appropriate, change it only with explicit regressions; do not randomize order to hide a deterministic bug.
5. Record wins, draws, first-contact time, damage, resource totals, suspensions and win time. Report side win counts with uncertainty rather than one aggregated score. A mirrored deterministic system can produce ties; forcing a 50/50 result is not the goal.
6. Add metamorphic tests: an equivalent side swap should preserve corresponding outcomes where symmetry is intended. Distinguish deliberate map asymmetry from defects.

Suggested result fields: `run_id, seed, map_hash, balance_hash, build_commit, side_assignment, processing_order, winner, duration_ticks, first_contact_tick, draw_reason, final_state_hash`. No fairness results have been produced by this kit.

## Regression gates

- Original fixed-tick replays before/after a presentation-only change produce matching authoritative state hashes for the same commands/runtime. UI preferences and animation timestamps do not enter the hash.
- StrictMode mount/unmount or changing menu views does not spawn multiple simulation loops, event listeners or autosave intervals.
- Drag selection, world clicks and hotkeys do not fire through dialogs, build menus or focused text controls. Commands are not sent twice on key-repeat unless intentional.
- Fogged enemies never appear in selection queries, minimap, target tooltips or warning details beyond allowed information.
- Gate state changes and wall destruction update navigation and targeting. Cosmetic travel animation does not grant access before the simulated gate allows it.
- Queues reserve, cancel and refund once. Population and capacities match after recruitment, death, suspension, recovery, Fork, clone expiry and save/load.
- Save/load restores commands, RNG, timers, queues, reserved resources and suspension states. Invalid or unsupported saves fail clearly without overwriting the last good save.
- Brownout and Code shortage have understandable warnings and at least the recovery routes actually implemented. UI actions do not invent new mechanics.
- A full match can be won, lost, paused, restarted and restored offline. React does not create extra online dependencies.

## Air measurement script

Record OS/browser versions, viewport, device-pixel ratio, power mode and graphics settings. Play or replay the same seed for 15 minutes. Capture frame-time p50/p95/p99, simulation-time p50/p95/p99, render duration, unit counts, memory trend, input response and visible hitching. Repeat at an increased unit count and after load. Run five minutes on battery and note fanless thermal behavior. Use F3 if the original build exposes the reported overlay; do not assume this kit does.

Proposed goals: responsive 60 fps at a chosen logical resolution, with a 30 fps quality fallback; no progressive memory growth after repeated restarts. These are targets, not results. A headless container cannot validate Air thermals or GPU behavior.

## Human playtest

Ask a new player to explain each resource, build a sustainable Code supply, understand a shortage, train a mixed formation, defend the gate and recover a save. Observe without coaching for the first three minutes. Record mistaken clicks, misunderstood warnings, downtime, recovery confidence and whether siege decisions feel meaningful. Separate “understands the UI” from “enjoys the game.”
