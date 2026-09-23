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
