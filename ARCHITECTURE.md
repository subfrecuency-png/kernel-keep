# ARCHITECTURE — Kernel Keep

## 1. Shape

```
src/
  data/balance.json     ← all tuning: units, buildings, economy, AI timings (data-driven)
  sim/                  ← authoritative simulation. No DOM, no rendering, no wall-clock time.
    types.ts            entity/player/command/event types; loads balance.json
    rng.ts              seeded mulberry32 (single uint32 state → exact save/restore)
    map.ts              "Meridian Divide": point-symmetric terrain, cores, wells
    nav.ts              tile grid, per-player passability (gates), A* with breach mode, per-tick budget
    world.ts            state container, spawn/kill, caps/compute/memory queries, spatial hash, alerts
    systems.ts          economy, buildings, training, towers, unit orders, movement, combat, separation, fog
    commands.ts         validated command API (the only way players/AI change state) + placement rules
    ai.ts               Rival Kernel: bounded rule-based opponent using the same command API
    game.ts             fixed-tick orchestrator, command log, replay, state hash, perf counters
    save.ts             versioned save/load (schema 1)
  client/               ← presentation only; reads the World, sends Commands
    engine.ts           EngineHost: the single rAF loop, camera, input, selection, commands, save/load,
                        settings, and an immutable Snapshot store for React (useSyncExternalStore)
    view.ts             pure view models: topView, recoveryView, selectionView, command card, objectives
    render.ts           Canvas 2.5D renderer, fog overlay, minimap, placement ghost (unchanged from 0.1)
    settings.ts audio.ts state.ts index.html
  ui/                   ← React 19 components (0.2): App, Hud (top bar, alerts, recovery, objectives,
                        selection, command card), Menus (title, pause, settings, controls, codex, game over)
    assets.ts           concept-art crops imported as data URLs; styles.css uses the kit's design tokens
tests/                  node:test suites run against the real simulation (no mocks)
tools/                  build (esbuild → single HTML + optional PWA files), econ_sim, bench, aivai, fairness, serve
desktop/src-tauri/      optional Tauri 2 shell (untested; see desktop/README.md)
e2e/                    Playwright browser test driving real mouse/keyboard input
```

**Rule:** the client never mutates simulation state directly. Every player action becomes a `Command` → `applyCommand()` validates it and returns `{ok, reason}`. The AI uses the same function.

## 2. Simulation loop (fixed tick, 10 Hz)

`Game.step()` runs these in order:
1. reset the per-tick path budget;
2. **fog** (per-player visible grid, explored grid, last-seen enemy structures);
3. rebuild the unit spatial hash;
4. **economy** (Core trickle, upkeep × ration, stability drift, crashes, caps, warnings);
5. **buildings** (operator staffing, Compiler cycles, mining with falloff and brownout, training queues, towers);
6. **units** (fork expiry, heals, engaged targets, auto-acquire staggered every 3 ticks, orders: move/attack-move/attack/harvest/build/repair/operate/hold);
7. rebuild the spatial hash, then **separation** (soft push that never moves a unit into a blocked tile);
8. **compact** (remove dead entities);
9. **AI** updates (each AI acts every 10 ticks, offset by player id);
10. `tick++`.

