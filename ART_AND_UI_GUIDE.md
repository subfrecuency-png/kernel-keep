# ART_AND_UI_GUIDE — Kernel Keep

## 1. Art bible (original; no reference game's characters, logos, maps or signature designs are used)

> **0.3: the battlefield uses the concept art.** The view is now **isometric (2:1)**, matching the angle of the Master v0.2 structure renders. Every program and structure on the map is its concept render, cut out as a sprite. The same cut-outs are the HUD portraits, command cards, roster and codex, so the map and the interface show one set of images. The 0.1 procedural descriptions below are kept where they still apply.

**World:** the inside of a vast, cold machine, seen at a 2:1 isometric angle. The ground is a dark navy **lattice** (a 1-tile grid, with brighter lines every 8 tiles so you can judge distance). The **void** is a near-black violet rift with glowing lips. It's the rift you can't cross, and it creates choke points. On this map the central rift runs straight up the screen: you start in the west, the Rival in the east. Data wells are clusters of pale-blue crystals that bob slowly, with a ring on the ground showing how much is left. Salvage fragments are smaller and violet.

**Fortresses (0.3):** each structure is its concept render, scaled so its base spans its footprint diamond (`src/client/iso.ts` → `buildingRect`):
- Under construction, a pale hologram of the finished building shows, and the real building rises from the ground with a team-coloured scan line.
- A switched-off, unpowered or remembered building is desaturated.
- A working producer (Compiler, Rig, Node or Core) pulses softly.
- A damaged building throws sparks.
- A closed Gate shows an energy barrier inside its arch.
- **Firewalls** are modelled procedurally in the concept's material, so any drawn line joins cleanly: graphite panels with a stepped glowing trace between taller pillars with antennas and amber lights.

**Programs (0.3):** each role is its concept render, standing on its ground point:
- Sprites turn to face their movement or their target, bob while walking and recoil when firing.
- They flash when hit.
- A Runner carrying Data shows a small cube.

Silhouettes stay distinct: a hunched Runner with a cube, a spindly Ping, a shield-bearing Bulwark, a Lancer with a long rifle, an armed Patcher, and the four-legged Breaker cannon. The 0.1 geometric shapes remain only as a fallback while the sprites decode.

**Ownership without relying on colour:**
- Your programs stand on a **circular ring**. Enemy programs stand on a **square ground marker** (a diamond on screen).
- Each structure has a team-coloured pad under it; an enemy's pad is dashed.
- **The Rival's art is red-shifted** (`tools/art/cut_sprites.py`): blue and cyan glows become crimson, while amber, graphite and white stay as they are. The Rival's UI colour is now crimson `#ff4d6a` (0.1–0.2 used orange). Shapes and markers still carry ownership for colour-vision deficiencies.

**Status language:**
- Suspended or crashed: greyed out, with `z` or `!z`.
- Fork: pale, washed-out copy at 72% opacity with a violet countdown ring.
- Veterans: gold chevrons.
- Buildings: HP bar when damaged or selected; yellow `!` when stalled; `⏸` when switched off.

**Light and effects:**
- Glow comes from the art's own emissive detail, plus bright strokes with a soft two-stroke halo. There's no blur or bloom pass, which keeps rendering cheap.
- Beams are thin lines in the owner's colour (0.14 s). Siege shots are thick, with an impact ring. Heals are dashed green.
- Deaths are expanding rings with shards. Completed buildings pulse with a white ring.
- Selection is always white: a ring around units and a dashed footprint plus a soft highlight on buildings. Selected programs also show a faint silhouette through structures that stand in front of them.

**Motion priorities:** smooth interpolated movement first, then work feedback (Compiler gear turning, Rig bars pulsing, Grid lights while training, "+Code/+Hash/+10" pop-ups), then combat beams. Unit facing appears only on Ping and Lancer.

**Sound direction:** short, original synthesized tones (WebAudio oscillators, no samples):
- a click on select, a two-note chirp on orders, a low buzz when refused;
- a rising chime when construction finishes;
- a two-tone alarm when under attack (throttled to one every 4 s);
- ticks for beams and a low sweep for siege shots;
- victory and defeat arpeggios.
Music is Proposed (see the backlog).

**Typography:** system UI sans for text and system monospace for numbers, so figures don't jitter. Resource names are always spelled out; there are no icon-only resources.

