# GAME_DESIGN — Kernel Keep (provisional title)

Status labels: **Implemented** = in the build and exercised by tests. **Tested** = automated checks cover it (see TEST_REPORT.md). **Proposed** = design only. **Blocked** = waiting on something outside this environment.

## 1. Interpretation of the brief

You rule a population of programs inside a luminous machine. The digital setting has to change the rules, not just the textures, and a strategy player who can't program should be able to read it. So each digital idea maps to one plain decision:

| Digital idea | Plain-language rule in the game | Decision it creates |
|---|---|---|
| Executable code as food | **Code** is upkeep. Every program eats it. Running out lowers Stability | How big a population/army can you feed? |
| Computing capacity | **Compute** is a shared capacity. Mining rigs, towers and training draw on it; over-demand causes a **brownout** that slows all of them | Greed for Hash weakens your defences |
| Memory | **Memory** is the population limit (Memory Banks raise it) | Workers vs soldiers vs expansion |
| Crashes / system integrity | Low **Stability** makes programs **crash** (auto-suspend). **Suspend** lets you park programs so they eat nothing | Recovery without a death spiral |
| Replication | **Fork** (commander power): temporary copies of your fighters that die with their originals and surge Compute | A timed, costly, counterable spike |
| Firewalls and access control | **Access Gates** let only their owner through. Walls are **hardened**, so only siege programs break them efficiently | Fortress building matters |

## 2. Three interpretations considered (subjective design judgment, no invented scores)

| | A. **Fortress Economy & Siege** (Stronghold-first) | B. **Legends of the Kernel** (hero/commander-first) | C. **Living Network** (territory/connectivity-first) |
|---|---|---|---|
| Player fantasy | Ruler of a busy digital city behind firewalls, feeding and arming it, then cracking a rival keep | Leading legendary AI champions with spectacular powers | Growing a glowing network where cutting links starves the enemy |
| Defining mechanic | Code rations → Stability, compute allocation, hardened walls, siege units | Commander abilities on cooldowns, unique champions per faction | Buildings work only while linked to the Core by conduits; raids cut links |
| Strategic depth | Economy vs defence vs army timing; wall layout; brownout management | Ability timing and counters | Graph shape, redundancy, chokepoints |
| Readability | High if resources are few and visible | High for fights, thin for economy | Medium: link-state UI can become a dashboard |
| Originality | Medium-high: brownouts, crash/suspend and code-as-food are new twists on a known frame | Medium: the hero RTS is well-trodden | High, but hard to explain |
| Implementation risk | Medium: many small interacting systems | Medium-high: ability VFX, balance of spectacle | High: extra pathing/graph rules and UI |
| Production scope | Moderate for one faction | Large (every hero needs art and behaviour) | Moderate code, heavy UX iteration |
| Could be tedious if… | Logistics micromanagement creeps in | Base-building becomes a formality | Players fix broken links instead of playing |

