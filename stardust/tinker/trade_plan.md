# Stardust Trade System Plan

## What exists

### System taxonomy (`systemEconomy.js`)

Six categories, each with subtypes:

| Category | Subtypes |
|---|---|
| Agricultural | Rich, Standard, Poor, Specialized |
| Industrial | Heavy, Light, Refining |
| HighTech | Research, Industrial, Consumer |
| Mining | Standard, Rich, Radioactive, Volatile |
| Services | Trade, Financial |
| Frontier | Outpost, Independent |

Nine government types: Anarchy, Feudal, MultiGovernment, Dictatorship, Communist,
CorporateState, Democracy, Theocracy, Technocracy.

### Commodities (`systemEconomy.js` via `CommodityRegistry`)

Currently 15 commodities (flat, no dependency tree):
Food, Textiles, Minerals, Radioactives, Alloys, Machinery, Computers,
Liquor/Wines, Luxuries, Gold, Platinum, Gem-Stones, Narcotics*, Firearms*, Alien Items

(* contraband, filtered by government type in `TradeSimulator`)

Producer/consumer weights per subtype are registered in `systemEconomy.js`.
The `CommodityRegistry` stores `producers[subtype][commodityId] = weight` and the same for consumers.

### TradeSimulator (`trade.js`)

- `planTradeStep()` — iterates all systems, builds "potential production" from weights,
  has each trader pick the most profitable neighbor trade, returns pending transactions
- `executeTradeStep()` — moves trader counts between systems, moves inventory
- `getBuyPrice` / `getSellPrice` — apply supply/demand weight ± 5% noise
- `playerBuy` / `playerSell` — stubs, reference `player.currentSystem` (not yet set)

**Critical gap**: `planTradeStep` computes *potential* production as a decision-making aid
but `executeTradeStep` never actually creates goods. The economy is zero-sum on inventory:
goods can only move, not be created. Systems will drain.

Dev tools exposed via `window.DEVMODE`:
- `window.simTrade(N)` — runs N plan+execute steps, renders transaction log
- `window.simMove(N, skip)` — runs N steps, renders a bar chart of trader distribution

The tinker harness (`tinker/index.html` + `tinker.js`) does NOT import `trade.js` or set
`DEVMODE`, so these tools are currently unreachable from the tinker UI.

---

## Known stability issues

### 1. No production tick → inventory depletion

Goods only move. Over time every system's inventory drains to zero.
Traders find nothing to trade → fall back to random relocation.
Fix: add a `productionTick(system)` that injects goods each step.

### 2. Trader concentration in hubs

Well-connected systems attract traders via profit-seeking (rich-get-richer on graph topology).
Once concentrated, the minimum-profit threshold traps them (everything nearby saturated).
This is actually realistic — major trading hubs form naturally.
The counter-force should be: excess inventory in hard-to-reach systems raises prices → eventually
exceeds the profit threshold → pulls traders out there.
This only works if production keeps filling those remote systems, so fix #1 is prerequisite.

### 3. No demand-driven price pressure beyond current tick

`_applyPriceFluctuation` uses the system's own production/consumption weights but doesn't
account for accumulated stock (surplus → lower price, shortage → higher price).
Prices should be a function of current inventory level, not just static weights.

---

## Design goals for the new system

### A. Production tick based on system properties

Each economy tick, each system produces goods according to its subtype and capacity.
Production should be capped per system — no single system should be self-sufficient.
The cap forces trade even for common goods.

**Proposed model:**
```
production[commodity] += baseRate[subtype][commodity] * capacityFactor * tickRate
```
Where `capacityFactor` shrinks as inventory approaches a per-system cap
(soft cap: production slows as stock accumulates, hard cap: stops at max).

The soft cap creates a natural "push" — a system flush with minerals is motivated
to export them rather than produce more.

### B. Consumption tick

Each tick, systems consume goods they need (for their industry or population).
If a required input is missing, the system's production of dependent goods is reduced or halted.
This creates genuine shortages and demand signals.

### C. Input/output dependency tree (hidden from player)

The key missing piece. Rather than flat producer/consumer weights, each system
transforms inputs into outputs. The tree is 4 tiers deep and sparse — no system
covers all tiers, and very few reach Tier 3.

