# Combat, Factions & Ship Lifecycle — Design Document

Companion to `npc_traders.md`. Covers combat reactions, the wanted system,
weapon loadouts for NPCs, and the ship production loop that keeps the galaxy alive.

---

## 1. Waiting ships (formerly "idle drift")

Ships near the station are not idle — they have completed a delivery and are waiting
for their next economy assignment. See `npc_traders.md` for the full lifecycle.

The current `npcState = 'idle'` spawn (20% of traders at scene creation) is a temporary
stand-in for this waiting state. It should be replaced by the proper lifecycle:
ships arrive, unload, enter `waiting` state, get reassigned on the next tick and depart.

The slow drift near the station during `waiting` is just cosmetic: pick a random nearby
waypoint, fly there gently, pick another. Same `traderControl` autopilot, small
`arrivalRange`, loop indefinitely until reassigned. The semantic is "between jobs",
not "permanently parked".

---

## 2. Combat reactions and the wanted system

### 2a. Threat detection

Every ship that takes a hit records its attacker:

```js
ship.lastAttacker     = attackerShip;
ship.lastHitTime      = performance.now();
```

"Under attack" = `lastAttacker` is set and `lastHitTime` is within the last 5 seconds.

Security ships (police, military) patrol within `patrolRadius`. Each frame they scan
`otherShips` for any ship that is `underAttack` within a detection radius
(`patrolRadius * 1.5`). When a threat is detected they switch to `chase` / `raid`
targeting the attacker.

```
detectedAggressor = ships within detection radius where ship.underAttack is true
if detectedAggressor:
    police → npcState = 'chase', target = lastAttacker
    military → npcState = 'raid', target = lastAttacker
```

The `otherControl` in `pid.js` already implements chase-and-fire. Security ships
simply need a `target` reference set and their `npcState` changed.

### 2b. Player as the aggressor — wanted level

If the attacker is the player, a `wantedLevel` is tracked on the scene:

```
scene.wantedLevel: 0–5
```

| Event | Δ wanted |
|---|---|
| Player shoots a trader | +1 |
| Player destroys a trader | +2 |
| Player shoots a security ship | +2 |
| Player destroys a security ship | +3 |
| Docked at a station | −1 per dock (paid fine) |
| Time elapsed in system without incident | −1 per N ticks |

At `wantedLevel >= 1`: all police in the system switch to `chase` targeting the player.
At `wantedLevel >= 3`: military joins.
At `wantedLevel >= 5`: station denies docking (dock attempt fires comms message instead).

Wanted level is local to the system — jumping resets it (you fled). Persistent wanted
(future) would require galaxy-wide tracking via the universe data.

HUD indicator: a small row of red dots near the minimap, one per wanted level. Fades
to grey as level drops.

### 2c. Trader reactions

Traders get an `isArmed` flag set at spawn:

```js
// Armed probability by system security:
// High security (many police) → 20% armed
// Low security (few police)   → 60% armed
// Anarchy                     → 90% armed
```

Weapon loadout: always `LaserGun` (traders don't carry heavy ordnance, but they
can defend themselves). Unarmed traders have `ship.weapons = []`.

**Under attack (either by player or NPC pirate):**

```
if unarmed:
    npcState = 'fleeing'
    traderDest = nearest(station, warpTunnel)   ← whichever is closer
    traderArrivalRange = same as normal arrival

if armed and attacker within firing cone and range:
    shoot back (use otherControl or a simplified version)
    also switch to 'fleeing' — they fire while running, not standing their ground
```

Comms on attack:
- First hit: `comms.trader(name, "taking fire — mayday")`
- On destruction: `comms.trader(name, "MAYDAY — hull breach, going down")` (replaces current message)

### 2d. Security ship reactions to the combat

Change `_patrolTick` in `npc.js` to include a threat scan each frame:

```js
// At the end of _patrolTick:
const threat = scene.otherShips.find(s =>
  s.lastAttacker &&
  performance.now() - s.lastHitTime < 5000 &&
  dist(ship, s) < detectionRadius
);
if (threat) {
  ship.npcState = 'chase';
  ship.target   = threat.lastAttacker;
}
```

