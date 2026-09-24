# Animation pilot (Phase 0), 2026-09-23 — 0.3.3

Ryan approved the Phase 0 pilot from the animation plan: the Runner (all clips, five facings), the Compiler working loop, the atlas tooling, the sprites v2 format, the clip selector and an Animation lab. The budget was about 10,000 Magnific credits, with a promise to stop before 11,000.

Legend: **Implemented** = in the code · **Tested** = an automated check passed in this session · **Blocked** = needs something that isn't available · **Rejected** = made, reviewed and not shipped.

## Outcome in one line

The **video route works and is in the game** (Compiler working loop, 325 credits). The **3D route failed for the Runner**: the paid clips distort because the model was generated from an action pose, so they were **not shipped**. Fixing that costs more credits than the account has left.

## Credits (Magnific) — actual

| Step | Credits | Result |
|---|---|---|
| Runner 3D model (Tripo, from the Runner concept still) | 1,160 | Faithful mesh, but in the concept's **running pose** |
| Compiler working loop (Kling 2.5, 1080p, start frame = end frame) | 325 | **Shipped** |
| Runner auto-rig (Meshy) | 1,160 | Rig fitted to the running pose; right-leg joints misplaced |
| Six Runner clips (Meshy catalog: Idle, Carry_Heavy_Object_Walk, Punch_Forward_with_Both_Fists, Electrocuted_Fall, Pull_Radish, Heavy_Hammer_Swing) | 6,960 | **Rejected** (see below) |
| **Total** | **9,605** | under the 11,000 ceiling; account balance afterwards **1,530** |

The plan estimated 2,800 credits per structure video; the real cost was **325**, so structure loops are about 9× cheaper than planned.

## What shipped (Implemented, Tested)

- **Compiler working loop:** 40 frames at 8 fps in a 2048×1465 WebP atlas (≈ 969 KB), cut from a locked-camera video with `tools/anim/structure_loop.py`. The base shifts by 0 px across the loop (phase-correlation lock). It plays in place of the still whenever a Compiler is built, powered, unpaused and staffed. Each Compiler has its own phase, so neighbours are not in lockstep. It overlays the still exactly because the video started from that still. Contact sheet: `docs/anim-pilot/compiler-working-contact.webp`.
- **Rival copy at load:** only the player-1 atlas ships. The Rival atlas is recoloured once when the match starts with the same hue rule as the sprite cutter (blue/cyan → crimson). This saves about 1 MB per sheet in the single-file build.
- **Sprites v2 sheet format and loader** (`src/client/anim.ts`, `src/client/animlogic.ts`): one JSON per atlas `{type, clip, frames, fps, loop, cell, cols, facings?, fire?, pivot?}`. A missing or still-decoding sheet falls back to the still, so absent clips never break drawing.
- **Clip selector** (pure, unit-tested): program clips (idle / walk / carry / harvest / build / attack / death), eight-way facing with SW/W/NW drawn as mirrored SE/E/NE, and attack frames driven by the weapon cooldown so the fire frame lands on the shot tick. These rules are ready for program sheets; **no program uses them yet**, because no program frames passed review.
- **Animation lab** (Title or Menu → Art codex): every shipped clip plays for both teams, with play/pause and frame stepping.

## Why the Runner clips were rejected

`docs/anim-pilot/runner-rig-rejected.webp` shows the problem: in *Idle* the Runner should stand upright, but its right leg stays kicked back in every clip.

- **Cause.** The 3D model was generated from the Runner concept still, and that still is a mid-stride action pose. Meshy's auto-rig fits its skeleton to whatever pose the mesh is in, and its catalog animations are rotations *relative to that rest pose*. A running rest pose therefore stays in every clip.
- **Rig check (Blender).** In the rest pose the right thigh bone is 13 cm long and the "shin" is 81 cm, spanning the whole bent leg. The left leg is 30 + 43 cm. Re-posing the mesh cannot fix misplaced joints.
- **What does work.** The pipeline itself: `tools/anim/render_program.py` renders any rigged GLB through a fixed orthographic 2:1 camera with the planned light rig, rebuilt emissive seams, root-motion removal (linear for walk cycles, pinned for death) and five facings. Loop periods were measured from the bone data: walk 55 frames, idle 96, harvest 114; build has no clean loop.

**Lesson for Phase 1:** 3D generation must start from a **neutral A-pose or T-pose turnaround**, never from an action concept.

## Options (Ryan to decide — nothing below has been spent)

| Option | Credits | Notes |
|---|---|---|
| **A. Redo the Runner properly:** A-pose image → 3D model → rig → 6 clips | ≈ 9,300 plus the image | Needs a credit top-up: 1,530 are left |
| **B. Structure working loops by video** (Rig, Node, Core, Tower …) | 325 each | Proven route. 4 more fit in the current balance (1,300) |
| **C. Salvage the paid clips in Blender:** hand-built skeleton, automatic weights, neutral rest pose, then retarget the six clips | 0 | Time only; the outcome is uncertain on this mesh |

Until one of these is chosen, programs keep the 0.3.1 motion (stride sway, recoil, lunge, spawn and derez effects) on their stills.
