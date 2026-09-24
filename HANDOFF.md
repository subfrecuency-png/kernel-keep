# HANDOFF — session 6 (2026-09-23): 0.3.3 animation pilot

Committed on branch `anim-pilot` (based on `iso-art-0.3`) in `~/Downloads/kernel-keep`, which is checked out there. Full write-up: `docs/ANIMATION_PILOT.md`.

| Item | Status |
|---|---|
| Compiler working loop | **Implemented, Tested.** Staffed, powered Compilers animate (40 frames, 8 fps). The Rival copy is recoloured at load. |
| Sprites v2 sheets, clip selector, 8-way facing with mirroring, attack sync to cooldown | **Implemented, Tested** (unit). Ready for program frames; no program uses them yet. |
| Animation lab in the Art codex | **Implemented, Tested** (e2e) |
| Runner 3D clips (6) | **Rejected.** The model came from a running-pose concept, so every clip keeps the kicked-back leg. Not shipped. |
| Credits | 9,605 spent (cap 11,000); 1,530 left on the account. The next step needs Ryan's choice (options A/B/C in the pilot doc). |
| Hash / perf | `adb5621a` unchanged in Node, Chromium and WebKit; A/B frame rate within noise |

---

# HANDOFF — session 5 (2026-09-23): 0.3.2 — desktop shell built, WebKit determinism, performance test, wave warnings

Committed on branch `iso-art-0.3` in `~/Downloads/kernel-keep`, which is checked out there.

| Item | Status |
|---|---|
| Tauri shell | Compiled and smoke-tested on **Linux**; the game runs in the window. macOS is untested; steps are in `desktop/README.md` (free tools, no Apple account). |
| Cross-engine determinism | Tested. JavaScriptCore (WebKitGTK) = V8 = Chromium on three seeds. That is evidence, not proof, for Safari. |
| **Performance test** (Title → Performance test, or Menu → Performance test) | Implemented and Tested (e2e). It runs a fixed 40 s battle at about 80, then about 200 programs, and shows fps and frame/render/sim p50/p95/p99. You can copy the results or save them to a file. The last 5 runs are kept in the browser. **Run this on the Air** and paste the copied table back. |
| Wave telegraph | Implemented and Tested. "Rival forces massing (N of about M programs)" appears from 30 s before a wave is due once half of it is assembled, with an alarm, a red ground marker and a minimap pulse. "Rival wave launched" fires when it actually moves. |

---

# HANDOFF — session 4 (2026-09-23): 0.3.1, motion, x-ray and a fair mirror match

Committed on branch `iso-art-0.3` in `~/Downloads/kernel-keep`, which is checked out there.

**Presentation (simulation untouched):**
- Programs hidden behind structures show through as team-coloured silhouettes. Operators working inside buildings are left hidden.
- Motion from the single pose:
  - the lower body swings while walking;
  - ranged programs kick back and show a muzzle flash; melee programs lunge;
  - new programs compile in from the ground;
  - destroyed programs and structures de-rez into glitching slices.
- A narrower top bar for laptop widths, and thinner beams.

**Fairness (simulation changed; new hash `adb5621a`):**
- Mirror matches are now exactly symmetric, 11–11 over 24 paired games. The fixes and the evidence are in docs/FAIRNESS_RESULTS.md.
- A regression test guards it: `tests/fairness.test.ts`.
- One test (`hardened walls`) was corrected to measure from the Breaker's spawn. The idle Breaker now auto-targets on its first tick; the expected damage is unchanged.

**Still open:**
- Real animation frames and several facings would need new art.
- The Tauri shell has not been built.
- Nothing has been measured on the Air.
- The art still needs rights clearance.

---

# HANDOFF — session 3 (2026-09-23): concept art integrated into the battlefield → prototype 0.3

**Request:** "full integration between the imagery and the units and layout in the game." Ryan chose:
- an isometric camera;
- red-shifted Rival art;
- sprites cut from the existing sheets (free and offline; no generation credits used).

