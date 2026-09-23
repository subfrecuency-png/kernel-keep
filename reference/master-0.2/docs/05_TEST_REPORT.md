# Test report — this kit only

Date: 2026-09-23. Original `kernel-keep-prototype-0.1.zip` unavailable. None of its reported 29 simulation tests or 23 browser E2E checks were rerun.

## Results

| Check | Result | Evidence / scope |
|---|---|---|
| TypeScript strict typecheck | PASS | `evidence/typecheck.txt` |
| Browser bundle | PASS | Prebuilt local `ui/dist/index.html`; React, CSS bundled; PNGs beside it |
| Seven UI contract tests | 7 PASS | `evidence/unit-tests.txt` |
| Thirteen browser scenarios | 13 PASS | `evidence/browser-results.json` |
| Tauri configuration shape/types | PASS | `evidence/tauri-schema.json`; custom formats not validated |
| Visual inspection | Performed | Menu, desktop HUD and compact HUD screenshots inspected |
| Original RTS source audit | BLOCKED | Missing prototype archive |
| Original simulation, AI, determinism, economy, match outcome | NOT TESTED | The lab does not contain the original simulation |
| Air performance / human playtest | NOT TESTED | No access to that device or player |
| Native Tauri compilation / macOS / Windows | NOT TESTED | Rust toolchain absent; no platform binary produced |
| PWA OS installation | NOT TESTED | Cache install and offline browser reload passed; no OS install claim |

## Browser checks that passed

1. Prebuilt UI opens via `file://` without a server or remote runtime dependencies.
2. HUD has five resource types and exactly six selectable roles; selection updates the panel.
3. Sample Code shortage shows the conditional 20-second reserve and navigates to Compiler inspection.
4. Sample brownout shows 112/100 shared capacity without invented allocation controls.
5. Sample suspension shows six suspended programs and recovery explanation.
6. Gate presentation toggle is reversible.
7. Fork records an explicit preview intent and does not claim to execute a game order.
8. Preferences persist across reload; pause key remapping works; reduced motion stops Canvas changes.
9. Settings focus stays in its modal and returns after Escape.
10. No horizontal document overflow at 1440, 1024 and 390 px widths with 125% UI text scale.
11. Both new concept sheets load in the codex.
12. Opt-in service worker installs its cache; menu and art reload offline.
13. No JavaScript page errors or remote dependency/asset requests observed in these scenarios.

## Unit test coverage

Snapshot identity/immutability, listener teardown, preview-command isolation and bounded log, scenario transitions, safe shortage estimates, preference schema validation/clamping, and exact six-role/ten-building catalog names. These tests intentionally do not assert gameplay mechanics from the summary.

## Environment and limitations

Node 24.19.0; exact JS dependency versions are in `ui/package-lock.json`. Headless Chromium 153 from the `@sparticuz/chromium` package was used through Playwright 1.62.1. The default Playwright browser download produced a corrupt archive; an independently installed compatible Chromium was selected with `KERNEL_TEST_BROWSER`. The browser binary is not bundled in the deliverable.

This is a Linux container result, not validation of Chrome on the Air, Safari/WKWebView, Windows or native packaging. Browser screenshots are appearance evidence, not proof of gameplay. The 390 px layout is an inspection convenience, not a claim that an RTS is playable on a phone.

The initial browser-test attempts exposed ambiguous test selectors; those selectors were made specific and the full suite passed. Visual inspection prompted a real UI improvement: applying the scale preference to text throughout the interface. A Canvas resize-loop cleanup fix prevents redundant animation drivers. The final source was rebuilt and the browser suite rerun after these changes.

## Reproduction

From `ui/`: `npm ci`, `npm run typecheck`, `npm run build`, `npm test`, `npx playwright install chromium`, `npm run test:browser`. Optional configuration check: `node scripts/check-tauri.mjs`.

No safety guarantees, simulation benchmarks, fairness results, notarization, Windows smoke test or game-save compatibility are implied by the UI tests.
