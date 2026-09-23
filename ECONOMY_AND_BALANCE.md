# ECONOMY_AND_BALANCE — Kernel Keep

The machine-readable tuning data is **`src/data/balance.json`** (balance v1). The simulation reads it directly, and every number below comes from it. Simulation evidence is in `docs/ECON_SIM_RESULTS.md` (regenerate it with `npm run econ`). Time is in seconds, distance in tiles, and the simulation runs at 10 ticks/s.

## 1. Resources: stockpiles vs capacities

The model has three **stockpiles** (amounts you hold and spend) and two **capacities** (limits that are occupied, not spent). There is one logistics model: **only Data must be physically carried.** Code, Hash, Compute and Memory are global. Status: Implemented, Tested.

| | **Data** (stock) | **Code** (stock) | **Hash Credits** (stock, fictional) | **Compute** (capacity) | **Memory** (capacity) |
|---|---|---|---|---|---|
| Producer | Runners harvest Data wells (10 per trip, 4 s gather) | Compiler: 6 Data → 5 Code every 8 s (needs 1 operator). Core trickle 0.1/s | Mining Rig: rig *k* (0-based) yields 1.0 × 0.85^k HC/s (needs 1 operator and 4 Compute) | Core 10, Compute Node +8 | Core 10, Memory Bank +6 |
| Inputs | Runner time | Data, operator time | Operator, Compute | 70 Data per Node | 50 Data per Bank |
| Transport | **Physical**: carried to the Core or a Data Cache | Global | Global | Global | Global |
| Storage / cap | Core 400, +250 per Cache | Core 250, +60 per Compiler | Vault 600 (fixed) | = supply | = limit |
| Consumers | Construction, Compilers, Runners (20 each), repairs (1 per 10 HP), Breakers | **Upkeep** (1–2 per program per 20 s × ration), Runners, combat programs, Rigs (20 C to build) | Combat programs, Towers, Fork | Rig 4, Tower 2, Grid 3 *while training*, Fork +8 while forks live | Runner 1, Ping 1, Bulwark 2, Lancer 1, Patcher 1, Breaker 3; queued items reserve once started |
| Rates (start) | ~1 Data/s per harvesting Runner on home wells | 0.625/s per staffed Compiler at work speed 1.0 | 1.0, 0.85, 0.72, 0.61 … | — | — |
| Depletion | Wells hold 1200 (home), 1500 (forward), 2500 (centre); they vanish when empty | — | — | — | — |
| When it runs out | Construction/Compilers stall with a reason | **Starvation**: Stability falls → programs crash (see §3) | Can't train or tower | **Brownout**: rigs, towers and training all run at supply/demand | Training waits ("Memory full") |
| UI | Chip: stock/cap, "storage full" | Chip: stock/cap, net per minute, seconds left; amber/red | Chip: stock/600 | Chip: demand/supply, "BROWNOUT n%" | Chip: used/limit |
| Recovery | New wells; salvage fragments from destroyed buildings (30% of Data cost if ≥ 10) | Compilers, Lean rations, Suspend, crash-suspension, Core trickle | Rigs; stop spending | Compute Nodes; switch Rigs off (O) | Memory Banks; Decompile |

**Stability (0–100)** isn't a resource. It's the civilization's condition, and it moves 1 point/s toward a target of **60 + ration modifier − 50 × unmet-upkeep fraction** (smoothed). Ration modifiers are Lean −25, Standard 0, Surplus +15. **Work speed = 0.6 + 0.6 × Stability/100**, so 0.96 at 60, 0.81 at 35 and 1.05 at 75. It scales harvesting, compiling, mining, construction and training.

## 2. The eight questions