**Commodity tiers and dependencies:**

```
Tier 0 — Raw (extracted, no inputs required)
  Minerals        ← Mining (Standard, Rich)
  Radioactives    ← Mining (Radioactive)
  Volatiles       ← Mining (Volatile) [dangerous, special handling]
  Food            ← Agricultural (all subtypes)
  Alien Items     ← Mining (Volatile), rare drop; also appears randomly anywhere
                     with wildly variable price (make the game fun)

Tier 1 — Processed (require Tier 0 inputs)
  Alloys          ← Minerals (Industrial)
  Chemicals       ← Minerals + Radioactives (Industrial Refining)
  Textiles        ← Food (Agricultural Specialized, Rich)
  Liquor/Wines    ← Food (Agricultural Rich, Specialized)

Tier 2 — Manufactured (require Tier 1 inputs)
  Machinery       ← Alloys + Chemicals (Industrial Heavy)
  Computers       ← Alloys + Chemicals (HighTech)
  Medicines       ← Chemicals + Food (Industrial Light, some Agricultural)
  Firearms        ← Alloys + Machinery (Industrial Light) [contraband in many govts]
  Luxuries        ← Textiles + Liquor/Wines + Medicines (Services, HighTech Consumer)
  Narcotics       ← Chemicals + Volatiles [contraband] (Anarchy, some Frontier)

Tier 3 — Advanced (require Tier 2 inputs; very few systems reach this)
  Split into two roles — a system specialises in one, not both:

  PRODUCER role (makes high-tech components):
    Lasers              ← Computers + Radioactives (HighTech Research)
    Navigation Systems  ← Computers + Machinery (HighTech Research, Technocracy)
    Shields             ← Alloys + Computers (HighTech Industrial)

  INTEGRATOR role (assembles components into complete platforms):
    Military Ships      ← Lasers + Navigation Systems + Shields + Alloys (HighTech Industrial)
    Combat Vehicles     ← Machinery + Firearms + Alloys (Industrial Heavy, Dictatorship)

Precious goods (extracted, no dependency, serve as currency lubricant and high-value cargo)
  Gold, Platinum, Gem-Stones ← Mining (Rich)
```

**Fuel is free** — all stations have infinite fuel supply. It costs credits to refuel
but is not a traded commodity and does not appear in inventories.

**Systems must NOT produce across all tiers.** Enforced by specialisation (see §E).
Examples of the intended shape:
- Mining (Rich): Tier 0 only. Needs everything else imported. High prices for Tier 2+.
- Agricultural (Rich): Tier 0 food, Tier 1 textiles/liquor. Needs machinery, computers.
- Industrial (Heavy): Tier 1 alloys, Tier 2 machinery. Needs minerals in, food for workers.
- HighTech (Research): Tier 2 computers, Tier 3 producer (lasers, navigation). Needs alloys, radioactives.
- HighTech (Industrial): Tier 3 integrator (military ships). Needs all Tier 3 producer outputs.
- Services (Trade): produces nothing. Acts as price amplifier — buy/sell prices get a
  multiplier here, making the hub worth visiting even without a production role.
- Frontier (Outpost): Tier 0 minerals only. Extremely import-dependent.

### D. Inventory-driven pricing

Replace static weight-based fluctuation with stock-level pricing:

```
price = basePrice * (demandWeight / max(0.1, stockLevel / referenceStock))
```

Where `referenceStock` is the "comfortable" inventory level for that system.
- Below reference: price rises (shortage signal, attracts traders)
- Above reference: price falls (surplus signal, discourages imports, pushes exports)

This creates the trader-pull-to-remote-systems behaviour: a Frontier Outpost
with zero food has infinite theoretical price → traders will eventually go there
even from far away, as long as profit exceeds travel cost.

"Travel cost" is currently not modeled (all neighbor hops are equal).
A future extension could weight routes by hop count or system connectivity.

### E. Production specialisation cap

Each system has a fixed `specialisation[]` set (1-3 commodities it produces well).
Outside that set, production weight is 0 regardless of subtype.
This is assigned at system generation and is permanent.

This prevents large systems from becoming self-sufficient over time
and keeps long-distance trade routes viable.

The specialisation set should be seeded deterministically from the system's RNG seed
so it's reproducible (same universe seed → same specialisations).

