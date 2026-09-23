# HANDOFF — end of session 1 (2026-09-23)

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
