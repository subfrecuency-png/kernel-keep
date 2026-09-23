# ART_AND_UI_GUIDE — Kernel Keep

## 1. Art bible (original; no reference game's characters, logos, maps or signature designs are used)

**World:** the inside of a vast, cold machine. The ground is a dark navy **lattice** (a 1-tile grid, with brighter lines every 8 tiles so you can judge distance). The **void** is pure black, outlined in violet. It's the rift you can't cross, and it creates choke points. Data wells are pale-blue hexagons that pulse slowly; salvage fragments are smaller and violet.

**Fortresses:** each monumental structure is an extruded block. It has a dark body, a lighter side face, and a top face outlined in the owner's colour carrying a simple **glyph**: Core = nested diamonds, Compiler = gear with `{}`, Rig = pulsing bars with `#`, Compute Node = chip, Memory Bank = memory stick, Training Grid = 3×3 lights, Tower = crosshair, Firewall = double bar, Gate = arrows (open) or bars (closed). Height tells the class apart: Core tallest, towers tall, economy mid, walls low.

**Programs:** each role has its own **silhouette**, readable without colour:
- Runner: small circle (with a Data cube when carrying)
- Ping: triangle pointing where it moves
- Bulwark: square within a square
- Lancer: diamond with a beam line
- Patcher: circle with a plus
- Breaker: large hexagon with a core

**Ownership without relying on colour:**
- Your programs have a **circular ring**; enemy programs have a **diamond ring**.
- Enemy structures have **diagonal hatching** on their top face.
- Colours are cyan `#3ee6ff` (you) and orange `#ff7a2f` (rival). Blue vs orange stays distinguishable for the common colour-vision deficiencies, and the shapes carry the meaning anyway.

**Status language:**
- Suspended or crashed: greyed out, with `z` or `!z`.
- Fork: dashed outline, 75% opacity, violet countdown ring.
- Veterans: gold chevrons.
- Buildings: HP bar when damaged or selected; yellow `!` when stalled; `⏸` when switched off.

**Light and effects:**
- Glow comes from bright strokes on dark fills. There's **no bloom**, so units, projectiles and selection stay crisp.
- Beams are thin lines in the owner's colour (0.14 s). Siege shots are thick, with an impact ring. Heals are dashed green.
- Deaths are expanding rings with shards. Completed buildings pulse with a white ring.
- Selection is always white: a ring around units, a dashed rectangle around buildings. It's drawn above the fog.

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

The **battlefield** is still entirely **procedural and original**. It's drawn with Canvas paths in `src/client/render.ts`, and sound is synthesized in `src/client/audio.ts`. In 0.2 the **interface** gains generated concept art from the Master v0.2 kit (menu background, portraits, codex sheets). It is concept art, not production sprites: it has no pivots, alpha or world scale, and it is never drawn on the map. Collision and gameplay never depend on image sizes.

## 4. Asset / licence manifest

| Asset | Source | Licence | File path | Status | Replacement need |
|---|---|---|---|---|---|
| Lattice terrain, void edges | Procedural Canvas drawing, original | Project-owned | `src/client/render.ts` (terrain section) | Implemented | Optional: textured tiles or 3D terrain |
| Data well / fragment glyphs | Procedural, original | Project-owned | `src/client/render.ts` (wells) | Implemented | Animated sprite later |
| 10 building blocks + glyphs | Procedural, original | Project-owned | `src/client/render.ts` (`drawBuilding`, `glyph`) | Implemented | **Needed**: modelled or painted art (Blender → glTF, or sprites) |
| 6 unit silhouettes, rings, rank chevrons | Procedural, original | Project-owned | `src/client/render.ts` (`drawUnit`) | Implemented | **Needed**: animated unit art |
| Beams, bursts, rings, pop-up text | Procedural, original | Project-owned | `src/client/render.ts` (effects) | Implemented | Optional polish |
| Minimap | Procedural | Project-owned | `src/client/render.ts` (`renderMinimap`) | Implemented | — |
| HUD layout, colours, CSS | Hand-written, original; tokens from the Master v0.2 kit | Project-owned | `src/ui/styles.css`, `src/ui/*.tsx` | Implemented | — |
| UI font | System UI / system monospace (not bundled) | OS-provided, no redistribution | — | Implemented | Choose and license a bundled font (e.g. an OFL font) |
| Sound effects (11 functions, 12 distinct sounds) | WebAudio oscillator synthesis, original | Project-owned | `src/client/audio.ts` | Implemented | **Needed**: designed SFX |
| Music | — | — | — | Proposed | Original score (commission or compose) |
| Menu background (1672×941) | Built-in image generation, from the prompts in `reference/master-0.2/GENERATION_PROMPTS.json`, with the user-supplied reference image used as a **style reference** | Generated for this project; the reference image's rights were not independently verified | original `assets/art/concept/kernel-menu-background.png` (sha256 61ac7558…), shipped as `assets/art/derived/menu-background.webp` | Implemented (title screen) | Clear the rights before any public release |
| Six-roles sheet (1536×1024) | Same generator and prompts | Same | `assets/art/concept/kernel-six-roles.png` (dd2b73ac…) → `derived/sheet-six-roles.webp` + 6 `role-*.webp` crops (3×2 grid) | Implemented (portraits, codex) | Production unit sprites or models |
| Ten-structures sheet (1536×1024) | Same generator and prompts | Same | `assets/art/concept/kernel-ten-structures.png` (16dc1de3…) → `derived/sheet-ten-structures.webp` + 10 `structure-*.webp` crops | Implemented (portraits, codex) | Production building art |
| App icon (svg, 192, 512 png) | Code-authored in the kit | Project-owned | `assets/icons/` | Implemented (favicon, PWA, Tauri) | — |
| Legacy "Digital Fortress" boards | Kit `art/legacy/` | — | not copied | **Rejected** (non-canonical roster) | — |

Third-party code shipped in the build (0.2): **React, React DOM, Scheduler** (MIT; see `THIRD_PARTY_NOTICES.md` and `licenses/`). Dev-only tools: esbuild (MIT), TypeScript (Apache-2.0), tsx (MIT), Playwright (Apache-2.0), @types/node (MIT).