### F. Government effects on production and trade

Currently government affects ship distribution only. It should also affect:

| Government | Production effect | Trade effect |
|---|---|---|
| Anarchy | Bonus to narcotics/firearms production | Contraband freely traded |
| Communist | All production state-controlled (higher output, no trader ships) | No private trade; state freighters move goods |
| Dictatorship | Military ship production bonus | Tariff on imports (effective price modifier) |
| CorporateState | HighTech production bonus | Traders prefer this system (profit bonus) |
| Theocracy | Narcotics/firearms banned (even Anarchy-produced can't land) | Alien Items banned |
| Technocracy | Computers/Lasers production bonus | High-tier goods only |
| Frontier types | Low production cap across the board | No tariffs, attracts smugglers |

---

## Implementation sequence

### Step 0: Wire the tinker to trade simulation

Add trade simulation controls to `tinker/index.html` / `tinker.js`:
- Import `TradeSimulator` and expose without requiring `window.DEVMODE`
- Add a "Run N ticks" button + inventory chart alongside the existing trader chart
- Add per-system detail panel: current inventory, production rates, trader count

This is the testing harness. Do not touch the game loop until the economy is stable here.

### Step 1: Add production tick

In `TradeSimulator`, add `productionTick()`:
- For each system, inject goods according to subtype rates and soft cap
- Soft cap: production rate * (1 - currentStock / maxStock); floor at 0
- Call this at the start of each `planTradeStep` before computing trades

Also add `consumptionTick()`:
- Reduce inventory for consumed goods
- If an input good is missing, set a `shortage[commodity]` flag on the system
- Shortage flag reduces production of dependent outputs (input/output tree)

### Step 2: Add input/output dependency tree

Replace the flat producer/consumer weight tables with a proper recipe structure:
```js
registry.addRecipe(subtype, {
  inputs:  { [commodityId]: amount, ... },
  outputs: { [commodityId]: amount, ... },
  rate: ticksPerBatch,
})
```
A system with missing inputs produces 0 of the dependent outputs.
This creates cascading shortages — the interesting emergent behaviour.

### Step 3: Inventory-driven pricing

Replace `_applyPriceFluctuation` with stock-level formula.
Requires systems to track `inventory[commodityId]` and `referenceStock[commodityId]`.
`referenceStock` = some multiple of the system's consumption rate per tick.

### Step 4: Specialisation cap

At `System` generation, pick 1-3 commodities as specialisations (seeded RNG).
`productionTick` ignores recipes where the output is not in specialisations.

### Step 5: Government modifiers

Add production multipliers and trade filters per government type.
Communist systems: remove trader ships, add state freighter logic (bulk moves, fixed routes).

### Step 6: Metastability validation

Run `simMove(1000)` and observe:
- Trader distribution: should stabilise, not collapse into 1-2 nodes
- Total commodity volume: should stay roughly constant (production ≈ consumption globally)
- Shortage events: should be transient, not permanent (traders eventually respond)

Tweak rates until this holds. If hubs dominate too much, add a small "explorer bonus"
(traders occasionally sample non-optimal routes → prevents local optima trap).

### Step 7: Wire into game loop (after metastability confirmed)

In `SpaceScene`, add an economy tick counter.
Every N game ticks (tunable), call `TradeSimulator.planTradeStep()` + `executeTradeStep()`.
Track `player.currentSystem` based on proximity to nearest sun/station.
Unlock `playerBuy` / `playerSell` once docking is implemented.

---

## Decisions log

| Question | Decision |
|---|---|
| Trader counts vs visual ships | Counts in the simulation model. Economy counts drive real NPC ship spawns in the renderer — piracy affects actual goods flow. |
| Tier depth | 4 tiers. Tier 3 split into Producer (components) and Integrator (platforms). Very few systems reach it. |
| Refined Fuels | Not traded. Fuel is free at all stations (costs credits, not a commodity). |
| Alien Items | Random wild-card: rare drop from Mining (Volatile) AND occasional mystery appearance anywhere. Wildly variable price. Make it fun. |
| Services/Trade hubs | Produce nothing physical. Act as **price amplifiers** — buy/sell prices get a bonus multiplier, making hubs worth visiting for the price advantage rather than a new commodity. |
