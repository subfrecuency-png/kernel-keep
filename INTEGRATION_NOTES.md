# Integration notes: Kernel Keep Master v0.2 → prototype 0.2

Date: 2026-09-23. Branch `react-hud-0.2`. `master` still holds the untouched 0.1 prototype.

**Source.** The source is the folder `~/Downloads/Kernel_Keep_Master_v0.2` on Ryan's Mac. All files named in its `FILE_CHECKSUMS.sha256` were staged and verified before use. A trimmed copy is vendored in `reference/master-0.2/` (docs, UI source, tests, scripts, evidence, manifests).

**What the kit is.** In its own words, the kit is *"a working React presentation kit and summary-based review. It is not a revised build of the original RTS."* It was written without access to the 0.1 source, so every claim it makes about the game is conditional. The job of this integration was to take what is useful, check it against the real engine, and leave out what does not fit.

Legend: **Implemented** = in the code, **Tested** = covered by an automated check that passed in this session, **Proposed** = written down but not built, **Blocked** = needs something unavailable here.

## 1. Dissection — used, adapted, rejected

| Kit item | Decision | Where / why | Status |
|---|---|---|---|
| React 19 HUD concept (top bar, alerts, recovery panel, objectives, selection, command card, menus, codex) | **Adapted**. Rebuilt against the real engine rather than copied, because the kit's components read `fixture.ts` sample data. | `src/ui/*.tsx`, `src/client/engine.ts`, `src/client/view.ts` | Implemented, Tested (e2e 32/32) |
| `contracts.ts` (proposed engine↔UI interface) | **Adapted** into `EngineHost`: an immutable `Snapshot` via `useSyncExternalStore`, with UI intents routed through the existing `applyCommand` path | `src/client/engine.ts` | Implemented, Tested |
| `fixture.ts` sample economy, `World.tsx` Canvas diorama, fixed minimap and tutorial examples | **Rejected**. Sample values would contradict the real simulation. The existing Canvas renderer and minimap are used instead. | — | — |
| Recovery/stability panel | **Adapted**. Issues come only from engine state: starvation, low Code, brownout, suspension, memory, crash risk. Every button maps to an existing command (ration, suspend/resume, select, rig off) or a hint. No new mechanics. | `recoveryView()` + `engine.runRecovery()` | Implemented, Tested (unit + e2e) |
| Code reserve estimate "only when net rate is negative" | **Used** as specified | `topView()` | Tested |
| Design tokens (colours, surfaces, danger/supply/memory hues), layout | **Used** | `src/ui/styles.css` | Implemented |
| Menu background, six-roles sheet, ten-structures sheet | **Used as concept art only**: the menu background, 16 cropped portraits (selection panel, command card, codex) and two codex sheets. They are **not** world sprites. The battlefield still uses the procedural renderer. | `assets/art/`, `src/ui/assets.ts` | Implemented, Tested (images decode) |
| App icons (svg, 192, 512) | **Used** | `assets/icons/`, favicon, PWA, Tauri | Implemented |
| Legacy art boards (`art/legacy/*`) | **Rejected**. They show a non-canonical roster (Worker/Miner/Commander…). | not copied | — |
| Canonical roster: 6 roles, 10 buildings; no Commander, Research Lab or Repair Station | **Used**. The existing engine already matched it. | — | Verified |
| Optional PWA (manifest + service worker) | **Adapted**. It registers only on http(s) with `?pwa`, so the default `file://` launch stays untouched and error-free. The cache name is a content hash, and `skipWaiting` is not used. | `tools/build.mjs`, `src/ui/main.tsx`, `tools/serve.mjs`, `e2e/pwa-smoke.mjs` | Tested in Chromium (installs, reloads offline). Safari untested. |
| Optional Tauri 2 scaffold | **Adapted**. Product name Kernel Keep, `frontendDist ../../dist`, no plugins, empty capabilities, ad-hoc signing, bundle off. | `desktop/src-tauri/`, `desktop/README.md` | **Blocked**: no Rust toolchain here; never compiled |
| Third-party notices and React/React-DOM/Scheduler MIT licences | **Used** | `THIRD_PARTY_NOTICES.md`, `licenses/` | Implemented |
| Fairness experiment plan (docs/04) | **Run**, and it found real bugs (§3) | `tools/fairness.ts`, `docs/FAIRNESS_RESULTS.md` | Tested; residual bias open |
| Regression gates (docs/04) | **Adopted** where testable (§2) | `e2e/e2e.mjs`, `tests/view.test.ts` | Tested |
| Air measurement script, human playtest script | **Kept** as instructions | `reference/master-0.2/docs/04…` | Blocked (needs the Mac and people) |
| Kit's `ui/package.json` toolchain (Vite-style dev server) | **Rejected**. The project already bundles to one offline HTML with esbuild. A second toolchain adds risk and nothing else. | — | — |

