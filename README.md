# Kernel Keep (provisional title)

An original, offline fortress-building RTS set in a luminous digital world. You grow an economy of programs, raise
structures and firewalls, and hold your Core against a rule-based Rival. The in-game "Hash Credits" are fictional and
exist only inside a match: there is no real cryptocurrency, mining, wallet or NFT anywhere in this project.

**Status:** prototype 0.3.4 (branch `anim-pilot`). Earlier milestones live on `iso-art-0.3`, `react-hud-0.2` and `master` (0.1).

## Play

Open `dist/kernel-keep.html` in a browser. It is a single offline file: no install, no account, no network.

## Build and test

```sh
npm install
npm run build      # dist/kernel-keep.html
npm test           # simulation and view unit tests
npm run e2e        # browser end-to-end checks (Playwright + Chromium)
```

Start with `START_HERE.md`, then `HANDOFF.md` (latest session), `TEST_REPORT.md` and `ARCHITECTURE.md`.

## Highlights

- Deterministic 10 Hz TypeScript simulation with replays and state hashes that match across V8, Chromium and WebKit.
- A mirror-fair map: two identical AIs stay exactly point-symmetric (see `docs/FAIRNESS_RESULTS.md`).
- Isometric renderer with a React 19 HUD, an Animation lab, and animated structures and Runners.
- Optional desktop shell (Tauri 2, `desktop/`) and an optional offline PWA.

## Art and rights

The concept art and sprites were generated for this project; the animation frames were produced with generative
video/3D tools and Blender. The concept art was generated with a style reference whose rights have not been
independently cleared (see `ART_AND_UI_GUIDE.md`, section 4). Third-party code notices: `THIRD_PARTY_NOTICES.md`.

No licence has been chosen yet, so all rights are reserved by the author until one is added.