1. **Bootstrap.** The Core provides a drop-off, 10 Compute, 10 Memory and 0.1 Code/s. You start with 150 Data, 80 Code, 40 Hash and 4 Runners, and the first Compiler (60 Data) needs only Data plus Runner time. Simulated: the first Compiler finishes at 0:11 with two builders, and Code income passes upkeep by 1:00 (scenario A at 1:00: codeIn 42/min vs codeOut 30/min). Nothing requires a resource that only a later building produces. *Tested* (`bootstrap` test).
2. **Code feeding.** It's global. Every tick each non-suspended program consumes upkeep × ration ÷ 20 s. Consequences are staged: (a) a *"Code reserve low: ~Ns left"* warning under 60 s at the current net rate; (b) at 0 Code a *starving* alert, and the unmet fraction lowers the Stability target by up to 50; (c) below Stability 20, one program *crashes* every 10 s (idle Runners first, then harvesters, then operators, then soldiers). A crashed program is suspended: it eats nothing and does nothing until you resume it. *Tested.*
3. **Avoiding a starvation spiral.** Crashes suspend programs rather than killing them, so each crash lowers demand automatically. The player can go **Lean** (half upkeep), **Suspend** idle programs, **Decompile**, or switch buildings off to free operators, and the Core trickle feeds about 2 Runners forever. A 20-minute idle run never crashes (Stability settles at 35). Scenario E (20 programs, 0 Code) recovers with 0 crashes. *Tested.*
4. **What limits mining.** Each extra Rig yields 15% less; the total approaches 6.7 HC/s. Every Rig also needs an operator (who eats Code and isn't harvesting) and 4 Compute. Rigs compete with Towers and training for that Compute, the vault caps at 600, and Rigs are exposed 300-HP targets. Hash buys nothing by itself; it only converts into military when you also have Code, Memory and free Runners, so a rich player is still short of something.
5. **Compute vs military readiness.** Towers (2) and a training Grid (3) share the pool with Rigs (4 each). Over-demand throttles *everything* proportionally: towers fire slower, training slows, and the Rigs themselves yield less. See Decision 1.
6. **Global vs physical.** Only Data is carried, which gives raids something concrete to cut (harvesters and forward Caches). Everything else is global to keep micromanagement down. Advanced logistics (Code carriers, conduits) is Proposed only.
7. **Why attack infrastructure.** Harvesters and Rig/Compiler operators are soft (40 HP). Rigs and Compilers aren't hardened, so any unit deals full damage. Killing operators starves Code or Hash, destroyed buildings drop salvage for the attacker to harvest, and a forward Data Cache saves long walks but invites raids.
8. **Anti-snowball and micromanagement.** Controls: diminishing Rig yields, fixed Hash vault, wells that run dry and push expansion into contested space, upkeep that grows with army size, and training that consumes a Runner (armies cost economy). Micromanagement is limited by operators staffing themselves, trainees being pulled from idle or harvesting Runners, builders moving on to the next site in a wall line, harvesters retargeting the nearest well when theirs empties, and one-click rations. There are no infinite loops: Data enters only from finite wells and salvage (salvage < cost), and demolishing refunds 25%.

## 3. Three decisions, with numbers

**Decision 1: a third Mining Rig now, or a Compute Node first?** (Stability 60 → work speed 0.96.) With the Core (10 Compute), a Grid that is training (3) and one Tower (2):
- Two Rigs: demand 8 + 3 + 2 = 13 > 10 → efficiency 0.77. Hash = (1 + 0.85) × 0.77 × 0.96 = **1.37 HC/s**. The Tower fires at 77% and training is 23% slower.
- Add a third Rig without a Node: demand 17 → efficiency 0.59. Hash = 2.57 × 0.59 × 0.96 = **1.45 HC/s** (only +6%), and the Tower and training drop to 59%.
- Build a Compute Node (70 Data) first: supply 18 ≥ 17 → efficiency 1. Three Rigs = 2.57 × 0.96 = **2.47 HC/s** at full defence.
The third Rig alone is almost worthless and weakens your defence. The Node is the real upgrade. This is what "greed has a price" means in numbers.

**Decision 2: rations with 15 Runners + 4 Bulwarks (upkeep 23) and 2 staffed Compilers.**
- Standard: drain 23/20 = 1.15 C/s. Stability target 60 → ws 0.96. Income 2 × 0.625 × 0.96 + 0.1 = 1.30 C/s → **net +0.15 C/s** (9/min).
- Lean: drain 0.575 C/s. Target 35 → ws 0.81. Income 1.11 C/s → **net +0.54 C/s** (32/min), but *every* worker, Rig and Grid runs 16% slower.
- Surplus: drain 1.725 C/s. Target 75 → ws 1.05. Income 1.41 C/s → **net −0.31 C/s**. You'd need a third Compiler (60 Data + an operator).
Lean funds an army surge at the cost of tempo. Surplus buys speed if you can pay for more Compilers.

**Decision 3: one Bulwark vs five Firewall segments.**
- Bulwark: 20 Code + 35 Hash + **a Runner** (which was harvesting ~1 Data/s), 2 Memory, and **2 Code upkeep per 20 s forever** (6 Code/min). Net of the absorbed Runner, that's +1 Memory and +3 Code/min, plus the lost harvesting unless you replace the Runner. 190 HP, and it can fight anywhere.
- Five Firewalls: 30 Data, **no upkeep, no Memory**, 2000 hardened HP (non-siege attackers deal 25%, so effectively 8000 against them). They can't move.
Walls are a cheap, upkeep-free way to multiply defence, which is why they matter in the prototype. Breakers (50 dmg, full vs hardened) are the counter.

(Also: the first Rig costs 80 Data + 20 Code plus an operator. At ~0.96 HC/s it funds a Lancer's 40 Hash every ~42 s.)

## 4. What the simulation showed (balance evidence, not proof of fun)

From `docs/ECON_SIM_RESULTS.md`, 12-minute scripted economies (8 minutes for E) against a passive opponent (seed 4242):

| Scenario | Hash mined | Code produced | Programs trained | Crashes | Lowest Stability | Reading |
|---|---|---|---|---|---|---|
| A. Balanced | 1384 | 1535 | 58 | 0 | 60 | Stable: Code income leads upkeep all game; Memory is the late limit |
| B. Greedy mining | 1050 | 1015 | 29 | 0 | 53 | Hash leads at 4:00 (409 vs 264) but runs into the 600 vault, Memory 28/28 and slow Code, and ends *behind* A |
| C. Code-first turtle | 1050 | 1160 | 29 | 0 | 54 | Safe but slow; the army comes late |
| D. Upkeep shock (+14 Bulwarks at 6:00) | 1007 | 1415 | 25 | 0 | 60 | Upkeep jumps; production slows but there's no spiral |
| E. Starving start (20 programs, 0 Code) | 521 | 770 | 18 | 0 | 25 | Recovers through Lean and Compilers; Stability bottoms at 25, above the crash line |

Findings to act on (see BUILD_PLAN.md):
- In AI-driven economies **Code, not Data, is the binding constraint**, and Data regularly hits its cap. That's the intended pressure, but it makes the Hash vault fill up. Watch in playtests whether upkeep feels punishing (lever: `upkeepCycleSec` 20 → 25).
- Scenario B shows the brownout and vault working as greed brakes.
- **Nothing crashed in any scenario because the scripted economy reacts well.** The crash path is covered by a unit test that forces starvation. Humans may hit it more often, which is a playtest question.

## 5. Unit and building numbers

See GAME_DESIGN.md §7 for the roster table and `src/data/balance.json` for everything. Building summary:

| Building | Size | Cost | Build (s, one builder) | HP | Hardened | Effect |
|---|---|---|---|---|---|---|
| Core | 3×3 | — | — | 2500 | yes | +10 Compute, +10 Memory, 400 Data / 250 Code storage, trains Runners, drop-off, 0.1 Code/s |
| Data Cache | 2×2 | 50 D | 15 | 350 | — | drop-off, +250 Data storage |
| Compiler | 2×2 | 60 D | 20 | 350 | — | operator; 6 D → 5 C / 8 s; +60 Code storage |
| Mining Rig | 2×2 | 80 D 20 C | 25 | 300 | — | operator; 4 Compute; Hash |
| Compute Node | 2×2 | 70 D | 20 | 300 | — | +8 Compute |
| Memory Bank | 2×2 | 50 D | 15 | 300 | — | +6 Memory |
| Training Grid | 3×3 | 100 D | 30 | 700 | — | specializes Runners; 3 Compute while training |
| Firewall | 1×1 | 6 D | 3 | 400 | yes | wall |
| Access Gate | 1×1 | 30 D | 10 | 700 | yes | owner-only passage; open/close |
| Sentry Tower | 2×2 | 60 D 30 H | 20 | 600 | yes | 12 dmg / 1.2 s, range 6.5, 2 Compute |

Several builders add up linearly. Construction sites start at 10% HP and gain HP as they're built. Cancelling a site refunds 100%, demolishing refunds 25%, and cancelling a queued program refunds 100% and returns its Runner (Tested).