**Recommendation: A, with one commander power borrowed from B (Fork) and the compute-sharing idea taken from C, limited to a single global pool.** This is a subjective call. A best preserves your essentials (stronghold, working population, code feeding, mining, training, war). Research also shows that *Legends* drifted toward field battles when its towers were weak (RESEARCH.md #6), so this design keeps walls and towers strong and makes Breakers the answer to them.

## 3. Working titles (provisional; a quick search is not a trademark clearance)

| Title | Preliminary search result (2026-09-23) |
|---|---|
| **Kernel Keep** ← working title | No game found; separate products called "Kernel" exist |
| Firewall Crown | Nothing found |
| Lumen Citadel | Nothing found; "Lumen" is widely used (Unreal feature, other games) |
| Daemon Keep | Nothing found |
| Sovereign Process | Nothing found; "Sovereign" games exist |
| Citadel of Cores | Nothing found; similar phrases in Mindustry and Half-Life |
| Hashhold | No game; a CTF team uses the name; also leans on crypto branding |
| Root Throne | Close to the strategy game *Root* |
| Bastion Protocol | **Conflict:** *Last Bastion Protocol* (Steam TD, 2026-09-09) and a crypto token |
| Lightforge Dominion | **Conflict risk:** Lightforge Games is an existing studio |

## 4. Pitch, pillars, audience

**One sentence:** Rule a luminous kingdom of programs: harvest Data, compile it into the Code that feeds your people, mine fictional Hash Credits to arm them, raise firewalls across the rift, and crack the rival Kernel's core before it cracks yours.

**Pillars**
1. **A living city, not a dashboard.** Every resource moves visibly: Runners carry Data, Compilers turn, Rigs pulse, and trainees walk into the Grid.
2. **Fortresses matter.** Walls, gates and towers are hardened. Only siege programs crack them efficiently, and enemies can never use your gates.
3. **Greed has a visible price.** Mining competes with towers and training for Compute. A bigger army eats more Code.
4. **Recoverable, never hopeless.** Shortages are staged and explained, with levers to pull (rations, Suspend, operators on/off). The Core trickle stops total starvation.
5. **Digital in the rules.** Brownouts, crashes, suspension, access-controlled gates and bounded forks each work as a mechanic, not just a label.

**Audience hypothesis (to test, not a market claim):** players who enjoy castle-builder RTS games (Stronghold, They Are Billions, Age of Empires), like economy puzzles and sieges, and don't want to learn programming. Sessions last 10–15 minutes against a computer opponent, played offline.

## 5. The first ten minutes (as implemented; times are the Normal AI's defaults)

- **0:00** Your Core sits in the south-west corner of *Meridian Divide*: 4 Runners, 150 Data, 80 Code, 40 Hash. The objectives panel says: drag-select Runners and right-click a glowing well.
- **0:10** Runners walk to the well, gather for 4 seconds, and carry 10 Data home. A "+10" pops over the Core. Code shows about "−6/min": four programs are eating it.
- **0:30** Select a Runner and press **C** to place a Compiler (60 Data). Two builders finish it in about 10 seconds. A free Runner walks in to operate it automatically, and "+Code" starts ticking.
- **1:00–2:00** Compile more Runners at the Core (**Q**, 20 Data + 8 Code). Build a **Memory Bank** before Memory 10/10 blocks you. Build a **Mining Rig** (M): its operator walks in, it uses 4 Compute, and Hash starts rising.
- **2:00–3:30** Compute shows 4/10. Add a second Rig and a **Training Grid** (T), and Compute goes to 11/10: **BROWNOUT 91%** turns amber, with a tooltip explaining that rigs, towers and training all slow down. You build a **Compute Node** (+8).
- **3:30–5:00** Train Bulwarks and Lancers. Each takes a free Runner, so harvesting slows unless you replace them. Lay a **Firewall** line across the north pass of the void rift by dragging with **W**, set an **Access Gate** (G), and raise a **Sentry Tower** (R).
- **~4:00** A Rival Ping scouts your base (seen at 4:07 in the seeded AI-vs-AI log). It's the first enemy you see, and your first tower gets its first shots.
- **~6:30** First wave: 6 Rival programs. The AI may launch no earlier than 5:30, and only once it has 6 fighters; it launched at 6:30 in the seeded log. They path to your gate, can't pass, and attack the wall. Your tower fires, but if you're in brownout it fires slower. The panel suggests switching a Rig off (**O**) during the siege.
- **6:00–10:00** You repair walls (Runners, 1 Data per 10 integrity), add a second Compiler because the larger army is eating Code faster, and train Breakers to crack the Rival's hardened walls. Around 8–10 minutes you counter-attack through the centre pass, using **Fork** at the Rival's gate.

## 6. Economy (summary; full spec in ECONOMY_AND_BALANCE.md)

Stockpiles: **Data**, **Code**, **Hash Credits**. Capacities: **Compute**, **Memory**. There is one logistics model: **Data needs physical delivery** by Runners to the Core or a Data Cache. Everything else is global. **Implemented, Tested.**

## 7. Programs, army, lifecycle

**Lifecycle** (✔ = in the prototype): ✔ compile (Runner at the Core) → ✔ assign work (harvest/build/repair/operate; operators are staffed automatically) → ✔ specialize (the Training Grid consumes a free Runner) → ✔ fight → ✔ gain experience (rank 1 at 2 kills, rank 2 at 5 kills, +15% damage and integrity each) → ✔ repair (Patchers heal programs and structures; Runners repair structures for Data) → ✔ die (buildings worth ≥ 10 salvage drop fragments) or ✔ **decompile** (voluntary delete, frees Memory and upkeep). Upgrades, equipment modules, doctrines and formation drills are **Proposed** (BUILD_PLAN.md).

"Training" here is a fictional game mechanic (specialization plus battlefield experience). No machine learning runs anywhere.

**Roster (Implemented).** Values are live in `src/data/balance.json`.

| Unit | Role | Cost | Time | Upkeep /20s | Mem | HP | Armor | Speed | Attack (dmg / cd / range) | Counters it | Silhouette |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Runner | worker | 20D 8C | 8s | 1 | 1 | 40 | 0 | 2.4 | 3 / 1.2 / 0.9 (no auto) | anything | small circle; carries a Data cube |
| Ping | scout | 10C 20H + Runner | 8s | 1 | 1 | 55 | 0 | 3.8 | 5 / 1.0 / melee | Lancers, towers | triangle pointing where it moves |
| Bulwark | frontline | 20C 35H + Runner | 12s | 2 | 2 | 190 | 3 | 1.9 | 14 / 1.3 / melee | Lancers kiting; Breaker-less walls | square in square |
| Lancer | ranged | 15C 40H + Runner | 12s | 1 | 1 | 75 | 0 | 2.1 | 11 / 1.5 / 5.0 | Bulwarks and Pings that close the gap; towers (6.5 range) | diamond with a beam line |
| Patcher | support | 20C 45H + Runner | 14s | 1 | 1 | 65 | 0 | 2.1 | heals 7 / 1.0 / 3.0 | focus fire; Pings | circle with a plus |
| Breaker | siege | 30D 20C 80H + Runner | 20s | 2 | 3 | 150 | 1 | 1.3 | 50 / 3.2 / 7.0, min range 2, ×0.3 vs programs, full vs hardened | Pings/Bulwarks that get inside min range | large hexagon |

Targeting: auto-acquire the nearest *visible* enemy within sight (units preferred over buildings). Siege units prefer structures. Walls and gates are never auto-targeted by non-siege units; they are attacked only when blocking the route (siege routing). There is no friendly fire (Tested).

**Commander power (Implemented, Tested): Fork.** 60 Hash. Copies up to 6 selected combat programs for 25 s at 50% of their current integrity.
- Readable warning: forks have dashed outlines and a countdown ring.
- Cost and limitation: +8 Compute demand while forks live (brownout risk). No upkeep, no Memory, no experience. 90 s recharge.
- Counter: kill the original and its fork vanishes. Forks also expire on their own.
- Recovery: after 25 s everything returns to normal.

**Signature digital mechanic #2 (Implemented, Tested): Compute brownout.** When Compute demand exceeds supply, rigs, towers and training all run at supply/demand. The Compute chip turns amber, an alert explains it, and switching a Rig off (O) restores full speed.

## 8. Fortress and siege rules (Implemented, Tested)

- **Firewall** (6 Data, 400 HP) and **Access Gate** (30 Data, 700 HP) are 1×1 and **hardened**: non-siege attacks deal 25%, Breakers deal 100%. Drag to lay a line; diagonal steps are filled so a line has no leaks.
- **Gates:** when open, only their owner passes. Closed, nobody passes. An enemy can never use your gate and has to break a wall or gate. Opening, closing or destroying a gate or wall bumps the nav version, and units on affected or partial routes re-plan (Tested).
- **Sentry Tower** (60 Data + 30 Hash, 600 HP, hardened, range 6.5, 12 dmg / 1.2 s) needs 2 Compute and fires slower in a brownout.
- **Siege routing:** when attack-moving programs have no open route, they plan through enemy structures (+6 cost per tile) and attack the first structure that blocks them (Tested).
- **Choke points:** the map's void rift has three 5-tile passes.
- Line of sight is radial; walls don't block sight in the prototype (**Proposed:** wall-top units, occlusion).
- **Repair:** Runners at 12 HP/s for 1 Data per 10 HP; Patchers for free, but slowly.
- Destroyed buildings drop **salvage fragments** (30% of their Data cost, but only when that comes to at least 10 Data, so single wall segments and gates drop nothing) that Runners can harvest, which makes raids pay.

## 9. Factions (high level; one implemented)

| Faction | Identity | Economy/tactics | Weakness | Commander |
|---|---|---|---|---|
| **The Kernel Guard** (implemented, both sides) | Orderly defenders of a mainframe | Balanced; strong walls; Fork | Upkeep-hungry army | *The Sovereign Scheduler* — Fork |
| **The Swarm Collective** (Proposed) | Emergent botnet of tiny programs | Cheap, fast Runners; half upkeep; replication is its identity (Forks last longer) | Weak walls (no hardening), low Memory per bank | *Hivemind Prime* — Mass Fork |
| **The Archive Wardens** (Proposed) | Ancient cold-storage librarians | Slow economy but huge storage; can "archive" (freeze) buildings to shield them from damage | Low Compute, slow army | *The Curator* — Quarantine: a temporary isolation field where nothing inside attacks or is attacked; the counter is to wait it out or siege from range |

## 10. Rival AI rules (disclosed)

The AI uses **only** the validated command interface. It targets only what its own fog of war shows, and it knows the map layout plus both start positions (like a player who knows the map). There are **no resource bonuses at any difficulty**. Difficulty changes only attack timing and wave size: Normal attacks no earlier than 5:30 and only with at least 6 programs (+2 per wave, at least 2 minutes apart); Easy no earlier than 8:00 with at least 4 (+1 per wave, 3 minutes apart). Measured Normal timing in the seeded log: first wave at 6:30. It scouts with a Ping, rebuilds lost economy buildings, and moves its operators back to harvesting when Data collapses. It defends when enemies approach, pauses a Rig to fix a brownout under attack, uses Fork on engaged attackers, and retreats when a wave drops below 30%. It doesn't build walls (Proposed).

## 11. Vertical-slice scope (counts reconciled with the source)

| Item | Target | In the build |
|---|---|---|
| Maps | 1 | 1 — *Meridian Divide*, 64×64, point-symmetric, 3 passes, 10 wells |
| Factions | 1 + mirrored AI | 1 (Kernel Guard) for both sides |
| Unit roles | 4–6 | 6 (Runner, Ping, Bulwark, Lancer, Patcher, Breaker) |
| Building families | ~8 | 8 families / 10 types: Core; Data Cache; Compiler; Mining Rig; Compute Node; Memory Bank; Training Grid; Defences (Firewall, Access Gate, Sentry Tower) |
| Commander abilities | 1 | 1 (Fork) |
| Match length | 10–15 min | AI-vs-AI is decided at 13:53 in the seeded run (`docs/test-logs/aivai-seed7.log`); not yet playtested by a human |