**Where it is:** branch `iso-art-0.3` (on top of `react-hud-0.2`) in `~/Downloads/kernel-keep`. It is checked out there. `master` (0.1) and `react-hud-0.2` are unchanged.

| Area | Status |
|---|---|
| 32 sprites (16 types × 2 teams) cut from the concept sheets (`tools/art/cut_sprites.py`) | Implemented |
| Isometric projection for drawing, picking, box select, placement, camera and minimap (`src/client/iso.ts`) | Tested (e2e 36/36) |
| Program sprites: facing, bob, recoil, hit flash, carry cube, suspended/fork looks | Implemented |
| Structure sprites: hologram construction, grey when off, working pulse, sparks, gate barrier, selection glow | Implemented |
| Firewalls as procedural panels and pillars in the concept's material | Implemented |
| HUD aligned with the kit: cut-out portraits, card-style commands with icons, program roster, Structures/Economy tabs, Sector view | Tested (roster e2e) |
| Simulation untouched (hash `e232a74a`) | Tested |

**Known issues (new in 0.3):**
1. Each program has one pose; there are no walk or attack frames yet.
2. Tall structures can hide programs behind them. Selected programs show a silhouette, but unselected ones do not.
3. Firewall art is procedural rather than cut from the sheet, so that any drawn line joins cleanly.
4. The build is 2.49 MB.
5. Container fps is lower than 0.2's on software rendering. Measure on the Air.
6. The generated art still needs rights clearance before any public release.

**Next:**
1. Play on the Air with F3 open.
2. If you want more poses and angles, generate dedicated sprite turnarounds. That would use paid generation, so confirm costs first.
3. Merge `iso-art-0.3` when you're happy with it.

---

# HANDOFF — session 2 (2026-09-23): Master v0.2 kit integrated → prototype 0.2

**Request:** dissect `~/Downloads/Kernel_Keep_Master_v0.2` and integrate it into the game. The chosen approach was *rebuild the HUD in React now*.

**Where it is:**
- Branch `react-hud-0.2` in `~/Downloads/kernel-keep`. `master` is unchanged (0.1).
- The same tree is in the zip sent in chat.

**Done:**

| Area | Status |
|---|---|
| React 19 HUD + menus driven by the real sim through `EngineHost` (`src/client/engine.ts`, `view.ts`, `src/ui/`) | Tested (e2e 32/32, unit 32/32) |
| Recovery panel (starvation, low Code, brownout, suspension, memory, crash risk → existing commands) | Tested |
| Concept art: menu background, 16 portraits, codex sheets (UI only) | Tested (images decode) |
| Optional PWA (`?pwa` over http) | Tested in Chromium |
| Optional Tauri 2 shell (`desktop/src-tauri`) | **Blocked here**: never compiled |
| Fairness: id-order bias found and fixed (separation, simultaneous hits, mirrored tie-breaks, arrival epsilon) | Tested |
| Licences / notices | Done |

**Known issues (new in 0.2):**
1. **Residual P1 mirror advantage**: 18–6 over 24 paired AI games. The cause traced so far is float positions that aren't mirror-exact, amplified at crowded wells. See `docs/FAIRNESS_RESULTS.md` for the suspects.
2. **Reference hash changed** from `0e3de02e` to `e232a74a`, on purpose, because of the fairness fixes. A 0.1 save loads, but it plays on under the 0.2 rules.
3. **Build size** is 1.31 MB (was 118 KB). The biggest piece is the menu art.
4. **Container browser battle fps** is 47 with 164 units (software GPU). Measure on the Air.
5. The concept art was generated with a user-supplied style reference. Clear its rights before any public release.

**Next:**
1. Play `dist/kernel-keep.html` on the Air and check the HUD, with F3 open.
2. Decide whether to merge `react-hud-0.2` into `master`.
3. Fix the residual fairness bias.
4. Optionally run `cd desktop && cargo tauri dev` (needs Rust).

---

# HANDOFF — end of session 1 (2026-09-23) (0.1, kept for history)

## What was built

This is a new, standalone project (`kernel-keep/`, its own git repository). No repository was supplied, and none of your existing apps were touched. Everything here is new:

