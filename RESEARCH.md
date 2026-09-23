# RESEARCH — Kernel Keep

**Research date:** 2026-09-23. **Method:** web search and page fetches, delegated to a research sub-task and reviewed. Every claim carries the URL it came from; "(seen in search results)" means only the result title/snippet was seen. Wikis and user reviews are weaker sources than official pages and are labelled as such. Nothing here is a market-demand claim, benchmark from someone else's hardware, or legal advice. The title checks are **not** trademark clearance.

## A. What was verified in *this* environment (engineering evidence, 2026-09-23)

| Question | Finding | How verified | Implication | Uncertainty |
|---|---|---|---|---|
| What hardware is this build environment? | Linux x86_64 cloud container (Ubuntu 24.04), 2 vCPU (Xeon 2.8 GHz), 7 GB RAM, **no GPU, no macOS, no Windows** | `uname`, `nproc`, `free` | Anything that needs macOS/Windows or a GPU can't be built or verified here | None |
| Available toolchain | Node 22.22.2, npm 10.9.7, Python 3.11, Chromium 1194 via Playwright 1.56, Xvfb, gcc/clang. **No Unreal, Unity or Blender.** | `which`, `--version` | A web-tech build can be compiled, run and tested end-to-end here | None |
| Can Godot run here? | Yes: Godot **4.7.2-stable** Linux binary downloaded from GitHub and run headless | `Godot_v4.7.2-stable_linux.x86_64 --headless --script bench.gd` | Godot is a viable later port target | Rendering/export not tried |
| Feasibility spike: same brute-force 100/200/400-unit targeting loop in GDScript vs JavaScript | Godot 4.7.2 headless: **0.48–0.56 / 1.86–1.98 / 5.66–5.96 ms per tick** (two runs). Node 22: **0.03 / 0.05–0.06 / 0.09 ms per tick** | `spike/bench.gd`, `spike/bench.mjs` (commands in TEST_REPORT.md) | Both are within a 100 ms tick budget. JIT'd JS has large headroom for simulation work | O(n²) loop only; not representative of a full game; container CPU, not the M4 |
| Does the chosen stack hit ~100+ units? | The full game simulation at 100 per side (224 units, economy and AI running): **avg 2.2 ms, p95 6.8 ms, max 12.5 ms per tick**. 200 per side: avg 4.3, p95 9.3, max 11.9 ms. Browser: **60 fps** with 134 units in headless Chromium (software rendering) | `npm run bench`, `npm run e2e` | The 100-unit target is met with margin **on this container** | Measured here, not on the MacBook Air M4 (see TEST_REPORT.md) |
| Is the simulation reproducible across runtimes? | The same seed for 3000 ticks gives an identical state hash in Node and in the bundled browser build | e2e check | Replays and save files are portable between the dev tools and the game | Both runtimes are V8. **Safari/JavaScriptCore (a Tauri-on-Mac build) is untested** |

## B. Stack decision

See **docs/adr/ADR-001-stack.md**. Summary: **TypeScript simulation + Canvas 2.5D client, bundled into one offline HTML file now, with a desktop wrapper (Electron or Tauri) at Milestone F.** Godot 4.7 is the documented alternative if the project needs native 3D. Unreal 5.8 was evaluated seriously and rejected *for this prototype* because:
- it can't be built or tested in this environment;
- Windows packaging from a Mac needs a Windows machine (community reports);
- it's heavyweight on a fanless 24 GB MacBook Air;
- 5.8 is the last planned UE5 release, so a UE6 migration is ahead.

Unreal and Blender still fit the *art pipeline* (glTF out of Blender works with three.js or Godot).

## C. External evidence table (from the research pass)

