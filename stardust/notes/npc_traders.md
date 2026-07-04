# NPC Trader Ships — Design Document

Companion to `tinker/trade_plan.md` and `tinker/universe_plan.md`.
This doc covers how the background economy simulation surfaces as visible ships in the game world.

---

## Core principle: counts drive spawns

The simulation already tracks `system.shipDistribution[ShipTypes.TRADER]` — an integer count
of traders based in each system. `planTradeStep` + `executeTradeStep` move those counts
between systems, one economy tick at a time.

**The rule**: at any moment, the current system's trader count is the pool from which
visible NPC ships are drawn. The simulation is authoritative; the renderer is a sample.

We never need to simulate every trader across the entire galaxy as an actual ship object.
Only the **current system** gets rendered ships. When the player jumps, despawn the old
system's ships and spawn fresh ones for the new system.

---

## When the economy ticks

The user lands → `dockAction()` fires. This is the tick trigger:

```
player docks
  → productionTick(currentSystem)        // inject goods
  → consumptionTick(currentSystem)        // consume inputs
  → planTradeStep()                       // all systems plan routes
  → executeTradeStep()                    // counts move, inventory moves
  → healthTick()                          // stability counters update
  → transitionTick()                      // government changes if threshold hit
  → reconcileLocalShips(currentSystem)    // sync visible ships to new counts
```

A single dock → one economy tick. The coarseness is intentional:
- It gives the player agency over the pace of the simulation
- It matches Elite's tradition of time passing while docked
- It avoids the game world mutating while the player is flying

On undock, **no tick fires**. The player flies in a snapshot of the economy.

---

## What `planTradeStep` tells us

Each transaction in `pendingTransactions` is:

```js
{
  sourceSystemId:      number,   // where the trader was
  destinationSystemId: number,   // where they're going
  commodityId:         string,   // what they're carrying (null = relocation)
  quantity:            number,
  profit:              number,
  shipType:            ShipTypes.TRADER,
  notes?:              "Forced relocation",
}
```

Transactions involving the **current system as source** become visible departing ships.
Transactions involving the **current system as destination** become visible arriving ships.
All other transactions are invisible background movement — they still execute (counts + inventory move).

---

## Visible ship lifecycle

Ships near the station are not "idle" — they have completed a delivery and are
**waiting** for their next economy assignment. The inter-tick gap is their downtime.
Cargo is unloaded when they get within docking range of the station; at that point
they drift near the station until the next tick reassigns them a route.

```
arriving  →  [within docking range: unload cargo, mark transaction complete]  →  waiting
waiting   →  [economy tick fires, new route assigned]                         →  departing
departing →  [reaches warp tunnel edge]                                       →  despawn (jumped)
```

Maintain a list `scene.traderShips[]` — the currently spawned NPC traders.

### At dock time (full tick)

After `executeTradeStep()`, call `reconcileLocalShips(system)`:

1. Find all transactions where `sourceSystemId === currentSystem.id` → `departures[]`
2. Find all transactions where `destinationSystemId === currentSystem.id` → `arrivals[]`
3. Assign departure routes to currently-waiting ships (one per departure transaction)
4. Spawn fresh arriving ships at the appropriate warp tunnels (one per arrival transaction)

Departing ships: fly toward the warp tunnel to `destinationSystemId`, despawn on arrival.
Arriving ships: fly toward station, unload on approach, become `waiting`.

### On system entry (soft tick — current system only)

When the player jumps into a system, fire a soft tick for that system:
- Run `productionTick` and `consumptionTick` for this system only
- Re-assign any waiting ships that have a profitable route available
- No government transitions, no health recalculation

Spawn the initial set of visible ships based on the system's current distribution:
- Some `arriving` (at random tunnels — they came from neighbors)
- Some `waiting` (near station — completed recent deliveries)
- No `departing` yet until the soft tick assigns routes

### Time-based mini-tick (while player is in-system)

Every 3–5 real minutes of flight time, fire another soft tick for the current system.
Waiting ships get reassigned. New arrivals spawn at tunnels. The system feels
alive without requiring the player to dock.

### On system jump (leaving)

Despawn all current `traderShips`. The new system handles its own spawn on entry.

---

## Ship behaviour states

```
idle       → orbit station loosely, no cargo display
arriving   → fly from warp tunnel toward station, has commodity
departing  → fly from station toward warp tunnel, has commodity
```

Transitions:
```
arrive → dock (reach station range) → idle
idle   → assigned departure transaction → departing
departing → reach tunnel (scene boundary) → despawn
```

Idle ships can be interrupted: if a pirate spawns nearby, traders flee toward the station.
This is a visual signal that the system is unsafe — consistent with `disruptionChance()`.

