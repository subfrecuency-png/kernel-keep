# ADR-001: Technology stack

- **Status:** Accepted for the prototype (2026-09-23). Revisit at the end of Milestone F.
- **Context:** The target is desktop-first on macOS and Windows, offline, single-player. The developer uses a MacBook Air M4 with 24 GB RAM and also uses Unreal and Blender. The build and verification environment for this session is a Linux container with no GPU, macOS, Windows, Unreal, Unity or Blender (RESEARCH.md §A). The prompt requires a *running* prototype plus a feasibility test, not a paper comparison.

## Options

| | Unreal 5.8 | Godot 4.7.2 | Unity 6.3 LTS | TypeScript + Canvas (desktop wrapper later) |
|---|---|---|---|---|
| Apple Silicon editor | Native since 5.2 | Native, notarized universal build | Docs say Rosetta 2 required | Any browser or editor |
| Windows build from a Mac | Community: no, needs Windows | Yes (export templates) | IL2CPP needs Windows tools | Electron can package both; Tauri needs per-OS builds or CI |
| Licence | 5% over $1M gross | MIT, no royalties | Free under $200k | MIT dependencies |
| Buildable and testable here | **No** | Headless yes (verified); rendering/export untested | **No** | **Yes: built, unit-tested, browser-tested, benchmarked** |
| Army simulation | Mass ECS (heavy) | GDScript: 400-unit brute force 5.7–6.0 ms/tick (two runs) | DOTS | 400-unit brute force 0.09 ms/tick; full game at 224 units: ~2.2 ms avg |
| Iteration cost on a MacBook Air | High (C++ compiles, large editor) | Low | Medium | Lowest (esbuild rebuilds in under 1 s) |
| 3D spectacle ceiling | Highest | High | High | Medium (three.js/PixiJS later) |

## Decision

Build the prototype as a **deterministic TypeScript simulation with a Canvas 2.5D client**, bundled by esbuild into **one self-contained offline HTML file**. Plan a **desktop wrapper** (Electron first because it can package macOS and Windows from one machine; Tauri as the smaller option) for Milestone F. Keep the simulation engine-agnostic (no DOM in `src/sim`) so that a **Godot 4.7 port** stays possible if the project needs native 3D later. The data (`balance.json`), rules and tests carry over; the code would be rewritten.

## Consequences

- Positive: everything is verifiable here and now: 29 simulation tests, 23 browser checks, benchmarks and replays. It's fast to iterate on an Air, and there are no licence costs.
- Negative: a desktop installer doesn't exist yet (Blocked: needs packaging, and macOS notarization needs the paid Apple Developer Program). The visual ceiling is below Unreal. A port to another engine is a rewrite.
- Unreal is *not* rejected for your other projects. It was rejected for this prototype because none of it can be verified in this environment, Mac→Windows packaging needs a Windows machine, it's heavy on a fanless laptop, and a UE6 transition is coming.