The client runs its own `requestAnimationFrame` loop. It accumulates real time × speed, steps the simulation at 10 Hz (at most 8 steps per frame, so a slow frame can't spiral), and interpolates unit positions between the last two ticks for smooth motion. Pause stops stepping, but commands still apply, the way *They Are Billions* allows (RESEARCH #10).

## 3. Determinism and reproducibility (Tested)

- The only randomness is `world.rng` (seeded; the state is saved). Its single consumer today is crash victim selection.
- Iteration is always in entity-id order. The entity array is append-only and compacted in place.
- The simulation uses only `+ − × ÷` and `Math.sqrt`, which are correctly rounded in IEEE-754. Squares are written as multiplication; there's no `Math.pow`, `**` or trig in `src/sim` (the client uses `atan2` for facing only).
- **Replay:** `Game.log` records every accepted human command with the tick it was applied before. `replay(opts, log, ticks)` re-runs it, and AI commands regenerate deterministically. A test confirms an identical state hash.
- **Save/load:** saves entities, players, the RNG state, the tick, the nav version, visible and explored grids, AI state and the command log. Nav, spatial hash and budgets are rebuilt. A test confirms that an uninterrupted run and a save → load → continue run have identical hashes 3000 ticks later.
- **Cross-runtime:** the Node test build and the bundled browser build produce the same hash for the same seed over 3000 ticks (e2e). **Limits:** both runtimes are V8. JavaScriptCore (Safari/Tauri on macOS) and SpiderMonkey are untested, so cross-platform lockstep isn't claimed. Multiplayer would need that check plus desync hashing each tick.

## 4. Navigation

- **Grid:** 64×64 tiles. Terrain is `0` (lattice) or `1` (void). Buildings stamp their footprint into `block[]` (building id) and `blockOwner[]`.
- **Gates:** `gate[i] = ownerId` when an open, built gate occupies the tile. `passable(i, player)` is true for open ground, or for an open gate whose owner is that player. Enemies are never allowed through.
- **A\*:** 8-connected with no corner cutting, octile heuristic weighted ×1.15 (fewer expansions, near-optimal paths), binary heap on typed arrays, generation stamps (no clearing). The goal is a rectangle, so "reach a building" is simply "arrive next to its footprint".
- **Unreachable goals:** the search returns a path to the closest reachable tile (`partial=true`). Move orders stop there cleanly (Tested).
- **Breach mode:** enemy structures become passable at +6 cost per tile. Attack-move and attack orders try it only when no open route exists, then attack the first blocking structure (Tested).
- **Repath triggers:** any footprint or gate change increments `nav.version`. Units whose remaining path crosses a now-blocked tile, or whose path was partial, re-plan (throttled). Stuck detection re-plans after 2 s without progress and gives up after 4 attempts. A building placed on top of units ejects them to the nearest open tile (Tested).
- **Budget:** at most 12,000 node expansions per tick across all searches. Units over budget wait with `pathDeferred` and retry next tick. This cut the worst tick in a 100-per-side battle from about 233 ms to about 9–13 ms (TEST_REPORT.md).
- **Formation:** move orders spread units on a square grid (0.8-tile spacing) around the click. Flow fields for large groups are Proposed.

## 5. Jobs, queues, reservations, population

- **Operators:** every 10 ticks, an unstaffed, switched-on operator building pulls the nearest *free* Runner (idle first, then harvesters preferring empty-handed ones; never builders, repairers or other operators). Switching a building off releases its operator.
- **Training:** costs are paid when an item is queued (queue ≤ 5). When the head item *starts*, the Grid consumes a free Runner (by the same rule) and reserves the unit's Memory (net of the Runner's 1). If Memory is short or no Runner is free, it waits and says why. Progress = dt × work speed × compute efficiency (Grid only). On completion it spawns on a free adjacent tile; if none exists it holds at 100% with "spawn blocked" (Tested). Cancelling refunds the full paid cost and, if the item had started, returns the Runner.
- **Construction:** paid on placement; sites block the grid immediately. Builders add work linearly. Cancelling refunds 100%, demolishing refunds 25%. Builders move on to the nearest unfinished own site within 10 tiles (for wall lines).
- **Memory accounting:** memory used = non-fork units + started queue items. Tested after training, cancellation, death and save/load.
- **Object removal:** `kill()` marks an entity dead, releases operator links, kills its forks, clears footprints, drops salvage and fires events. `compact()` removes dead entities at the end of the tick.

## 6. Fog of war and information boundaries

