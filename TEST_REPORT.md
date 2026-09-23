# TEST_REPORT — Kernel Keep

## 0.2 (branch `react-hud-0.2`, React HUD + Master v0.2 kit integration) — 2026-09-23

Same container as 0.1 (below): Linux x86_64, 2 vCPU, Node 22.22.2, headless Chromium (Playwright 1.56, software rendering). **Nothing was run on the MacBook Air, macOS, Safari or Windows.** Logs are in `docs/test-logs/` and were overwritten by this run.

| Check | Command | Result | Log |
|---|---|---|---|
| Type check (strict, now incl. TSX) | `npm run typecheck` | 0 errors | `typecheck.log` |
| Simulation + view-model tests | `npm test` | **32 / 32 pass** (29 from 0.1, plus 3 new `view.test.ts`) | `unit-tests.log` |
| Build | `npm run build` | `dist/kernel-keep.html` **1314 KiB** (React + concept art inlined), plus optional `index.html`, `manifest.webmanifest`, `sw.js`, icons | `build.log` |
| Browser end-to-end | `npm run e2e` | **32 / 32 pass**. New checks: one loop under StrictMode, recovery panel vs engine, Lean/Resume through the command path, portraits and codex images decode, no network requests. No console errors. | `e2e.log`, `e2e/out/` |
| Node ↔ browser determinism | (in e2e) | seed 777, 3000 ticks: `e232a74a` = `e232a74a` | `e2e.log` |
| Optional PWA | `npm run e2e:pwa` | SW installs, cache `kernel-keep-<hash>`, page reloads **offline**, 0 console errors | `pwa-smoke.log` |
| Economy scenarios | `npm run econ` | 5 scenarios, 0 crashes, lowest Stability 25 (scenario E) | `econ.log` |
| Simulation benchmark | `npm run bench` | worst tick ≤ 36 ms at every size, avg 1.5–6.3 ms (see below) | `bench.log` |
| AI-vs-AI (seed 7) | `npx tsx tools/aivai.ts 7` | P1 wins at 17:03 (0.1 build: P2 at 13:53) | `aivai-seed7.log` |
| Mirror fairness | `npx tsx tools/fairness.ts 12 25` | id-order bias **fixed** (setup order no longer changes any outcome). **Residual P1 advantage 18–6** over 24 paired games (p≈0.02): open | `docs/FAIRNESS_RESULTS.md`, `docs/fairness.json` |
| Tauri shell | — | **Not built** (no Rust toolchain in the container) | — |

**Hash change, deliberate:** the fairness fixes changed simulation behaviour, so the reference hash moved from `0e3de02e` (0.1 and the presentation-only React step) to `e232a74a`. See INTEGRATION_NOTES.md §4.

**Bench 0.2** (per 100 ms tick, container; the separation pass is now two-phase):

| Per side | avg ms | p95 ms | max ms |
|---|---|---|---|
| 25 | 1.53 | 6.89 | 35.6 (warm-up) |
| 50 | 2.58 | 9.58 | 26.0 |
| 100 | 3.14 | 9.58 | 18.8 |
| 200 | 6.34 | 13.4 | 23.1 |

The browser battle check now spawns **164 units** (0.1: 134) and measured **47 fps** with software rendering, down from the 60 fps cap in 0.1. React adds a DOM update ~10×/s. This is a container number; measure on the Air with F3 before drawing conclusions.

**Still not verified in 0.2:** the Tauri build; PWA in Safari; human playtest; Air performance; a fog-leak test specific to the new React panels (they use the same fog-filtered queries as 0.1).

---

# 0.1 results (history, 2026-09-23)

**Date:** 2026-09-23. **Where:** Linux x86_64 cloud container (2 vCPU Xeon 2.8 GHz, 7 GB RAM, no GPU), Node 22.22.2, Chromium 1194 (Playwright 1.56, headless, software rendering). **Nothing was run on your MacBook Air M4, on macOS, or on Windows.** Raw logs are in `docs/test-logs/`.

## 1. What ran