## 2. HUD and interaction (Implemented; rebuilt in React in 0.2)

In 0.2 the HUD uses the Master v0.2 kit's tokens: background `#07121c`, surface `#0b1e2c`, divider `#294655`, friendly `#69d9e7`, supply `#e8b66f`, healthy `#82d4bb`, danger `#f17c90`, memory `#b5a0f4`. It also gains a **recovery panel**, which lists real problems (starvation, low Code, brownout, suspended programs, memory, crash risk), each with one-click fixes that are existing commands. The selection panel and command card show concept portraits. The **Art codex** (title or pause menu) shows all 16 portraits with live balance stats and the two concept sheets.


- **Top bar:** chips for Data, Code, Hash, Compute, Memory and Stability. Each shows value/limit plus a live subline (net Code per minute and seconds of reserve left; BROWNOUT %; "storage full"). A chip border turns amber or red on problems. Hovering explains the resource in plain words. Ration buttons (Lean/Std/Surplus) sit under Stability. There's also a clock, a speed toggle (1× / 1.5× / 2×), Pause and Menu.
- **Alerts** (top-left): the five most recent, severity-coloured. Click one to jump the camera; **Space** jumps to the latest.
- **Objectives** (top-right): a 9-step guided checklist with a hint for the current step. Completed steps stay checked. The panel can be collapsed, and hints can be turned off.
- **Bottom:**
  - Minimap: click or drag to move the camera; right-click to move the selection.
  - Selection panel: name, role, integrity bar, state in plain language, upkeep/attack stats, experience, and a **"why" box** explaining stalls. The training queue is shown as clickable items; clicking one cancels it with a refund.
  - Command card: context-sensitive buttons with hotkey letters and costs, greyed out when unaffordable, each with a tooltip.
- **Mouse:**
  - Left: select, drag-select (combat programs are preferred in a mixed box), double-click to select all of a type on screen.
  - Right: smart order — attack, harvest, assist construction, repair, operate, move, or set rally when a building is selected.
  - Wheel zooms at the cursor. Middle-drag pans.
- **Keyboard (rebindable in Settings → Controls, except the fixed Ctrl/number group keys, Esc and F1):** A attack-move, S stop, H hold, F Fork, Z suspend/resume, O switch building on/off or open/close gate, Delete decompile/demolish/cancel. Build keys (Runners selected): C M N K D T R W G. Train keys (Core or Grid selected): Q W E R T. Ctrl+1–9 set groups, 1–9 recall (double-tap centres), P pause, `.` idle Runner, Home centre on Core, F1 controls, F3 performance overlay, arrow keys pan, edge scroll optional.
- **Accessibility:**
  - Interface scale 0.8–1.6× (all HUD text scales).
  - **Reduced flashing and motion** (stops pulses and animated glyphs).
  - Mute and volume.
  - Every alert is shown as text as well as sound.
  - Warnings are colour **plus** text **plus** icon.
  - Pause-and-order.

## 3. Placeholder policy

**0.3:** the battlefield draws the **generated concept renders as sprites**. This goes beyond the kit's note that concept sheets are not production sprites, and it was done at Ryan's request. Their limits:
- one pose per role and one angle per structure; motion is suggested with bob, lean, recoil and flash, and there are no animation frames;
- lighting is baked in;
- edges come from an automatic matte;
- the rights to the style reference have not been independently cleared.

Terrain, wells, Firewalls, effects and sound remain **procedural and original**. Gameplay and collision never depend on image sizes: sprites are scaled to the simulation's footprints and radii. Replacing a sprite means dropping a new WebP into `assets/art/sprites/` and running the cutter, or editing `sprites.json`. No code change is needed.

**Sprite pipeline** (`python3 tools/art/cut_sprites.py`, a build-time tool only; nothing is fetched at runtime):
1. Crop each cell of the two concept sheets, leaving out the labels.
2. Matte the background with `rembg` using the IS-Net general-use model. The model is downloaded by rembg on first use, runs offline, and is not shipped.
3. For programs, remove the studio-floor reflection below the feet.
4. Trim, then scale: programs to 220 px tall, structures to 400 px wide.
5. Write the P1 image and a red-shifted P2 variant as WebP with alpha.
6. Record each sprite's size and ground anchor in `assets/art/sprites/sprites.json`.

