# ADR-002: Fixed-tick, seeded, command-driven simulation

- **Status:** Accepted, Tested.
- **Decision:**
  - The simulation advances only in fixed 100 ms ticks.
  - All state changes from players or the AI go through validated `Command`s.
  - Randomness comes only from a seeded mulberry32 whose state is saved.
  - Iteration is in entity-id order.
  - The simulation avoids transcendental math functions.
  - Presentation reads state and interpolates.
- **Why:** it makes replays, save/load, bug reproduction and automated testing reliable, keeps the AI honest (same command API), and leaves a path to lockstep multiplayer.
- **Evidence:** the replay test, the save/load continuation test, the seeded repeat test, and the Node vs browser hash test (TEST_REPORT.md).
- **Limits:** only V8 runtimes have been compared. No claim of cross-engine or cross-platform lockstep is made. 10 Hz is coarse for fast projectiles, so hits are instant (a beam effect), which fits the theme.