| Check | Command | Result | Log |
|---|---|---|---|
| Type check (strict TS) | `npm run typecheck` | 0 errors | `typecheck.log` |
| Simulation tests (real sim, no mocks) | `npm test` | **29 / 29 pass** (≈13 s) | `unit-tests.log` |
| Build single-file game | `npm run build` | `dist/kernel-keep.html`, 117.9 KiB | `build.log` |
| Browser end-to-end (real mouse and keyboard in Chromium) | `npm run e2e` | **23 / 23 pass**, no page or console errors | `e2e.log`, `e2e/out/results.json`, screenshots `e2e/out/*.png` |
| Simulation benchmark | `npm run bench` | see §3 | `bench.log` |
| Economy simulation | `npm run econ` | 5 scenarios, 0 crashes, lowest Stability 25 | `econ.log`, `docs/ECON_SIM_RESULTS.md`, `docs/econ_sim.json` |
| AI-vs-AI full match | `npx tsx tools/aivai.ts 7 20` | Decisive: player 2 wins at **13:53** (tick 8334). Scout seen at 4:07/4:19; first waves launched at 6:30/6:35 | `aivai-seed7.log`, `ai-timings-seed7.log` |
| Engine feasibility spike | `godot --headless --script spike/bench.gd`; `node spike/bench.mjs` | see RESEARCH.md §A | `feasibility-spike.log` |

## 2. Coverage against the required failure cases (prompt §12)

| Required area | Automated evidence (test name, abbreviated) | Status |
|---|---|---|
| Resource conservation | *data conservation*: wells + carried + stock constant over 2 min; `dataHarvested` = deposits × 10 | Tested |
| Capacity limits | *storage caps* (Data cap, 600 Hash vault); *memory cap blocks training until a Memory Bank exists* | Tested |
| Starvation warnings, staged consequences, recovery | *starvation is staged* (alert → Stability falls → crashes auto-suspend → Lean + Suspend recovers → Resume clears the flag); *idle start never spirals* (20 min) | Tested |
| Bootstrap | *bootstrap*: 4 Runners + Core → harvest → Compiler → auto-staffed → Code | Tested |
| Insufficient resources, invalid placement | *insufficient resources and invalid placement* (Need-X messages, occupied, unexplored, void, Core not buildable, wrong trainer; no resources change). e2e: toast shows "Need … Data" | Tested |
| Blocked spawns | *blocked spawn waits (no loss) and resumes* | Tested |
| Queue cancellation, refunds | *training queue*: cap 5, cancel refunds full cost and returns the absorbed Runner; *cancel construction 100% / demolish 25%*; e2e cancels by clicking the queue item | Tested |
| Miners reach nodes, no duplicate rewards | *data conservation* (trip count × 10 exactly) | Tested |
| Workers recover from obstruction | *obstruction recovery* (building placed on units ejects them); stuck detection re-plans | Tested (ejection); stuck logic exercised in long runs only |
| Population after recruitment, death, cancellation, save/load | *training queue* (start/cancel/death), *demolishing a Training Grid mid-training returns the Runner*, *save/load mid-match* (in-progress queue and active orders asserted in the snapshot; memUsed equal) | Tested |
| Selection, group orders | e2e: drag-box selects 4, right-click harvest for the group, click-select, placement | Tested (browser) |
| Attacks, target death, friendly fire, cooldowns | *attack order*: target dies, shot gaps ≥ cooldown, adjacent friend untouched, attacker idles | Tested |
| Hardened structures | *hardened walls*: Bulwark ≤ 25%, Breaker full damage | Tested |
| Gate open/close, wall destruction, route recalculation, unreachable destinations | *gates* (owner passes open gate; enemy never; closed blocks owner; mid-walk re-route on reopen; breach opens a route); *unreachable destination*; *siege routing* (attack-move breaches a sealed pen) | Tested |
| Opponent within information and difficulty rules | *AI plays within its information and command rules* (every AI command wrapped; attacks only on visible targets; only its own player id; economy earned, not granted; pressures an idle human) | Tested |
| Victory, defeat, pause, restart, restore from save | *victory and defeat* (sim stops; commands rejected); e2e: VICTORY and DEFEAT screens, P pause/resume, Play again, Quick save → Quick load identical hash | Tested |
| Seeded repeats, replays | *same seed ⇒ identical hash*; *command-log replay*; e2e: Node vs browser same hash at 3000 ticks | Tested |
| Extended runs | *30 simulated minutes AI-vs-AI*: no NaN, in bounds, never inside the void, no negative stock, dead entities compacted, max step < 200 ms | Tested |
| Increasing unit counts | `npm run bench` 25 → 200 per side | Measured (§3) |
| Fork rules | *fork*: no Memory, Compute surge, cooldown, dies with source, expires | Tested |
| Support behaviour | *Patchers keep healing while attack-moving* | Tested |
| Brownout | *mining: diminishing returns and brownout*; *towers fire slower in a brownout* | Tested |
| Save schema versioning | *save schema is versioned and rejects unknown versions* | Tested |
| Settings: UI scale, key rebinding | e2e | Tested (browser) |