At run time `src/client/sprites.ts` keeps pre-scaled, pre-filtered copies in 8% size buckets: normal, grey, suspended, fork, hologram and glow.

## 4. Asset / licence manifest

| Asset | Source | Licence | File path | Status | Replacement need |
|---|---|---|---|---|---|
| Lattice terrain, void edges | Procedural Canvas drawing, original | Project-owned | `src/client/render.ts` (terrain section) | Implemented | Optional: textured tiles or 3D terrain |
| Data well crystals / fragments | Procedural, original | Project-owned | `src/client/render.ts` (`drawWell`) | Implemented | Optional sprite |
| 9 structure sprites (Core … Tower, Gate) ×2 teams | Cut from the ten-structures concept sheet (below) by `tools/art/cut_sprites.py` | As the sheet | `assets/art/sprites/<type>-p1.webp`, `-p2.webp` | Implemented (0.3, on the map) | Production art with several angles |
| Firewall segments | Procedural, modelled on the concept's Firewall | Project-owned | `src/client/render.ts` (`drawWall`, `wallBox`) | Implemented (0.3) | Tileable wall-piece sprites |
| 6 program sprites ×2 teams | Cut from the six-roles concept sheet (below) by `tools/art/cut_sprites.py` | As the sheet | `assets/art/sprites/<role>-p1.webp`, `-p2.webp` | Implemented (0.3, on the map) | **Needed**: animated frames / several facings |
| Ownership rings, rank chevrons, bars | Procedural, original | Project-owned | `src/client/render.ts` | Implemented | — |
| Beams, bursts, rings, pop-up text | Procedural, original | Project-owned | `src/client/render.ts` (effects) | Implemented | Optional polish |
| Minimap | Procedural | Project-owned | `src/client/render.ts` (`renderMinimap`) | Implemented | — |
| HUD layout, colours, CSS | Hand-written, original; tokens from the Master v0.2 kit | Project-owned | `src/ui/styles.css`, `src/ui/*.tsx` | Implemented | — |
| UI font | System UI / system monospace (not bundled) | OS-provided, no redistribution | — | Implemented | Choose and license a bundled font (e.g. an OFL font) |
| Sound effects (11 functions, 12 distinct sounds) | WebAudio oscillator synthesis, original | Project-owned | `src/client/audio.ts` | Implemented | **Needed**: designed SFX |
| Music | — | — | — | Proposed | Original score (commission or compose) |
| Menu background (1672×941) | Built-in image generation, from the prompts in `reference/master-0.2/GENERATION_PROMPTS.json`, with the user-supplied reference image used as a **style reference** | Generated for this project; the reference image's rights were not independently verified | original `assets/art/concept/kernel-menu-background.png` (sha256 61ac7558…), shipped as `assets/art/derived/menu-background.webp` | Implemented (title screen) | Clear the rights before any public release |
| Six-roles sheet (1536×1024) | Same generator and prompts | Same | `assets/art/concept/kernel-six-roles.png` (dd2b73ac…) → `derived/sheet-six-roles.webp` (codex) and the 12 program sprites | Implemented (map, portraits, codex) | Production unit sprites or models |
| Ten-structures sheet (1536×1024) | Same generator and prompts | Same | `assets/art/concept/kernel-ten-structures.png` (16dc1de3…) → `derived/sheet-ten-structures.webp` (codex) and the 20 structure sprites | Implemented (map, portraits, codex) | Production building art |
| App icon (svg, 192, 512 png) | Code-authored in the kit | Project-owned | `assets/icons/` | Implemented (favicon, PWA, Tauri) | — |
| Legacy "Digital Fortress" boards | Kit `art/legacy/` | — | not copied | **Rejected** (non-canonical roster) | — |

Build-time only, not shipped: `rembg` (MIT) with the IS-Net general-use model (upstream licence; check it before any commercial use), Pillow and NumPy, used by `tools/art/cut_sprites.py`.

Third-party code shipped in the build (0.2+): **React, React DOM, Scheduler** (MIT; see `THIRD_PARTY_NOTICES.md` and `licenses/`). Dev-only tools: esbuild (MIT), TypeScript (Apache-2.0), tsx (MIT), Playwright (Apache-2.0), @types/node (MIT).
