# Session Compaction Summary

## User Intent
- Polish NPC ships (security weapon loadouts, idle trader drift)
- Design and document weapon/ship/upgrade system for the full game
- Add in-system exploration via wreck spawning and scanner mechanics
- Fix miscellaneous bugs (self-referential jump points, speed cap, zoom issues)

## Contextual Work Summary

### Security Ship Weapon Loadouts
- Police Lynx: `MassDriverGun` + `PhotonTorpedoLauncher` (20 ammo), `e: 5000`
- Military Lynx: same loadout, 30 photon ammo, `e: 8000`
- Weapons created post-construction so `source: ship._id` is correctly set
- `_initAmmo` called manually after setting `photon.ammoMax`

### Idle Trader Drift
- Idle traders now spawn with a random waypoint near station (`STATION_R * 1.5–3`)
- On arrival, pick new random waypoint — loop indefinitely using existing `traderControl`
- Only arriving/departing traders despawn on `traderArrived`

### Wreck Exploration System
- New `stardust/wreck.js`: `Wreck` class with pulsing amber halo (4000 world units) + rotating diamond
- Wrecks spawn per-planet on system entry, seeded from `systemId + planetIndex` (deterministic)
- 40% chance per non-sun planet; 25% chance of a second wreck
- Loot tables keyed by planet kind: rocky → ammo, gas/ice giants → rare items/compressors
- `SCOOP_RANGE = 500` units; auto-collect on proximity, comms message fires
- Scanner: beyond `SCAN_RANGE` (40k units) shows `?` on minimap/system map; inside shows `×`
- Wrecks hidden in world-space until within `SCAN_RANGE` (visibility gated via `_playerRef`)
- Wreck proximity zoom: partially counteracts planet zoom-out when close; target `max(scale*4, MAXSCALE*0.4)`

### System Map Enhancements
- Wrecks shown as `?`/`×` respecting scan range (INVARIANT comment linking minimap ↔ systemMap)
- Hover tooltips on all objects: planets, tunnels, station, ships, wrecks, player ship
- Player hover shows: weapons, ammo counts, cargo (or "empty"), credits (default 0)
- Resolved wrecks show loot contents on hover; unresolved show "Unknown signal source"

### Bug Fixes
- **Self-referential jump points**: `universe.js` — `rnd() * i` at `i=0` produced self-link; added `linked !== i` guard in both generation and `relink()`
- **Speed cap**: added `100.5 * 100.5` limit to `backThrust` (the actual accelerator); `forwardThrust` is braking and needs no cap
- **Sun proximity zoom**: sun used `bodyRadius * 5` like planets, covering the entire inner system; changed to `* 1.5` for sun only
- **Wreck zoom jarring**: removed fixed target; now blends `scale*4` floored at `MAXSCALE*0.4`
- **Ghost triangle off-centre**: passes `playerScreenX/Y` offset through HUD to position ghost canvas on actual ship screen position
- **Jump point tooltip arrow duplicate**: `tunnel.name` already includes `→`; removed redundant prefix
- **Comms font size**: `0.72em` → `0.95em`
- **Wreck `?` visibility**: colour changed from `rgba(160,160,160,0.5)` to `rgba(220,220,255,0.9)`

### Design Documents
- **`stardust/notes/weapons_ships.md`** (new): full weapon taxonomy, ammo economy, cargo costs, ship progression, extension slots, matter compressors, power management computer, shield system, rarity map, implementation notes for new weapons
- **`stardust/notes/combat_factions.md`**: section 3 rewritten with corrected weapon tier rationale (GaussCannon = NPC-unfriendly, PlasmaGun = good mid-tier compromise, LaserGun = light harassing)
- Independent hardpoint firing documented in `weapons_ships.md` §6 — mixed loadouts, per-slot fire bindings, scarcity implications, implementation note

### Player Starting Loadout
- Bobcat default changed from `MassDriverGun` × 2 to `PlasmaGun` × 2

## Files Touched

### Core Game Logic
- **stardust/scene.js**: security spawns with weapons+hull; idle trader drift; `_spawnWrecks()`; `_onScoop()`; wreck update/scoop loop; `LOOT_TABLES` + `_rollLoot()`; wreck proximity zoom; `playerScreenX/Y` in HUD; sun zoom multiplier fix; `SCAN_RANGE` import
- **stardust/npc.js**: (unchanged this session — `traderControl` was already there)
- **stardust/stardust.js**: speed cap on `backThrust`; plasma gun default loadout (via bobcat.js)
- **stardust/base/bobcat.js**: `MassDriverGun` → `PlasmaGun` default weapons
- **stardust/tinker/universe.js**: self-link guard in generation and `relink()`

### New Files
- **stardust/wreck.js**: `Wreck` class, `SCOOP_RANGE`, `SCAN_RANGE`, `HALO_RADIUS`
- **stardust/notes/weapons_ships.md**: full weapons/ships/upgrades design reference

### HUD / Minimap / Map
- **stardust/minimap.js**: `setWrecks()`; wreck scanner blips (`?`/`×`); ghost canvas positioned via `playerScreenX/Y`; INVARIANT comment; `?` colour fix; font size fix
- **stardust/systemMap.js**: wreck `?`/`×` with scan range gate; hover tooltip system (`_hitTargets`, tooltip div); player ship info on hover; INVARIANT comment; jump point label fix

### Design Docs
- **stardust/notes/combat_factions.md**: weapon tier rationale rewritten
- **stardust/notes/weapons_ships.md**: created

## Current State / Next Steps

### Immediate
- **Hit registration** (`stardust/base/shipbase.js`): add `lastAttacker`/`lastHitTime` on bullet collision — foundation for security chase, wanted level, trader flee
- **Security patrol→chase** (`npc.js` `_patrolTick`): scan nearby ships for `lastAttacker`; attach `ship.scene` at spawn
- **Wanted level** (`scene.js`): `scene.wantedLevel` 0–5; red dots near minimap

### Short Term
- **Independent hardpoint fire**: separate `shootPrimary`/`shootSecondary` bindings indexing `weapons[0]`/`weapons[1]`; update powerup system to target individual indices
- **Commerce screen**: `playerBuy`/`playerSell` stubs in `tinker/trade.js`; wire `player.credits`, `player.cargo`
- **Pirate spawning**: `shipDistribution[PIRATE]` counts exist but nothing spawns; spawn on system entry, target nearest trader

### Medium Term
- **Soft tick on system entry**: production/consumption for current system; trigger in `stardust.js` on jump arrival
- **`reconcileLocalShips()`**: replace static spawn with post-tick reconcile
- **Boost as station purchase**: `boost.js` already implemented; expose in shop
- **Ship purchase**: Lynx available at HighTech/Military stations for significant credits