- Radial sight per entity (walls don't occlude, in the prototype). Visibility is recomputed every tick and explored tiles accumulate. Enemy structures are remembered as "last seen" ghosts until you see their spot empty.
- The command layer enforces fog: `attack` requires the target to be visible to the issuing player. Auto-acquire and tower targeting check `canSee`. Building placement requires explored tiles.
- **AI disclosure:** the AI knows the map and both start locations (by design, like a player who knows the map). It sees only what its units and buildings see, and it gets no resource or speed bonus. A test wraps every AI command and asserts it attacked only visible targets.

## 7. Presentation

Canvas 2D with a fake-3D ("2.5D") extrusion for buildings. The fog is a 64×64 ImageData scaled over the world with smoothing (one draw call). Hot paths are culled to the viewport, and the minimap redraws every 3rd frame. The renderer is replaceable: it only reads `World` and `ClientState`.

**0.2: React HUD behind an adapter (Implemented, Tested).** The DOM HUD from 0.1 (`hud.ts`, `main.ts`) is replaced by React components, and the simulation is untouched by this layer:

```
 React (src/ui)  ──intents──▶  EngineHost (src/client/engine.ts) ──Command──▶ applyCommand() ─▶ World
      ▲                              │  one rAF loop: fixed 10 Hz sim steps + Canvas render
      └── useSyncExternalStore ◀─────┘  publishes a frozen Snapshot ~10×/s when dirty (view.ts)
```

- `EngineHost.mount()` is idempotent, so React StrictMode's double mount cannot start a second loop. The e2e test asserts exactly one loop at 10 ticks/s.
- Components never read `World` directly. They render view models from `view.ts`, which the unit tests (`tests/view.test.ts`) check against the engine's own queries.
- Every button is an existing command, or a camera/selection action. The recovery panel adds no mechanics.
- Keyboard input goes through `EngineHost.onKeyDown`. It ignores form fields, key-repeat (except panning) and key capture while rebinding.
- Build: esbuild bundles TSX (automatic JSX runtime) plus webp/svg as data URLs into one `dist/kernel-keep.html` (~1.31 MB). `file://` stays the default launch. The PWA files are used only when served over http(s) with `?pwa`.

## 8. Saving

`src/sim/save.ts`, `SAVE_SCHEMA = 1`. JSON with run-length-encoded fog grids. Loading a different schema fails with a clear error (Tested). The client offers quick save/load (browser storage, try/catch guarded), a 60-second autosave, and export/import of `.json` save files. Balance version is recorded in each save; migrations are Proposed for when balance changes invalidate old saves.

## 9. Diagnostics

- **F3** overlay: fps, average/max simulation ms per tick, unit count, tick.
- `Game.perf` tracks step timings. `npm run bench` runs scripted battles (25–200 per side).
- `stateHash()` fingerprints the world for replay and desync checks.
- Alerts carry positions (click to jump). Buildings expose a `stall` reason that the HUD explains in plain language.
- `window.__kk` test hooks exist for the e2e harness and for debugging.

## 10. Extension points (deliberately not built)

- **Multiplayer:** commands are already serializable and validated, and the simulation is fixed-tick and seeded, so lockstep is plausible. Needed first: cross-engine determinism tests, per-tick desync hashes, input delay, and removing client-side access to hidden state.
- **Factions:** `balance.json` would get per-faction unit/building sets. `AIState` already accepts `plan`/`comp` overrides as personalities.
- **Modding:** balance is plain JSON. No scripting API, by design (no arbitrary player code is ever executed).
- **Renderer swap** (PixiJS/WebGL, three.js, or a Godot port): only `src/client/render.ts` depends on Canvas.

## 11. Decision records

- [ADR-001 Stack](docs/adr/ADR-001-stack.md)
- [ADR-002 Fixed-tick deterministic simulation](docs/adr/ADR-002-deterministic-sim.md)
- [ADR-003 One logistics model](docs/adr/ADR-003-logistics.md)
- [ADR-004 2.5D Canvas presentation](docs/adr/ADR-004-presentation.md)
- [ADR-005 Pathfinding budget and breach routing](docs/adr/ADR-005-pathfinding.md)