---

## Pirate interaction (visual disruption)

`disruptionChance(system)` returns a probability based on pirate vs law ship counts.
During `executeTradeStep`, disrupted transactions are already partially modeled
(see existing `disrupted` logic — goods are partially destroyed, trader may be lost).

For the renderer:
- If a departure ship gets "disrupted" (roll against `disruptionChance` on spawn):
  - Spawn a pirate ship near the tunnel, chasing the departing trader
  - If the pirate catches the trader: trader despawns early (ambush), pirate lingers
  - If the player intervenes and kills the pirate: no gameplay reward yet,
    but this is the hook for the bounty system later

---

## NPC trader ship type

Use an existing ship class (Lynx or Bobcat) for the trader visual.
Add a `traderRole` flag to distinguish them from security NPCs:

```js
ship.traderRole = true;
ship.traderCargo = transaction.commodityId;  // for future cargo-scoop / inspection
ship.traderState = 'arriving' | 'departing' | 'idle';
ship.traderDest = { warpTunnelIndex } | { station };
```

NPC control: traders do NOT use the `otherControl` / `npcControl` chase logic.
They use a simpler "fly toward target, decelerate on approach" autopilot (already
partially in `pid.js`). They do not shoot. They flee from pirates.

---

## How many ships to spawn

`system.shipDistribution[TRADER]` could be large (10–30 in a busy hub).
Spawning 20 ships is expensive. Cap the visible count:

```
visibleIdleTraders = Math.min(3, system.shipDistribution[TRADER])
visibleDepartures  = departures that involve current system (uncapped — usually 0–2)
visibleArrivals    = arrivals that involve current system (uncapped — usually 0–2)
```

The "missing" traders in a busy hub are implied — they're docked inside the station.
The player can imagine the station is full of traffic even if only 3 ships are visible.

---

## What the player observes

| Economy state | Visible effect |
|---|---|
| Healthy trading hub | 2–3 idle traders near station, 1 departing after each dock |
| Arrival surge (neighbor exporting) | Ship spawns at tunnel, flies in loaded |
| Post-collapse (traders fled) | 0 idle traders; pirates may circle |
| Anarchy | No traders at all (count = 0 in simulation); only pirates |
| Recovery underway | 1 trader trickles back from a stable neighbor |

---

## Integration points

| File | Change needed |
|---|---|
| `scene.js` | Add `traderShips[]`, call `reconcileLocalShips` in dock handler |
| `stardust.js` | Wire dock action to call `tradeSimulator.planTradeStep()` + `executeTradeStep()` + healthTick + transitionTick |
| `trade.js` | `TradeSimulator` needs to be instantiated with the live universe once at game start |
| New: `traderShip.js` | Thin wrapper around Lynx/Bobcat with the state machine above |
| `minimap.js` | Show trader dots (yellow, same faction color already defined) |

---

## Implementation sequence

### Step 1 — Simulation wired to dock
Instantiate `TradeSimulator(universe)` in `stardust.js` on game start.
On dock: call the tick chain. Log the resulting transactions.
No visible ships yet — verify economy is moving correctly (inventory, counts, prices).

### Step 2 — Idle traders at station
After dock tick, spawn `visibleIdleTraders` ships near the station using Lynx.
They orbit loosely. No state machine yet — just static presence.
Verify spawning and despawning on system jump works.

### Step 3 — Departures
Assign departure targets to idle ships post-tick.
Add the "fly toward warp tunnel" autopilot behaviour.
Despawn on tunnel reach.

### Step 4 — Arrivals
On dock, spawn arriving ships at the appropriate warp tunnel.
Fly toward station, become idle on arrival.

### Step 5 — Pirate disruption
Roll disruption chance per departure. Spawn pirate interceptor.
Simple chase → trader despawn if caught.

### Step 6 — Player commerce
`playerBuy` / `playerSell` now have a live `player.currentSystem`.
Show commodity prices at dock screen.
This is the payoff — the simulation now affects what the player can buy and at what price.

---

## Open questions

- **Trader comm chatter**: should departing/arriving traders send a radio message visible in HUD?
  ("Freighter Orca departing for Zaonce" style) — nice flavour, low cost.
- **Inspect cargo**: can the player scan a trader mid-flight to see what they're carrying?
  Contraband scan = gameplay hook for later police faction work.
- **Trader names**: generate a ship name at spawn (persistent per ship object, gone on despawn).
  Reuse the `generateEliteName` RNG from `universe.js`.
- **Multiple trader ship types**: Lynx = small, Bobcat = medium, Panther = large.
  Assign by `quantity` in transaction? Larger loads → bigger ship class.