The `scene` reference needs to be passed into `_patrolTick` — currently it's stateless.
Simplest: attach `ship.scene` at spawn time (`ship.scene = this` in `_spawnSecurityShips`).

When in `chase`/`raid`: use the existing `otherControl` path from `pid.js` (it already
handles aiming, firing, and secondary weapons). Security ships just need `ship.target`
to be set.

Return to patrol: if `target.e < 0` (dead) or target has left detection range for > 10s,
reset `npcState = 'patrol'`.

---

## 3. Weapon loadouts for NPC ships

### Weapon tier rationale

Weapons are not interchangeable. From most to least dangerous in practice:

- **`MassDriverGun`**: Very short range but devastating burst damage. Requires skill to aim
  (no homing, very fast projectile). Best weapon available, but the player's
  advantage is piloting skill. NPCs can equip it effectively only at close range.
- **`PhotonTorpedoLauncher`**: High burst energy damage, terrifying in volume. 20+ photons
  on a security ship is a serious threat. Ammo must be set explicitly at spawn
  (`weapon.ammoMax = N` before `_initAmmo`).
- **`MissileLauncher`**: Homing, very dangerous — but in an open infinite universe (unlike
  Destrier's torus topology) missiles have unlimited range and are extremely lethal.
  Use with caution; probably best for elite/military only.
- **`PlasmaGun`**: Mid-tier compromise — better range and fire rate than a mass driver,
  more damage than a laser. No ammo. Good for armed traders and pirates.
- **`LaserGun`**: Light weapon. Fast fire rate, long range, low damage. Fine as a harassing
  weapon; underwhelming as a primary threat.
- **`GaussCannon`**: Hard to aim — scatter pattern suits the human player's style but is
  poor for NPC AI. Avoid for NPCs.

### Hull values

The player with `MassDriverGun` (Bobcat default) can destroy a stock Lynx (e=1000) in
seconds. Security ships need 4–8× hull to be a credible threat. Assign `e:` at spawn.

### Assignment at spawn

| Ship type | Primary | Secondary | Hull (`e`) | Notes |
|---|---|---|---|---|
| Trader (armed) | `PlasmaGun` | — | 1500 | Light, defensive |
| Police (Lynx) | `MassDriverGun` | `PhotonTorpedoLauncher` (20 ammo) | 5000 | Credible threat |
| Military (Lynx) | `MassDriverGun` | `PhotonTorpedoLauncher` (30 ammo) | 8000 | Very dangerous |
| Pirate (future) | Random: `PlasmaGun`, `MassDriverGun` | `MissileLauncher` | 2000 | Randomised per spawn |
| Elite pirate (future) | `MassDriverGun` | `PhotonTorpedoLauncher` | 4000 | Rare, very dangerous |

Weapon mounting: pass `weapons: [new MassDriverGun({...})]` in the constructor.
For ammo weapons, set `weapon.ammoMax = N` on the instance before `_initAmmo` is called.
`_initAmmo` reads `w.ammoMax` to set initial + max count.

Security ships are now spawned with weapons and boosted hull in `_spawnSecurityShips`
(`scene.js`).

---

## 4. Ship production — closing the lifecycle loop

### The problem

Ships get destroyed. The universe has a fixed pool of ships per system (set at generation).
Without replacement, long play sessions drain the galaxy of traffic. We need production.

### The solution: HighTech worlds produce ships

In the commodity tier model (`trade_plan.md §C`), `Military Ships` and commercial
vessels are Tier 3 / Tier 3 Integrator outputs produced by `HighTech Industrial` systems.

**The production tick extension:**

Each economy tick, qualifying systems add ships to their `shipDistribution`:

```js
function shipProductionTick(universe) {
  for (const sys of universe) {
    if (sys.category === SystemCategories.HighTech) {
      if (sys.subtype === 'Industrial') {
        // Produces military ships (slow)
        if (Math.random() < MILITARY_SHIP_RATE) {
          sys.shipDistribution[ShipTypes.MILITARY] =
            (sys.shipDistribution[ShipTypes.MILITARY] ?? 0) + 1;
        }
        // Produces traders as commercial byproduct
        if (Math.random() < TRADER_SHIP_RATE) {
          sys.shipDistribution[ShipTypes.TRADER] =
            (sys.shipDistribution[ShipTypes.TRADER] ?? 0) + 1;
        }
      }
      if (sys.subtype === 'Research') {
        // Produces a trickle of traders (advanced commercial vessels)
        if (Math.random() < TRADER_SHIP_RATE * 0.5) {
          sys.shipDistribution[ShipTypes.TRADER] =
            (sys.shipDistribution[ShipTypes.TRADER] ?? 0) + 1;
        }
      }
    }
  }
}
```

Suggested rates (tunable):
```
MILITARY_SHIP_RATE = 0.05  // ~1 new military ship per 20 ticks per HighTech Industrial
TRADER_SHIP_RATE   = 0.15  // ~1 new trader per 7 ticks per HighTech Industrial
```

These are per-system per-tick. With ~3 HighTech systems in a galaxy, that's roughly
1 new trader every 2–3 ticks globally — a trickle that matches the destruction rate.

### Why this is the right design

- **Shortages feel real**: if a HighTech Industrial system collapses (government transition,
  pirate takeover), ship production stops. Regional traffic dries up. The player sees it.
- **Ships as de-facto commodity**: a HighTech system is worth visiting and worth protecting
  even before the commerce screen exists, because it's producing the ships that keep
  everything else running.
- **Trade routes carry ships**: the `executeTradeStep` "forced relocation" transactions
  already move trader counts between neighbors. New ships produced in a HighTech system
  naturally spread outward via this mechanism over subsequent ticks.
- **The galaxy breathes**: `destroyed → galaxy loses ships → HighTech worlds slowly replenish
  → traders spread → economy recovers`. The loop is closed.

### Dependency on trade_plan.md production tick

`shipProductionTick` should be called alongside `productionTick` and `consumptionTick`
within the dock-triggered tick chain. It only requires `sys.category` and `sys.subtype`
which already exist on `System` objects via `systemEconomy.js`.

---

## Implementation sequence

### Step 1 — Weapon loadouts on existing NPCs
Give security Lynxes their weapons at spawn. Verify they fire on hostile targets
using the existing `otherControl` path. No new logic needed.

### Step 2 — Hit registration + attacker tracking  
Add `lastAttacker` / `lastHitTime` to bullet-collision handling.
This is the foundation for everything else.

### Step 3 — Security reaction to nearby combat
Extend `_patrolTick` with the threat scan. Test: shoot a trader near a station,
watch police peel off patrol to engage you.

### Step 4 — Wanted level HUD
Simple: count red dots in a row, increment/decrement per the table above.
Station denial message when docking at wanted >= 5.

### Step 5 — Trader flee/fight reactions
Set `isArmed` at spawn. On hit: switch to `'fleeing'` + optionally shoot back.
Comms mayday message.

### Step 6 — Ship production tick
Add `shipProductionTick` to the dock tick chain.
Run a long simulation in the tinker and verify trader counts stabilise over 1000+ ticks.

---

## Open questions

- **Missile friendly fire**: missiles home on target — should they distinguish friend/foe?
  Currently `MissileLauncher` probably doesn't. Worth checking before giving police missiles.
- **Pirate spawning trigger**: pirates in `shipDistribution` exist but never spawn as ships.
  They should spawn when the player enters the system (probability based on count), and
  immediately target the nearest trader. This is step 0 for testing the whole reaction chain.
- **Wanted persistence across jumps**: local-only for now is simpler. Galaxy-wide wanted
  (bounty hunters follow you through tunnels) is a later feature.
- **Armed trader visual distinction**: some kind of subtle marker (slightly different ship
  color, or a gun hardpoint visible on the sprite) so the player can tell before attacking
  whether a trader will fight back.
