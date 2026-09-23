# React + Canvas, browser first, Tauri optional

Interpretation: “tour react” was treated as **Tauri + React**. This is reversible; the browser UI does not depend on Tauri. Recommendations checked against official sources on 2026-09-23.

## Responsibilities

| Layer | Owns | Must not own |
|---|---|---|
| Existing TypeScript simulation | Tick, IDs, resources, jobs, combat, fog, RNG, command validation, save state | React component state or render timing |
| Engine adapter | Visibility-filtered snapshots, selection projection, command mapping and results | A second economy or duplicated balance rules |
| Canvas renderer | Interpolation, sprites, effects, selection visuals, camera | Authoritative outcomes or resource spending |
| React | Menus, HUD, dialogs, hotkey preferences, status and recovery explanations | Per-frame simulation stepping or direct entity mutation |
| Browser/PWA host | Local assets, optional caching, origin-scoped UI persistence | Paid accounts, online match services |
| Optional Tauri host | Native window and deliberately scoped native features | New game rules or an automatic exemption from signing |

React's `useSyncExternalStore` provides a supported interface for reading a non-React store. `getSnapshot` must return the same immutable reference while unchanged. The kit implements that behavior with a fixture bridge. This contract is proposed, not an API discovered in the original project. [React reference](https://react.dev/reference/react/useSyncExternalStore)

## Integration constraints

- Preserve the existing simulation tick frequency. Read it from source; do not infer it from the benchmark.
- Use a single simulation driver and command queue. React mounts, rerenders and StrictMode remounts must not create another driver.
- Publish UI snapshots at a modest rate, initially 10 Hz as a tunable presentation target; publish critical alerts/selection feedback promptly. This rate must not change game progression.
- Keep Canvas rendering on its own `requestAnimationFrame` loop. Its renderer reads presentation data without causing a React rerender for every frame.
- Commands carry an ID, issuing player and intended tick. The engine accepts/rejects once and returns a meaningful reason. React should not duplicate resource or capacity validation.
- Build selection is local UI state until an explicit placement intent. A ghost never reserves or spends resources by itself.
- Expose only visible or remembered world information to HUD and minimap. The new layer must not create fog-of-war leaks.
- Pause is an explicit engine operation when integrated. The current preview pauses only visual animation and says so.
- Consider workers only after profiling identifies contention. Moving a deterministic loop into a worker is not required to use React.

## Packaging choice

| Route | Apple Developer enrollment | What is delivered here | Limits |
|---|---|---|---|
| Local browser folder | Not needed | Prebuilt UI with bundled React and local art | File-origin persistence varies; no installable PWA from `file://` |
| Browser PWA | Not needed for web delivery | Manifest and opt-in cache worker | HTTPS or localhost; browser installation differs; OS installation untested |
| Tauri local development | Paid enrollment is not needed for an ordinary local development/ad-hoc build | Minimal source scaffold | Requires Rust and platform tools; not compiled here |
| Normally distributed notarized macOS app | Paid Developer ID/notarization path applies | Not delivered | Tauri and Electron do not remove platform trust requirements |
| Windows native package | Apple enrollment irrelevant | Not delivered | Requires a Windows build/smoke-test path and separate signing decisions |

Tauri supports static web frontends including React. Its documentation describes an ad-hoc signing option, while free development signing does not provide notarization. A public, frictionless native Mac download and a local developer build are different deliverables. No Gatekeeper-disabling commands are part of this kit. [Tauri frontend](https://v2.tauri.app/start/frontend/) · [Tauri macOS signing](https://v2.tauri.app/distribute/sign/macos/) · [Apple Developer ID](https://developer.apple.com/developer-id/)

The initial distribution recommendation is the browser folder; PWA is the installation-oriented web option. Service worker features require a secure context such as HTTPS or localhost. [PWA installation](https://web.dev/learn/pwa/installation/) · [PWA tools](https://web.dev/learn/pwa/tools-and-debug) · [PWA caching](https://web.dev/learn/pwa/caching)

## PWA behavior implemented

Registration happens only with `?pwa` on HTTP(S). It does not run from file URLs or native Tauri protocols. Caching includes the UI and three local images. Cache names use a build-content hash. No `skipWaiting` forcibly replaces an active session; the next worker activates after old clients close. Only this app's cache prefix is cleaned up. The worker does not write save data. No external URLs, account or wallet connections are present.

For a production game: version caches with an explicit asset digest, cache only release assets, preserve active matches across updates, handle quota errors, test update rollback, and keep save schemas independent of asset versions. This kit has not implemented a game-save migration.

## Native scaffold limits

`ui/src-tauri` contains a minimal Tauri 2 window, Rust entry point, empty plugin capability list and `frontendDist` pointing at the prebuilt folder. `bundle.active` is false. `signingIdentity: "-"` proposes ad-hoc local signing. No updater, filesystem plugin, shell execution or remote webview is enabled.

The configuration shape was checked against the installed CLI's schema, with nonstandard format checks disabled. That is not a Rust compile or native runtime test. Cargo is absent here; Rust dependencies are major-version requirements without a resolved `Cargo.lock`. A developer must resolve and commit a lockfile and verify platform prerequisites before calling the scaffold reproducible. The bundled JS dependency versions are exact in `package-lock.json`.

On a machine with prerequisites, from `ui/`:

```sh
npm ci
npm run tauri dev
# Only after local development succeeds:
npm run tauri build -- --no-bundle
```

Do not present these commands as verified on the Air. The current native target remains the UI lab, not the original game.