| # | Question | Finding | Source (URL) | Design implication | Uncertainty |
|---|---|---|---|---|---|
| 1 | Legends factions | Three campaigns: King Arthur (easy), Siegfried/Ice (medium), Vlad Dracula/Evil (hard). Released NA 2006-10-23. | https://en.wikipedia.org/wiki/Stronghold_Legends | Campaigns can double as a difficulty ladder, with a distinct biome or theme per faction. | Low |
| 2 | Legends special units | "Most special units have their own unique ability, which must be recharged after they are used. Dragons ... have a set lifetime." | https://en.wikipedia.org/wiki/Stronghold_Legends | Hero abilities on cooldowns, plus summons that expire, cap how strong spectacle units can get. | Low |
| 3 | Legends roster | Frost giants, werewolves, creepers, dragons, Merlin, Knights of the Round Table. Spells, and werewolves catapulted over walls. | https://store.steampowered.com/app/40980/Stronghold_Legends_Steam_Edition/ ; https://fireflyworlds.com/games/legends/ | Siege "delivery" of units over walls is a known hook. | Low (official) |
| 4 | Legends engine and economy | Built on the "aged Stronghold 2 engine". Resources go "beyond the usual food, wood, and stone" but add "an annoying level of micromanagement". Factions' soldiers "virtually identical". | https://www.gamespot.com/reviews/stronghold-legends-review/1900-6161495/ | Asymmetry has to go beyond cosmetics, and extra resources must not add busywork. | Low (critic review) |
| 5 | Legends honor | Legends keeps Stronghold 2's Honor in simplified form: "Only promotion and certain units require honor." Neutral estates are captured by foot soldiers, not bought. | https://stronghold.fandom.com/wiki/Honor | A second, prestige-type currency that gates elite units. | Medium (wiki) |
| 6 | Legends vs predecessors | User review: less spending needed "to ward off negative popularity". Only one of each Round Table knight at a time. Evil gets unique units "without the need to create weapons". "three types of towers, two of which are absolutely useless". Play drifts to field battles instead of walls. | https://gamefaqs.gamespot.com/pc/932119-stronghold-legends/reviews/150967 | Warning: if towers and walls are weak, the fortress fantasy collapses into a generic RTS. Unique heroes should be capped at 1 each. | Medium-high (single user review) |
| 7 | Legends MP | Deathmatch, King of the Hill, Economic War, Capture the Flag, and co-op against AI. Steam Edition has 24 story missions and Workshop support. | https://fireflyworlds.com/games/legends/ | Useful mode templates. KotH suits a "hold the core" goal. | Low |
| 8 | Stronghold popularity | Popularity sets the rate peasants arrive or leave. Driven by food rations, taxes (bribes raise it), religion, ale, and fear factor (entertainment slows work, punishment speeds it up). | https://stronghold.fandom.com/wiki/Popularity | Direct inspiration for a "morale/uptime" meter fed by rations of "code". | Medium (wiki) |
| 9 | Crusader AI lords | Eight AI lords with personalities (e.g., Saladin, Richard). They send short video taunts or requests. Crusader Trail has 50 linked missions. Army comes from weapons + gold, or from mercenaries for more gold. | https://en.wikipedia.org/wiki/Stronghold_Crusader | Named AI personalities with barks are cheap to make and memorable. Offer two recruitment paths (crafted vs mercenary). | Low |
| 10 | They Are Billions | 8 resources incl. energy. Walls/turrets/traps perimeter. Breaches cascade ("domino effect"). Random small attacks plus scheduled hordes and a final horde. Pause any time. | https://en.wikipedia.org/wiki/They_Are_Billions | Announced wave timers and active pause make defense planning readable. A single breach should matter. | Low |
| 11 | Northgard | Winter: farms stop, wood use rises. Regions support a fixed number of buildings. Happiness gates population growth, and starvation lowers happiness. | https://en.wikipedia.org/wiki/Northgard ; https://allgameguides.com/games/northgard/guides/tips/ | Periodic "scarcity season" and slot-limited zones create pressure without micromanagement. | Low / medium (guide site) |
| 12 | AoE onboarding | AoE II DE "Art of War" challenges teach economy, army, defense, ageing up, then battles, castle siege, and formations, with medals to encourage repeats. | https://www.ageofempires.com/news/art-of-war-plus-plus/ | Short medal-graded drills beat long tutorials. | Low (official) |
| 13 | UE current | UE 5.8 announced 2026-06-23. Latest hotfix is 5.8.3 (2026-09-22). Described as "the last planned major Unreal Engine 5 release" (UE6 next). | https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available ; https://forums.unrealengine.com/t/5-8-3-hotfix-released/2833315 | Starting on UE5 now means a UE6 migration later. | Low. Wikipedia gives 2026-06-17, a date conflict. |
| 14 | UE license | 5% royalty on lifetime gross above $1M per product. Epic Games Store sales royalty-free. Non-game commercial seats cost $1,850/yr. | https://www.unrealengine.com/en-US/license | Free for a prototype. | Low |
| 15 | UE 3.5% | Wikipedia: since Oct 2024, 3.5% for games also on EGS ("Launch Everywhere"). | https://en.wikipedia.org/wiki/Unreal_Engine_5 | Minor. | Medium (not on the license page loaded) |
| 16 | UE Mac to Windows | Community: "You cannot build Windows on Mac". Each platform is packaged on its native OS. | https://forums.unrealengine.com/t/build-for-windows-when-working-on-mac/1921186 | A Mac-only team needs a Windows machine or CI runner for Windows builds. | Medium (community, no Epic staff) |
| 17 | UE Apple Silicon | Native Apple Silicon support since UE 5.2 (seen in search results). 5.8.3 fixes Mac UAT/UBT packaging hangs. | https://www.unrealengine.com/en-US/tech-blog/unreal-engine-5-2-brings-native-support-for-apple-silicon-and-other-developments-for-macos ; https://forums.unrealengine.com/t/5-8-3-hotfix-released/2833315 | Mac editor is usable. | Medium |
| 18 | UE Mass | 5.8 MetaHuman Collections use "Mass for crowd orchestration" (hundreds to thousands of characters). | https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available | Mass exists for large unit counts, but brings ECS complexity. | Low |
| 19 | Godot current | 4.7.2 is the current stable (godotengine.org says 2026-08-18; endoflife.date says 2026-08-16). 4.7 released 2026-06-18. 3.6 LTS is still maintained. | https://godotengine.org/download/macos/ ; https://endoflife.date/godot | Stable, frequent releases. | Low (minor date conflict) |
| 20 | Godot license/Mac | MIT. Game content not covered by the license. Include the notice if you ship the binary. No royalties. Universal arm64/x86_64 editor, code-signed and notarized. Export templates for all platforms. | https://godotengine.org/license/ ; https://godotengine.org/download/macos/ | Lowest legal and cost risk. Cross-export to Windows from a Mac is standard with templates. | Low |
| 21 | Godot pathfinding | AStarGrid2D is a class specialized for A* on 2D grids. | https://docs.godotengine.org/en/stable/classes/class_astargrid2d.html | Built-in grid A* suits a tile-based fortress map. | Details (JPS, heuristics) unverified |
| 22 | Unity licensing | Runtime Fee cancelled 2024-09-12. Personal is free up to $200k revenue+funding. Splash screen optional for Unity 6 Personal. Pro $2,310/yr per seat. Pro/Enterprise +5% from 2026-01-12. Enterprise at $25M+. | https://unity.com/blog/unity-is-canceling-the-runtime-fee ; https://unity.com/products/pricing-updates | Free for a prototype. Seat costs start above $200k. | Low |
| 23 | Unity versions | 6.3 LTS is the current LTS. 6.5 shipped 2026-06-15 and is already superseded ("upgrade to Unity 6.6 or above"). 6.7 LTS is planned. | https://discussions.unity.com/t/unity-6-5-is-now-available/1723176 | Pin to 6.3 LTS for stability. | Low |
| 24 | Unity Mac | 6.4 editor needs macOS Ventura 13+ and M1 or later. The doc says Rosetta 2 is required on Apple Silicon. Windows IL2CPP needs Visual Studio/Windows SDK. | https://docs.unity3d.com/6000.4/Documentation/Manual/system-requirements.html | Windows IL2CPP builds from a Mac are doubtful. Mono backend untested here. | Medium |
| 25 | Web-tech games | CrossCode ships on NW.js (updated to 0.35.5) using its own HTML5/JS engine. Vampire Survivors was built with Phaser (JS), then moved to Unity from v1.6 (~mid-2022). | https://www.radicalfishgames.com/?p=6904 ; https://en.wikipedia.org/wiki/Vampire_Survivors ; https://jslegenddev.substack.com/p/why-text-in-vampire-survivors-used | A commercial web-tech desktop RTS/action game is proven. Vampire Survivors later left JS for performance. | Electron packaging for VS not confirmed |
| 26 | Electron | Electron 44 (2026-08-25), latest 44.4.4 (2026-09-22). Latest 3 majors supported (44/43/42). New major every 8 weeks. | https://endoflife.date/electron | Fast upgrade treadmill. | Low |
| 27 | Tauri | Tauri core 2.11.5 (2026-07-01). | https://tauri.app/release/core/ | Smaller binaries, but relies on the system WebView (Safari engine on Mac), so rendering varies. | Low; WebView claim is general knowledge, unverified here |
| 28 | Notarization | macOS signing needs an Apple Developer account. The paid program ($99/yr) is required to notarize. Without it the app "will still show up as not verified". | https://v2.tauri.app/distribute/sign/macos/ | Budget $99/yr for a clean Mac distribution. | Low |
| 29 | TS libs | esbuild 0.28.2 MIT (2026-08-08). pixi.js 8.21.0 MIT (2026-09-17). phaser 4.2.1 MIT (2026-07-09). three 0.186.0 MIT (2026-09-08). vite 8.3.0 MIT. typescript 7.0.2 Apache-2.0. | https://registry.npmjs.org/pixi.js (and /esbuild, /phaser, /three, /vite, /typescript) | Actively maintained, permissive toolchain. | Low |
| 30 | Pathfinding libs | easystarjs 0.4.4 MIT (last 2020). pathfinding (PathFinding.js) 0.4.18 MIT (last 2016). recast-navigation 0.43.1 MIT (2026-02-04). | https://registry.npmjs.org/easystarjs ; https://registry.npmjs.org/pathfinding ; https://registry.npmjs.org/recast-navigation | Grid A* is small enough to write in-house. The JS grid libs are unmaintained. | Low |
| 31 | Art: glTF | Blender exporter uses KHR_materials_emissive_strength when emissive > 1.0. Unlit via camera-ray mix, not Principled BSDF. EXT_mesh_gpu_instancing for instances (no per-instance material variation). | https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html | Blender to glTF carries emissive/unlit neon looks and instancing. | Low |
| 32 | Art: instancing | three.js InstancedMesh cuts draw calls for same geometry/material and supports per-instance colour (setColorAt). Godot recommends MultiMesh/servers for thousands of instances. | https://threejs.org/docs/pages/InstancedMesh.html ; https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html | Faction tint via instance colour, one draw per unit type. | Low |
| 33 | Art: bloom cost | URP Bloom: High Quality Filtering "more resource-intensive". For best performance set Downscale to Quarter. | https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/post-processing-bloom.html | Get glow from emissive colour and additive sprites. Use quarter-res bloom or none. | Low |
| 34 | Titles | See Topic 6. "Bastion Protocol" has a near-identical Steam TD game (Sept 2026). "Lightforge" is a game studio. | see Topic 6 | Avoid those two. | Preliminary only, not a clearance |

