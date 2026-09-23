# Kernel Keep — source audit, React integration and browser-first release

You are taking over Ryan Rodriguez's existing Kernel Keep prototype. Read BOTH `kernel-keep-prototype-0.1.zip` and this master review/UI kit. The latter contains an isolated React fixture lab and concept art; it does not contain or replace the original simulation. If the original ZIP is missing, identify that exact blocker before claiming a source audit or gameplay integration.

The user prefers a React app experience and is interested in Tauri, while avoiding paid Apple Developer enrollment. Use browser/offline web delivery as the default. Retain optional Tauri local development; do not buy anything, enroll an account, promise notarization or claim that Tauri bypasses macOS distribution trust requirements.

Start by inspecting applicable repository instructions, git state, source, docs, build scripts, dependency versions, saves and test logs. Preserve the untouched original archive and runnable HTML. Work in an isolated branch or copy. Reproduce the build and rerun the supplied tests. Prior claims of 29 simulation tests, 23 browser tests, cross-runtime hashes and ~2.2 ms/tick are reported evidence to verify, not current results.

Preserve the deterministic TypeScript simulation and Canvas 2.5D renderer if inspection confirms they are sound. Add React for menus, HUD, selection details, building menus, queues, settings, tooltips and tutorials. Do not move the simulation into React state or rewrite it solely for appearance. Use one authoritative command queue and a cached immutable presentation projection. The contract in this kit is proposed; adapt it to real APIs, not invented names.

Canonical supplied roster: Runner, Ping, Bulwark, Lancer, Patcher, Breaker. Canonical buildings: Core, Data Cache, Compiler, Mining Rig, Compute Node, Memory Bank, Training Grid, Firewall, Access Gate, Sentry Tower. Fork is the reported commander power; verify its actual semantics and ownership. Do not add a Commander unit, Research Lab, Repair Station or third faction because legacy art depicts one.

Read economy definitions before wiring UI. Preserve carried Data, Code upkeep, fictional Hash, shared Compute/brownout, Memory, Stability, rations and auto-suspension as actually implemented. Derive cost, net rates, thresholds, queue availability, cooldowns and recovery actions from the engine. Remove fixture values and “UI lab” labels only once a screen actually uses real state and commands. Replace the presentation diorama with the existing playable renderer, not a screenshot.

Investigate the mirror-AI issue using the paired seed/side/order plan in this kit. One side-two win does not establish systemic bias. Add focused tests for confirmed problems, including fog boundaries, gate/path updates, capacity accounting, Fork lifecycle and save restoration. Do not silently change deterministic hashes or claim fairness from a single run.

Use the new menu background directly. Produce clean isolated production sprites/portraits from the concept direction with consistent projection, pivots, alpha and team markers. The sheets are concepts, not engine-ready atlases or 3D models. Build interactive effects with Canvas/CSS where appropriate. Cinematic video is optional and should not block gameplay.

Preserve direct offline browser play, and add a PWA only with versioned assets and safe update behavior. Test origin changes and game-save export/import before moving from file URLs to hosted web or Tauri. Never silently discard saves. Keep native plugin permissions minimal and explicitly justified. No online LLM, wallet, real crypto mining or account is required for a match.

Deliver a coherent master ZIP containing the preserved original, revised source, actual runnable browser game, art and provenance, exact dependency locks, docs, tests and fresh evidence. Include native binaries only if actually compiled, and identify platform and test status. Exclude secrets, caches and node_modules. Mark Proposed, Implemented, Tested and Blocked accurately.

Finish with the exact launch path, changed systems, tests actually run, confirmed remaining issues, Air/Windows/native verification gaps and the next concrete step. A source handoff or a UI mockup must not be called a finished game release.