## 3. Performance (measured on the container, not on the M4)

**Simulation (`npm run bench`)**: an AI economy runs for 3 minutes, then N programs per side are spawned and attack-move across the map. Timings are per 100 ms tick:

| Per side | Units at start | avg ms | p95 ms | max ms |
|---|---|---|---|---|
| 25 | 74 | 1.13 | 4.89 | 27.5 (JIT warm-up) |
| 50 | 124 | 0.94 | 1.60 | 7.1 |
| 100 | 224 | 2.18 | 6.82 | 12.5 |
| 200 | 424 | 4.25 | 9.27 | 11.9 |

Before the pathfinding budget (ADR-005), the 100-per-side worst tick was **about 233 ms** (an earlier console run in this session, not saved to a log). Since then it's been **9–13 ms** across runs.

**Browser (e2e):** 134 units fighting while zoomed in, headless Chromium with *software* rendering: **60 fps** (the rAF cap), simulation about 1.2–1.5 ms/tick on average across runs (1.23 in the final `e2e.log`).

**Hypotheses for your M4 (unmeasured):** ≥ 60 fps at 1440p with 100–200 units, and simulation ≤ 5 ms/tick. **Check them with F3** in a real session.

## 4. What is NOT tested or verified

- **No human has played it yet.** None of these tests shows the game is fun, clear or well-paced. Balance numbers come from scripted AI economies.
- Visual review consisted of screenshots taken by the automated run (title, placement ghost, a mid-game base, a battle, victory). Screenshots show appearance, not function.
- Not run on macOS, Windows, Safari/WebKit or Firefox. No desktop wrapper was built. **Cross-engine determinism (JavaScriptCore/SpiderMonkey) is unverified.**
- Audio: WebAudio calls run without errors in headless Chromium, but nobody has listened to them.
- Edge-scroll, middle-drag pan, the minimap right-click and control groups are implemented but not covered by e2e.
- Long human sessions: memory growth in the browser over an hour hasn't been profiled.
- The mirror AI isn't perfectly fair: player 2 won the current seeded AI-vs-AI match (it was player 1 in an earlier build). Randomness only affects crash selection, so seeds barely change AI-vs-AI outcomes. Possible causes are update-order bias and building-placement tie-breaks (to investigate). *(0.2: investigated. The id-order bias is fixed; a residual P1 advantage remains. See docs/FAIRNESS_RESULTS.md.)*

## 5. Human playtest script (15–20 minutes)

**Setup:** open `dist/kernel-keep.html` in Chrome or Edge on the MacBook Air. Choose **New match → Normal**. Keep the objectives panel on. Don't explain anything beforehand. Observe and take notes.

1. **0–3 min, first steps:** can the player harvest and place a Compiler using only the objective hints? Note the time to the first Compiler and any hesitation.
2. **3–6 min, economy:** ask "Why is your Code going up or down?" and "What does Compute do?" Watch for the first brownout. Did they notice it and fix it?
3. **~6:30, first wave** (never before 5:30): did they build walls or a tower before it? Did they use the gate? What did they do when the "under attack" alert fired?
4. **6–12 min, push:** did they find Breakers and understand hardened walls? Did they try Fork? What happened?
5. **End:** win/lose, match time, and the stats screen.

**Questions afterwards**
- *Clarity:* Which resource was hardest to understand? Did anything happen that you couldn't explain?
- *Pacing:* When did you feel rushed, and when bored? Was the first wave too early or too late?
- *Choices:* Name one real trade-off you made (mining vs towers, Lean vs Standard, soldiers vs Runners). Did it matter?
- *Frustration:* When did a unit or building not do what you expected? Did any warning feel unfair?
- *Fantasy:* Did it feel like ruling a digital civilization or like operating a dashboard? What would make the city feel more alive?
- *Would you play another match? Why?*

Record: match time, winner, first Compiler/Rig/Grid/Tower times, number of walls placed, brownout seconds, crashes, Fork uses (from the end screen and an exported save).
