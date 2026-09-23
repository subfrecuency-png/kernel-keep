# START HERE — Kernel Keep (provisional title), prototype 0.1

An original, offline, single-player fortress RTS. You rule a luminous civilization of programs:
- harvest **Data**;
- compile it into **Code** that feeds everyone;
- mine fictional, match-local **Hash Credits** to arm your people;
- juggle **Compute** and **Memory**;
- wall off the rift with **Firewalls** and **Access Gates**;
- break the Rival Kernel's Core with **Breakers**.

It isn't a cryptocurrency product: nothing mines, trades or connects to anything real, and there's no account, network or API key.

## Play it (no install)

Open **`dist/kernel-keep.html`** in Chrome, Edge or another Chromium browser: double-click the file, or drag it onto the browser. It's one self-contained ~118 KB file and runs fully offline. Then:
1. **New match** (Easy or Normal).
2. Follow the Objectives panel on the right.
3. **F1** lists every control; **Esc** opens the menu (save, load, settings).

It was tested in headless Chromium only. Safari and Firefox should work but haven't been tried.

## What exists (verified)

- One map (*Meridian Divide*) and one faction on both sides.
- 6 program roles and 10 building types in 8 families.
- Fork, the commander power.
- A rule-based Rival AI that plays by the same rules and fog of war as you.
- Fog of war, minimap, save/load/autosave, pause-and-order, a guided tutorial, rebindable keys, UI scale, and reduced flashing.
- Evidence: 29 simulation tests, 23 browser end-to-end checks, replay and save/load determinism, and benchmarks. See TEST_REPORT.md.

**Not built yet:** a desktop installer (.app/.exe), authored art, audio and music, extra factions, campaign, multiplayer. See BUILD_PLAN.md.

## Develop

```bash
npm install          # dev tools only: esbuild, typescript, tsx, playwright, @types/node (versions pinned)
npm run build        # → dist/kernel-keep.html
npm test             # 29 simulation tests (node:test)
npm run e2e          # browser test (needs Playwright's Chromium: npx playwright install chromium)
npm run verify       # typecheck + tests + build + e2e
npm run econ         # economy scenarios → docs/ECON_SIM_RESULTS.md
npm run bench        # simulation ms/tick at 25–200 units per side
npm run aivai        # AI-vs-AI match report: npx tsx tools/aivai.ts [seed] [minutes]
```

You need Node 22+ (it was developed on 22.22.2). The balance lives in `src/data/balance.json`: edit it, run `npm run build`, and reload.

## Documents

| File | What's in it |
|---|---|
| GAME_DESIGN.md | vision, three interpretations and the pick, titles, pillars, first 10 minutes, roster, factions, AI rules |
| ECONOMY_AND_BALANCE.md | every resource specified, the 8 economy questions, 3 decisions worked with numbers, simulation findings |
| RESEARCH.md | dated sources, evidence table, engine comparison, feasibility spike |
| ARCHITECTURE.md + docs/adr/ | simulation/client split, determinism, navigation, jobs, fog, saving, extension points, decisions |
| ART_AND_UI_GUIDE.md | art bible, HUD and controls, accessibility, asset/licence manifest |
| BUILD_PLAN.md | milestone status, next tasks, backlog |
| TEST_REPORT.md | what ran, results, performance, what's untested, human playtest script |
| HANDOFF.md | files, known issues, blockers, exact next steps |
