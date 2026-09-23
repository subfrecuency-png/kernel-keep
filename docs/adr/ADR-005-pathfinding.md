# ADR-005: Grid A* with a per-tick budget and breach routing

- **Status:** Accepted, Tested.
- **Decision:** in-house 8-direction A* on the 64×64 tile grid, with a goal rectangle, a partial path to the closest reachable tile, a breach mode that crosses enemy structures at +6 per tile, a weighted heuristic (×1.15), and a global budget of 12,000 expansions per tick (requests over budget wait one tick).
- **Why:** the maintained JS grid-pathfinding libraries are stale (easystarjs 2020, PathFinding.js 2016; RESEARCH #30). A navmesh (recast) is overkill for a tile fortress game where walls and gates change the grid constantly.
- **Evidence:** in a 100-per-side battle the worst tick fell from about 233 ms (an earlier console run, not saved to a log) to 9–13 ms across later runs (`docs/test-logs/bench.log`). Gate, unreachable-goal, obstruction and breach behaviour are covered by tests.
- **Next:** flow fields for large groups sharing a destination, path smoothing, and hierarchical search for bigger maps.