### 1. Stronghold Legends (Firefly Studios, 2006)

**Factions and campaigns** (https://en.wikipedia.org/wiki/Stronghold_Legends, https://fireflyworlds.com/games/legends/, https://store.steampowered.com/app/40980/Stronghold_Legends_Steam_Edition/)
- Good: King Arthur, Knights of the Round Table, Merlin. Easy campaign, lush biome.
- Ice: Siegfried of Xanten, frost giants. Medium campaign, snowy north.
- Evil: Vlad Dracula, werewolves, demons, "creepers". Hard campaign, corrupted landscape.
- Wikipedia says Legends was the first in the series to give "a choice of different starting rulers with different troop types."
- Steam Edition: 24 story missions, Workshop, new maps, DLC campaigns. Free for existing Steam owners (https://fireflyworlds.com/games/legends/).

**Asymmetry: how deep was it?**
- GameSpot: base soldiers are "virtually identical" across factions. The difference is in heroes and creatures (https://www.gamespot.com/reviews/stronghold-legends-review/1900-6161495/).
- User review: Evil has the same basic units as Good plus better unique ones built "without the need to create weapons". A bat-like unit "can instantly clear walls and towers". Only one of each Round Table knight at a time (https://gamefaqs.gamespot.com/pc/932119-stronghold-legends/reviews/150967). *Single user review.*

**Powers and legendary units**
- Special units have their own abilities that "must be recharged after they are used". Dragons are available to every faction "but have a set lifetime" (Wikipedia).
- Heroes can cast spells, knock down walls, and summon creatures. GameSpot says they underperform: dragons fall to "well-placed archers" and giants can be "ganged up on by regular infantry".
- **Lord/commander powers:** we did not find a source describing a separate lord-power bar or how it charges. Only per-unit recharge is confirmed. See "Could not verify".

**Economy**
- Runs on the Stronghold 2 engine (GameSpot). Resources go beyond food/wood/stone, with added micromanagement.
- Honor is kept but simplified. It is spent only on promotion and certain units. Neutral estates are captured with foot soldiers, not bought (https://stronghold.fandom.com/wiki/Honor).
- Popularity still exists, but a user review says it takes much less spending to hold off than in Stronghold 2 (GameFAQs, above).

**Fortress and sieges**
- The Steam page stresses building and destroying castles with spells and beasts, e.g., "Catapult werewolves over castle walls."
- User critique: only three tower types, two "useless". "Grand, impregnable castles are no longer possible", so players mass armies in the field instead of defending walls. **Key cautionary lesson for a fortress game.**

**Multiplayer:** Deathmatch, King of the Hill, Economic War, Capture the Flag, and co-op against AI (Wikipedia, Firefly).

**How Legends differs from Stronghold (2001) and Crusader**
- Stronghold/Crusader popularity sets peasant arrival and departure. Its levers are food rations, taxes/bribes, religion, ale, and fear factor (https://stronghold.fandom.com/wiki/Popularity). Legends puts much less weight on that loop (user review).
- Crusader: eight named AI lords with personalities and video taunts or requests. Crusader Trail has 50 missions. Troops come from crafted weapons + gold, or from the mercenary post for more gold (https://en.wikipedia.org/wiki/Stronghold_Crusader). Legends' emphasis instead is story factions, heroes, and creatures.
- Legends adds Stronghold 2's Honor in simplified form, and hero units with recharge. Neither exists in Stronghold 2001 or Crusader. (Crusader has no Honor: inferred from the Honor wiki listing only SH2 and Legends.)

### 2. Comparable games: lessons

- **Stronghold Crusader: opponent AI and economy.** Named AI lords with personality, barks, and ally requests are cheap to build and memorable. Two recruitment paths (crafted vs expensive mercenaries) create an interesting choice (https://en.wikipedia.org/wiki/Stronghold_Crusader). A popularity-style meter fed by rations and tax gives a clear supply-versus-greed dial (https://stronghold.fandom.com/wiki/Popularity).
- **They Are Billions: defensive building.** A perimeter of walls, turrets, and traps. Breaches cascade, so wall integrity has real stakes. Hordes are scheduled and telegraphed, with a final horde as climax. Pause-and-order helps readability (https://en.wikipedia.org/wiki/They_Are_Billions). Lesson: announce siege waves with countdowns, and make one breach dangerous but recoverable.
- **Age of Empires II DE: onboarding.** Art of War drills are short and focused (economy, raise army, defend, age up, siege a castle, formations), with gold/silver/bronze medals (https://www.ageofempires.com/news/art-of-war-plus-plus/). Lesson: 5–8 minute graded drills rather than a monolithic tutorial.
- **Northgard: scarcity pressure.** Winter halts farms and raises fuel use. Zones cap building slots. Happiness gates population growth, and starvation damages happiness and health (https://en.wikipedia.org/wiki/Northgard, https://allgameguides.com/games/northgard/guides/tips/). Lesson: periodic scarcity "cycles" (e.g., a thermal throttle on the code supply) and slot-capped sectors.
- **Stronghold Legends (negative lesson).** If towers and walls are weak, players skip the fortress and fight in the field (GameFAQs review). Cosmetic-only asymmetry drew criticism (GameSpot).

### 3. Engines (as of 2026-09-23)

**Unreal Engine 5**
- 5.8 announced 2026-06-23 (Epic). Wikipedia lists 2026-06-17. Hotfix 5.8.3 on 2026-09-22. Epic calls 5.8 "the last planned major Unreal Engine 5 release" (https://www.unrealengine.com/news/unreal-engine-5-8-is-now-available, https://forums.unrealengine.com/t/5-8-3-hotfix-released/2833315).
- License: 5% royalty above $1M lifetime gross per product. Epic Games Store revenue is royalty-free (https://www.unrealengine.com/en-US/license). A 3.5% "Launch Everywhere" rate appears on Wikipedia only (https://en.wikipedia.org/wiki/Unreal_Engine_5).
- Apple Silicon: native since 5.2 (Epic tech blog, seen in search results). Mac packaging fixes landed in 5.8.3.
- Windows builds from a Mac are not possible per community answers; build each platform on its own OS (https://forums.unrealengine.com/t/build-for-windows-when-working-on-mac/1921186).
- Mass: used for crowds in 5.8 (MetaHuman Collections) (Epic 5.8 post).
- Fit: heavy for a 2D/2.5D readable-neon RTS prototype. C++/Blueprint only, large downloads, and a UE6 transition ahead.

**Godot 4**
- 4.7.2 is the current stable (https://godotengine.org/download/macos/, https://endoflife.date/godot). The macOS editor is a universal binary, notarized.
- MIT license, no royalties. Include the copyright notice when shipping the engine binary (https://godotengine.org/license/).
- Export templates for "all supported platforms" (macOS page). AStarGrid2D exists for grid A* (https://docs.godotengine.org/en/stable/classes/class_astargrid2d.html). MultiMesh/servers are recommended for thousands of instances (https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html).

**Unity 6**
- Runtime Fee cancelled 2024-09-12. Personal is free up to $200k revenue+funding, with the splash screen optional in Unity 6 (https://unity.com/blog/unity-is-canceling-the-runtime-fee).
- Pro $2,310/yr per seat. +5% Pro/Enterprise from 2026-01-12. Havok removed from Pro plans from 6.3 LTS (https://unity.com/products/pricing-updates).
- 6.3 LTS is current. 6.5 (2026-06-15) is already superseded by 6.6+. 6.7 LTS is planned (https://discussions.unity.com/t/unity-6-5-is-now-available/1723176).
- Mac editor: Ventura 13+, M1+. Windows IL2CPP needs VS/Windows SDK (https://docs.unity3d.com/6000.4/Documentation/Manual/system-requirements.html).

**Web tech (TypeScript) shipped as a desktop app**
- CrossCode: custom HTML5/JS engine on NW.js (moved to 0.35.5 to fix leaks and crashes) (https://www.radicalfishgames.com/?p=6904; architecture post https://www.radicalfishgames.com/?p=277 seen in results).
- Vampire Survivors: Phaser/JS originally, Unity from v1.6 (~mid-2022) "to improve its overall performance" (https://en.wikipedia.org/wiki/Vampire_Survivors). **Electron packaging not confirmed** by any page we loaded.
- Electron 44.4.4 is current. A new major arrives every 8 weeks and only 3 majors are supported (https://endoflife.date/electron).
- Tauri 2.11.5 (https://tauri.app/release/core/).
- macOS distribution: a Developer ID certificate plus notarization needs the paid Apple Developer Program ($99/yr). Free accounts can't notarize, and apps show as "not verified" (https://v2.tauri.app/distribute/sign/macos/). This applies equally to Electron, since it is an Apple requirement.

### 4. TypeScript libraries (npm registry, checked 2026-09-23)

| Package | Latest | License | Last publish | Note |
|---|---|---|---|---|
| esbuild | 0.28.2 | MIT | 2026-08-08 | Bundler (https://registry.npmjs.org/esbuild) |
| vite | 8.3.0 | MIT | 2026-09-10 | Dev server/bundler |
| typescript | 7.0.2 | Apache-2.0 | 2026-07-08 | TS 7 (native compiler generation) |
| pixi.js | 8.21.0 | MIT | 2026-09-17 | WebGL/WebGPU 2D renderer |
| phaser | 4.2.1 | MIT | 2026-07-09 | Full 2D framework |
| three | 0.186.0 | MIT | 2026-09-08 | 3D renderer, InstancedMesh |
| recast-navigation | 0.43.1 | MIT | 2026-02-04 | Navmesh (Recast/Detour via WASM) |
| easystarjs | 0.4.4 | MIT | 2020-10-18 | Grid A*, stale |
| pathfinding | 0.4.18 | MIT | 2016-05-10 | PathFinding.js, stale |
| bitecs | 0.4.0 | MPL-2.0 | 2025-12-06 | ECS. MPL is file-level copyleft |

Implication: the grid pathfinding libraries are unmaintained. A small in-house A* or flow-field (for many units heading to one gate) is lower risk. PixiJS + esbuild is a lean, current, MIT stack.

### 5. Art pipeline: readable neon on modest hardware

- Author in Blender and export glTF. Emissive above 1.0 uses KHR_materials_emissive_strength. Unlit materials come from a camera-ray mix (not Principled BSDF). EXT_mesh_gpu_instancing exports instances but not per-instance material variation (https://docs.blender.org/manual/en/latest/addons/import_export/scene_gltf2.html).
- Instancing: three.js InstancedMesh reduces draw calls and supports per-instance colour, which fits faction tints (https://threejs.org/docs/pages/InstancedMesh.html). Godot: MultiMesh/servers for thousands of instances (https://docs.godotengine.org/en/stable/tutorials/performance/using_multimesh.html).
- Bloom is a cost centre. URP docs say to disable High Quality Filtering and set Downscale to Quarter for performance (https://docs.unity3d.com/Packages/com.unity.render-pipelines.universal@14.0/manual/post-processing-bloom.html). Implication: most of the glow should come from unlit/emissive colour, dark backgrounds, and additive-blended halo sprites. Bloom is an optional, low-res polish layer.
- Readability (design inference, not sourced): keep faction hue plus a shape language per unit class. Keep walls and gates brighter than terrain, and projectiles brightest.

### 6. Title check (preliminary search only, NOT a trademark clearance)

- **Root Throne**: no exact match. Adjacent: the well-known strategy game "Root" (board + Steam, Leder Games) (https://store.steampowered.com/app/965580/Root/, seen in results). Mild confusion risk.
- **Kernel Keep**: none found. Separate games named "Kernel" exist (Steam app 3319720, seen in results).
- **Hashhold**: none found as a game. A CTF team uses "hashhold" (https://ctftime.org/team/35934, seen in results).
- **Lumen Citadel**: none found. Adjacent: "Lumen", "Lumencraft" on Steam, and Unreal's "Lumen" renderer feature name (seen in results).
- **Firewall Crown**: none found.
- **Daemon Keep**: none found (only "Daemon" itch.io jams seen).
- **Sovereign Process**: none found. "Sovereign" games exist (seen in results).
- **Bastion Protocol**: **obvious conflict.** "Last Bastion Protocol", a Steam tower-defense game released 2026-09-09 (https://store.steampowered.com/app/5063210). Also a "Bastion Protocol (BSTN)" crypto token (seen in results), plus Supergiant's "Bastion".
- **Citadel of Cores**: none found. Adjacent: Mindustry's "Core: Citadel" block, Half-Life "Citadel Core" (seen in results).
- **Lightforge Dominion**: **likely conflict on "Lightforge".** Lightforge Games is a game studio (ex-Epic/Blizzard) whose press release uses "Lightforge Games™" (https://www.prnewswire.com/news-releases/former-epic-and-blizzard-veterans-join-forces-to-create-lightforge-games-301289910.html, seen in results).

---

### Could not verify

- A distinct Legends **lord/commander power** system (charge meter, cooldown, cost). Only per-unit recharging abilities and dragon lifetimes are sourced. The Stronghold fandom unit page returned HTTP 402.
- Precise Legends food/popularity numbers, and whether Legends keeps ale, religion, and fear factor as in Stronghold 2.
- Northgard happiness formulas. Official wiki fetches failed (402/403); only a guide site was used.
- Vampire Survivors being packaged with **Electron** specifically (Phaser is confirmed; the Electron wrapper is not).
- The UE "Launch Everywhere" 3.5% rate appears only on Wikipedia, not on Epic's license page. The UE 5.8 release date conflicts (Epic 06-23 vs Wikipedia 06-17).
- Epic's official position on Mac-to-Windows packaging (community answer only).
- Unity Mono-backend Windows builds from a Mac, and whether the Unity 6 editor is fully native on Apple Silicon (the doc says Rosetta 2 is required; a forum thread title complains about "no fully native Apple Silicon support").
- Godot NavigationServer2D/3D details and AStarGrid2D features (JPS, heuristics). The doc page body did not load.
- Current Electron-specific notarization tooling (@electron/notarize version). Apple's requirement is inferred from the Tauri docs.
- Titles: no USPTO/EUIPO trademark database checks were done.


## D. Separating evidence from judgment

- **Verified:** the engine versions and licences above, the facts about Legends/Crusader/They Are Billions/Northgard/AoE as cited, the npm package versions and licences, and the environment measurements in section A.
- **Engineering judgment:** the stack choice (ADR-001); tile-grid A* instead of a navmesh; a fixed 10 Hz tick; Canvas 2D instead of WebGL for the slice; a single Data-carrying logistics model.
- **Hypotheses that need playtests:**
  - Is Code upkeep pressure fun or punishing?
  - Do brownouts read clearly?
  - Does Fork feel powerful but fair?
  - Are 10–15 minutes enough?
  - Do non-programmers understand Compute and Memory from the tooltips?
  - Do walls get used, or do players skip them the way *Legends* players did?

## E. Unresolved questions

- Legends' commander/lord-power specifics (no source found). Our Fork design doesn't depend on them.
- Whether Electron or Tauri is the better wrapper for Mac + Windows. Tauri uses WKWebView on macOS, so it needs the cross-runtime determinism check repeated in Safari.
- Apple notarization needs the paid Apple Developer Program ($99/yr per the Tauri docs). That's a spending decision for you; nothing was purchased.