## 2. Regression gates from the kit, checked here

| Gate | Result |
|---|---|
| StrictMode does not start a second simulation loop | Tested: 1 loop, 10.0 ticks/s |
| Presentation-only change leaves replay hashes unchanged | Tested at the React step: seed 777 / 3000 ticks stayed `0e3de02e`. The *later* fairness fixes changed it on purpose (§4). |
| Node build and browser bundle agree on the state hash | Tested: `e232a74a` = `e232a74a` |
| Hotkeys don't fire through dialogs or text fields; no double-dispatch on key-repeat | Implemented (`onKeyDown` guards). Rebinding is tested in e2e. |
| Queue cancel refunds exactly once | Tested (e2e) |
| Save/load restores exact state | Tested (hash match after quick save/load) |
| Recovery UI shows engine values and only real commands | Tested (unit + e2e) |
| Match can be won, lost and restarted, offline, with no network requests | Tested (e2e) |
| Fogged enemies never leak into the UI | Selection and minimap still use the 0.1 fog-filtered queries. There is no dedicated new test. |

## 3. The kit's claims vs what the engine actually does

- *"Mirror match decided at 13:53, side two won — one run proves nothing."* Correct. The paired experiment showed a **deterministic entity-id-order bias**: the side with the higher ids won 10/10 in every configuration. It was traced and fixed (see `docs/FAIRNESS_RESULTS.md`): order-independent separation, simultaneous damage, mirrored tie-breaks for player 2 in placement, spawning, A* and ring scans, and an arrival epsilon. Insertion order no longer changes any outcome. A **residual P1 advantage remains (18–6 over 24 paired games, p≈0.02)**. It is traced to float positions that are not mirror-exact, amplified by crowding at wells. It is an open bug.
- *"Seeds may barely matter."* Confirmed: the AI uses no randomness, so the seed alone does not change an AI-vs-AI game. The experiment varies AI decision phases instead.
- The kit's candidate list included in-loop damage, processing order and diagonal path asymmetry. All three were real. Fog bypass, gate nav invalidation and queue refunds were already covered by the 0.1 tests.
- Kit claim of *"~118 KB single HTML"* (describing 0.1). With React and the art the build is now **~1.31 MB**, still one offline file. The biggest item is the menu background (187 KB webp).

## 4. Deterministic hash change (documented, not silent)

| Build | seed 777, 3000 ticks, human vs AI | Why |
|---|---|---|
| 0.1 / React HUD step | `0e3de02e` | presentation-only change: unchanged |
| 0.2 (this branch) | `e232a74a` | fairness fixes change the simulation: mirrored tie-breaks, simultaneous hits, Jacobi separation, mirrored A* order, arrival epsilon |

Save schema is unchanged (1). A 0.1 save still loads, but it plays forward under the 0.2 rules, so a 0.1 replay will not reproduce its 0.1 hash under 0.2. No test's expected hash was edited to hide a change. The determinism tests compare runs of the same build.

## 5. Not done / next

1. Residual P1 advantage: fixed-point positions or tile-exact approach logic (**Proposed**).
2. Build and run the Tauri shell on the Mac. Confirm the inline-script CSP hashing (**Blocked** here).
3. PWA install on Safari/macOS (Chromium is tested) (**Proposed**).
4. Individual production sprites with pivots, to replace procedural shapes (the kit's P2) (**Proposed**).
5. Air measurement and a human playtest (**Blocked**: needs the Mac and people).

## 6. Follow-up (0.3): the imagery in the game world

Ryan asked for full integration between the imagery, the units and the layout. That goes beyond the kit's guidance (*"concept sheets are not production sprites"*), and here is how the gap was handled:

| Kit caution | What 0.3 does |
|---|---|
| No pivots, alpha or world scale | Each cell is matted (rembg IS-Net), trimmed and given a measured ground anchor (`sprites.json`). Programs are scaled from their radius; structures from their footprint diamond. |
| Isometric art vs a top-down map | The view is now isometric (2:1) to match the art. Only presentation changed, and the simulation hash is unchanged (`e232a74a`). |
| Cosmetic size must not change collision | Sprites are drawn from simulation positions and footprints, and hit-testing only chooses what you click. Gameplay never reads image sizes. |
| Rival readability | Red-shifted variants (blue→crimson), square ground markers and dashed pads |
| One pose | Movement is suggested with facing, bob, recoil and flash; frames are Proposed |

The legacy boards are still rejected. The roster is still 6 roles and 10 structures.