| Path | Purpose |
|---|---|
| `src/sim/` (10 files) | Deterministic simulation: types, rng, map, nav, world, systems, commands, ai, game, save |
| `src/data/balance.json` | All tuning data |
| `src/client/` (7 files) | Canvas 2.5D renderer, HUD, input, menus, settings, audio, HTML shell |
| `tests/` (3 suites + helpers) | 29 simulation tests |
| `e2e/e2e.mjs` | 23 browser checks; screenshots in `e2e/out/` |
| `tools/` | `build.mjs`, `econ_sim.ts`, `bench.ts`, `aivai.ts` |
| `spike/` | Engine feasibility benchmark (GDScript + JS) |
| `dist/kernel-keep.html` | **The playable build** (single offline file) |
| Root docs + `docs/` | START_HERE, GAME_DESIGN, ECONOMY_AND_BALANCE, RESEARCH, ARCHITECTURE (+5 ADRs), ART_AND_UI_GUIDE, BUILD_PLAN, TEST_REPORT, this file; `docs/ECON_SIM_RESULTS.md`, `docs/test-logs/` |

**Binary status:** no native desktop binary was built. `dist/kernel-keep.html` is the runnable artifact. It was tested in headless Chromium on Linux only.

## Known issues

1. **Mirror-AI fairness.** Player 2 wins the current seeded AI-vs-AI match at 13:53 (an earlier build had player 1 winning). Suspects: update-order bias (lower entity ids act first) or building-placement tie-breaks. This doesn't affect human vs AI directly, but it should be understood before tuning.
2. **Seeds barely matter.** Randomness is used only for crash selection, so matches on the fixed map play out the same way. Variety should come from AI personalities or map variants (backlog).
3. **The Rival doesn't build walls** (disclosed). It does build towers.
4. **Auto-pulling of Runners.** The Training Grid and unstaffed operator buildings take *harvesting* Runners when none are idle. That's intended to reduce micromanagement, but a human may find it surprising. Watch for it in playtests.
5. Walls don't block sight, and there's no wall-top movement (deferred by design).
6. In very large fights, some units wait a tick or two for a path because of the pathfinding budget. It reads as a tiny hesitation.
7. The camera can start with an off-map margin on the left, because your Core sits in the corner.
8. On macOS, **Cmd+number may switch browser tabs**; use **Ctrl+1–9** for control groups. The Mac "delete" key (Backspace) works as Decompile.
9. Browser storage holds one quick-save slot plus the autosave (per browser). Use Export or Import for files.

## Blockers (outside this environment)

- **Running it on your MacBook Air M4 and measuring it:** the target machine is needed (F3 overlay).
- **Desktop packaging:** not attempted. Electron packaging is the proposed next step.
- **macOS notarization:** requires the paid Apple Developer Program. Nothing was purchased; that's your call.
- **Windows verification:** needs a Windows machine or CI runner.
- **Human playtesting:** needs people. The script is in TEST_REPORT.md §5.

## Exact next tasks

1. Open `dist/kernel-keep.html` in Chrome on the Air. Play Normal once, following the playtest script, and note the F3 fps and ms/tick.
2. Tune `src/data/balance.json` from what you see. Then run `npm run verify && npm run econ`, and commit.
3. Investigate the AI fairness issue: run `npx tsx tools/aivai.ts` with the players' update order swapped.
4. Add the 30-second "Rival forces massing" warning before waves.
5. Add the Electron wrapper (`desktop/`), then build an unsigned macOS arm64 dmg and a Windows x64 portable. Smoke-test both.
6. Add WebKit to the e2e determinism check, in case Tauri is chosen later.

## Assumptions I made (all reversible)

- Title "Kernel Keep" is provisional.
- TypeScript + Canvas stack (ADR-001).
- One map, one faction mirrored.
- Hash Credits are purely fictional and match-local.
- The AI knows start positions.
- Upkeep cycle 20 s.
- Everything is in a new isolated folder, delivered as a zip.
