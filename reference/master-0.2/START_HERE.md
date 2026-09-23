# Kernel Keep — master review and UI kit 0.2

Prepared for Ryan Rodriguez, 2026-09-23. Kernel Keep remains a provisional title.

**This is a working React presentation kit and summary-based review. It is not a revised build of the original RTS.** The referenced `kernel-keep-prototype-0.1.zip` was not available in the attachments or located in the inspected Library listings. Its simulation, original documentation, test logs and git history are therefore not included. No original source was overwritten. Upload that archive to complete the source audit and integration.

## Open the interface now

1. Extract the entire ZIP, keeping its folders together.
2. Open `ui/dist/index.html` in Chrome. No installation, account, subscription, Apple Developer enrollment, server or runtime download is needed for this prebuilt preview.
3. Choose **Explore the HUD**. Select roles, switch the sample economy state, toggle the gate and open Settings. **Art codex** contains the new role and structure sheets.

The preview uses fixed sample data. Buttons record preview intents; they do not run combat, train programs, modify balances or invoke Fork in a game. The Canvas diorama is a deliberately simple presentation scene. The minimap and tutorial progress are illustrated examples.

## What is included

| Location | Contents | Status |
|---|---|---|
| `ui/dist/` | Prebuilt React UI, local images, manifest and offline-cache worker | Built; browser-tested |
| `ui/src/` | React HUD, Canvas scene, settings, immutable fixture store, catalog and proposed interface contract | Implemented; TypeScript checked |
| `ui/src-tauri/` | Optional minimal Tauri 2 desktop scaffold | Configuration shape checked; native build untested |
| `docs/01_BUILD_REVIEW.md` | Evaluation of the supplied summary, evidence limits and priorities | Review; original code unavailable |
| `docs/02_ARCHITECTURE_AND_PACKAGING.md` | React + Canvas architecture, browser-first delivery, optional Tauri | Proposed for integration |
| `docs/03_ART_UI_AND_MOTION.md` | Reconciled roster, HUD rules, art production and motion specification | Design plus implemented UI effects |
| `docs/04_INTEGRATION_AND_ACCEPTANCE.md` | Sequenced integration plan, fairness experiment and acceptance gates | Pending original prototype |
| `docs/05_TEST_REPORT.md` | Actual verification and remaining gaps | Current evidence |
| `docs/06_IMPLEMENTER_PROMPT.md` | Complete next-model implementation prompt | Ready to use with original ZIP |
| `art/kernel-keep/` | Three new generated images: six roles, ten buildings, menu background | Concepts; menu image used in UI |
| `art/legacy/` | All six earlier Digital Fortress boards | Retained references; do not treat their roster as canonical |
| `original-inputs/` | Original master prompt and reference image; supplied prototype summary | Source inputs |
| `evidence/` | Six actual UI screenshots, browser results and other local evidence | UI only |
| `ASSET_MANIFEST.json` | Asset paths, dimensions, checksums, origin and usage | Inventory |

## Edit or rebuild

In `ui/`, using a current Node release compatible with the pinned dependencies:

```sh
npm ci
npm run typecheck
npm run build
npm test
npm run dev
```

Open `http://127.0.0.1:4173`. The dev command builds once and serves; it has no hot reload. Rebuild and refresh after edits. Dependencies require network access the first time. Runtime uses local files only. `package-lock.json` is included; `node_modules` and machine-specific browser binaries are excluded.

For browser checks:

```sh
npx playwright install chromium
npm run test:browser
```

An existing compatible browser can be selected using `KERNEL_TEST_BROWSER=/absolute/path/to/chromium`. This environment used that route because the default browser archive download failed. Tests are meaningful UI checks, not the reported original 29 simulation tests and 23 game E2E checks.

## Optional PWA

With the local server running, open `http://127.0.0.1:4173/?pwa`. The opt-in worker caches the local UI and three images. Browser installation may be offered when that browser's conditions are met. Offline reload was tested; OS installation was not. Hosting for other users requires HTTPS. Nothing has been published.

Opening `index.html` directly uses local files without service workers. UI preferences may be scoped differently by file location and browser. Game-save migration is not implemented.

## Optional Tauri

The Tauri scaffold is for a later local developer build. It is not required to view this package. See the packaging document before attempting native development. Rust and platform prerequisites are needed; no native binary, installer or notarization was produced. `bundle.active` is false, no signing credentials are configured, and no paid enrollment was requested.

## Next required input

Attach `kernel-keep-prototype-0.1.zip`. Read `docs/06_IMPLEMENTER_PROMPT.md` with both archives. Keep the original working HTML playable during integration. The `0.2` label identifies this UI/design revision, not a validated gameplay release.
