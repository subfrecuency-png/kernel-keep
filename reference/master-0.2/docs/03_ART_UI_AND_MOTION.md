# Art, HUD and motion specification

## Visual direction

Dark navy environment, graphite architectural masses, cyan friendly circuitry, amber production surfaces and crimson rival markers. Purple is an accent for Memory and later anomalous environments, not evidence that a Synth faction is implemented. Use shape differences as well as color: friendly squares, hostile triangles, role-specific silhouettes and explicit danger symbols.

The main menu can be cinematic. Tactical play should be quieter, with limited bloom and large clear routes. The React HUD uses native text and controls; never paste a complete generated HUD image over the playable field.

Core proposed tokens: background `#07121c`, surface `#0b1e2c`, divider `#294655`, text `#e8f5fc`, muted text `#9ab1bf`, friendly `#69d9e7`, supply `#e8b66f`, healthy `#82d4bb`, danger `#f17c90`, Memory `#b5a0f4`. Test final contrast after art integration; colors alone are not a completed accessibility audit.

## Reconciled roles

| Kernel Keep role | Earlier concept mapping | Silhouette rule |
|---|---|---|
| Runner | Worker + Miner visual duties | Compact body, tool and visible carried Data |
| Ping | Scout | Thin legs and swept sensor antennae |
| Bulwark | Defender | Broad shoulders and large physical shield |
| Lancer | Ranged | Narrow body and long precision weapon |
| Patcher | Support | White armor plates, repair arm and drone |
| Breaker | Siege | Low, wide, heavy artillery chassis |

The prior Commander illustration is an optional legacy design. Do not add a commander entity merely because Fork exists. Animation semantics and gameplay stats require the actual source.

## Reconciled structures

| Kernel Keep structure | Art treatment | Legacy rule |
|---|---|---|
| Core | Tall cubic heart and four spires | Adapt Core Nexus visual |
| Data Cache | Low receiving depot and crates | Do not assume Data Harvester mechanics |
| Compiler | Three fabrication vats and output bay | Adapt Code Compiler |
| Mining Rig | Amber extraction machinery | Adapt Miner; Hash stays fictional |
| Compute Node | Broad server block with four cooling towers | New distinct silhouette |
| Memory Bank | Tall stacked data slabs | New distinct silhouette |
| Training Grid | Open practice yard with hangar | Adapt Barracks |
| Firewall | Solid modular straight/corner wall | Not a flame obstacle |
| Access Gate | Matching piers and open passage | Open/closed art must match collision state |
| Sentry Tower | Narrow turret landmark | Adapt Defense Tower |

Research Lab and Repair Station from the earlier sheet are not part of the ten. Preserve their illustrations only in the legacy folder.

## HUD rules for the real game

Top bar: Data, Code, Hash, Compute and Memory. Show units, distinguish stocks from capacities, and keep icons plus names visible. Data should reflect delivered stock; show carried or reserved quantities in a tooltip only if the simulation tracks them. Show Code production, consumption and net rate in the expanded view. Never display net reserve time for a nonnegative net rate.

Stability is its own condition indicator, not a sixth spendable currency. The warning panel should explain the consequence and available recovery actions. Derive rations, crashes, brownout and suspension from engine state; do not import sample thresholds from this lab. Memory should show the engine's actual reservation and suspension accounting.

Keep minimap bottom-left, selected entity/formation adjacent, contextual options bottom-center/right. The lab adds inspectable Programs, Structures and Economy tabs. In integration, commands must vary by actual selection and availability. Fork needs engine-provided eligibility, cost, duration, cooldown and rejection text before it becomes an enabled game ability.

Construction requires cursor-world coordinates, actual footprint validation and unobstructed input handling. The lab is not a construction system. Gate visuals and minimap entries must follow simulation transitions, not optimistically flip because a button was clicked.

Show warnings once per meaningful transition and keep persistent status without repeated flashing. Avoid covering the center of battle with large modal dialogs. Keyboard navigation and selection alternatives must accompany pointer interactions.

## Art delivered and how to use it

- `kernel-menu-background.png`: ready as an opaque menu background; used in the React UI. Keep copy on the dark left side.
- `kernel-six-roles.png`: concept board, also used as temporary CSS portrait crops. Crops include sheet artifacts and are not final portrait exports.
- `kernel-ten-structures.png`: concept board for building production. It is not an atlas or texture sheet.
- Six `art/legacy` boards: preserve the earlier creative work, but do not use their counts, UI controls or numbers as authoritative game definitions.
- Original reference sheet and original master prompt: retained unchanged under `original-inputs`.
- Six `evidence` PNGs: actual screenshots of the implemented UI. They are not screenshots of prototype 0.1.

All generated imagery uses the supplied sheet for visual reference. Final generated files are copied unchanged. Their prompts are in `art/GENERATION_PROMPTS.json`. Source/license provenance is in `ASSET_MANIFEST.json`; no third-party asset-pack license or exclusive copyright assurance is invented.

## Proposed production export pipeline

1. After actual camera/projection inspection, settle one orthographic camera, lighting rig and ground plane. Do not trace inconsistent perspectives into gameplay hitboxes.
2. Export isolated roles with real alpha, uniform scale and a foot pivot. Minimum initial actions: idle, move, attack/work, damaged and decompile. Add repair/haul behavior where used. Export directions only if the renderer supports them.
3. Start with 128–192 px source sprites for units and 256–512 px for buildings as tunable budgets, not measured requirements. Test their apparent size at the actual camera zoom before committing.
4. Export buildings separately, including construction, complete and damaged states where needed. Separate the gate leaf from its piers for animation. Use the engine footprint as the source of truth.
5. Keep team tint/emissive layers separate. Reuse mirrored-faction geometry unless the source has a real faction distinction. Avoid six recolored copies of every texture if tinting works.
6. Pack one or more 2048 px atlases with padding as an initial experiment. Measure decode time, resident texture use and batching on the Air. Keep the procedural renderer available as a low-detail fallback.
7. Generate contact sheets and inspect every exported frame for silhouette drift, alpha fringes, pivot jitter, clipping and world-scale consistency. Keep ground collision separate from cosmetic glow.

This production export pipeline is proposed. No rigged 3D models, animation sprite atlases or individual alpha-cutout battlefield assets were created in this kit.

## Motion

Implemented locally: six slow Canvas data particles; restrained CSS hover/selection transitions; gate open/closed presentation toggle; pause/resume; automatic hidden-tab animation stop; OS reduced-motion and local reduced-motion preference support. The gate toggle currently changes state immediately, not via a physics or navigation animation.

Proposed real-game timings (presentation values to playtest): selection ring settle 120 ms; panel reveal 140 ms; build ghost fade 100 ms; gate visual travel 250 ms tied to authoritative gate state; impact flash at most 80 ms with reduced-flash substitution; Fork split trace about 400 ms, only after confirmed activation. Use a fixed pool and strict per-frame limits for particles.

No Higgsfield video was necessary. A video would not provide interactive unit animation, authoritative gate timing or editable HUD states, and could add decode cost. A short menu loop can be considered later as optional decoration after the static menu and gameplay budget are accepted.
