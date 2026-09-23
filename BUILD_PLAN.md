# BUILD_PLAN — Kernel Keep

Status as of 2026-09-23 (end of session 1). Labels: **Tested** (automated evidence), **Implemented** (in the build, light or no coverage), **Proposed**, **Blocked**.

## Milestones

### A. Inspect, research, choose the stack, feasibility spike — **Tested / done**
- **Objective:** a verified environment inventory, research with dates, a stack decision record, and an executable spike.
- **Files:** `RESEARCH.md`, `docs/adr/ADR-001-stack.md`, `spike/bench.gd`, `spike/bench.mjs`.
- **Exit criteria met:** tools inventoried; Godot 4.7.2 run headless; GDScript vs JS benchmark measured; ADR written.
- **Remaining risk:** the stack hasn't been run on macOS or Windows.

### B. Smallest interactive economy loop + camera/selection — **Tested / done**
- **Objective:** launch the map, control a worker, construct, produce Code, sustain a program, verify resource changes (the prompt's first milestone).
- **Files:** `src/sim/*`, `src/client/*`, `tests/economy.test.ts`, `e2e/e2e.mjs`.
- **Acceptance:** *bootstrap* test; e2e drag-select, right-click harvest, C-place Compiler, Code produced.

### C. Construction, workers, code feeding, mining, training — **Tested / done**
- Auto-staffed operators, Compiler cycles, rations/Stability/crashes/Suspend, Rigs with falloff and brownout, Memory, training that consumes a Runner, queues and refunds.

### D. Combat, defences, navigation updates, an opponent that uses the economy — **Tested / done**
- Six roles, veterancy, hardened Firewalls, owner-only Access Gates, Sentry Towers, siege/breach routing, repath on gate/wall changes, fog of war, a rule-based Rival that builds, harvests, trains, scouts, defends, attacks in waves, recovers and uses Fork. Commander power: Fork.

### E. Winnable/losable match, saving, onboarding, essential UI — **Tested / done (first pass)**
- Victory/defeat, pause-and-order, restart, quick save/load, autosave, file export/import, the 9-step objectives tutorial, HUD with plain-language "why" boxes, minimap, control groups, rebindable keys, UI scale, reduced flashing, volume.

### F. Balance, art, audio, performance, accessibility, packaging — **Started**
| Task | Status |
|---|---|
| Pathfinding budget; 200/side under 15 ms/tick worst case on the container | Tested |
| Human playtests (5+ players, TEST_REPORT §5 script) → tune `balance.json` | **Proposed — next** |
| Measure fps and simulation on the MacBook Air M4 (F3 overlay) | **Blocked here** (needs your machine) |
| Desktop wrapper: Electron (package macOS arm64 + Windows x64 from one machine) | Proposed |
| macOS signing and notarization | **Blocked:** needs the paid Apple Developer Program (a spending decision for you) |
| Windows smoke test | **Blocked here** (needs a Windows machine or CI runner) |
| Cross-engine determinism check in Safari/WebKit (Playwright WebKit) | Proposed |
| Replace procedural placeholders with authored art/SFX (see manifest) | Proposed |
| Mirror-AI fairness investigation | **Tested (0.2)**: the id-order bias is fixed. The residual P1 advantage (18–6) is **open**. |
| React HUD behind an engine adapter (Master v0.2 kit) | **Tested (0.2)** |
| Concept art in the UI (menu, portraits, codex) | **Implemented (0.2)** |
| Isometric battlefield with the concept renders as program and structure sprites; HUD using the same cut-outs | **Tested (0.3)** |
| Animated sprite frames / several facings; tileable wall art | **Proposed** (needs new art) |
| Optional offline install (PWA) | **Tested (0.2)**, Chromium only |
| Optional Tauri 2 shell (`desktop/`) | **Proposed / untested** (no Rust here). Replaces the Electron plan as the lighter option, per the kit's review. |

## Exact next tasks (ordered) — updated for 0.2

0. **0.2:** open `dist/kernel-keep.html` on the Air, play one Normal match, and check the new HUD: the recovery panel, portraits and codex. Then fix the residual mirror advantage (fixed-point positions, or tile-exact approach logic around wells; see docs/FAIRNESS_RESULTS.md). Build the Tauri shell only if a native window is wanted (`desktop/README.md`).

The 0.1 list continues below. Item 4 (Electron) is superseded by the optional Tauri shell.

1. **Play 2–3 matches yourself** on the Air with the playtest script. Export a save after each (Menu → Export save file) and note the F3 numbers.
2. Tune from findings. The likely levers are `upkeepCycleSec`, the `ai.normal.firstAttackSec` / `firstWave` values, the Compiler cycle, and tower damage. Every change goes in `src/data/balance.json`; then run `npm run verify` and `npm run econ`.
3. Add an **Easy-first onboarding drill** (AoE-style, RESEARCH #12): a 5-minute "Feed the Keep" scenario with a medal.
4. **Electron wrapper:** `desktop/` folder, `electron-builder` targets `mac` (arm64 dmg, unsigned) and `win` (x64 portable). Smoke-test on both OSes.
5. **WebKit determinism test:** add `webkit` to e2e and compare hashes.
6. Wave telegraphing: a "Rival forces massing" warning 30 s before an attack (a lesson from They Are Billions).
7. First art pass: building sprites/models (Blender → glTF → sprite renders), keeping silhouettes and ownership rings.

## Later-feature backlog (not started, on purpose)
- **Factions:** Swarm Collective (replication economy), Archive Wardens (Quarantine field, archiving), per-faction AI personalities (`AIState.plan/comp`).
- **Doctrines and equipment modules** (training beyond specialization), formation drills, a Patch Station building, upgrades.
- **Advanced logistics:** Code carriers, conduit networks, heat as a Compute side-effect — only if each passes the "distinct decision" test (ADR-003).
- Wall-top units, sight occlusion by walls, flow-field group movement, larger maps with hierarchical pathfinding.
- Campaign (the three factions as a difficulty ladder, like Legends), skirmish map editor, more maps.
- Modding (JSON balance and map packs; **no** executable player code).
- Multiplayer lockstep (after cross-engine determinism and desync hashing).
- Music and sound design; localisation; controller support.
