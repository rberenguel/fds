# Session Compaction Summary

## User Intent
- Polish docking mechanics (require ship to actually reach the bay marker)
- Add atmospheric proximity zoom for planets/sun and a ghost ship overlay when zoomed out
- Design and begin implementing NPC trader ships with economy-linked behavior
- Design combat/faction reactions, wanted system, and ship lifecycle loop

## Contextual Work Summary

### Docking Fix
- `DOCK_BAY_RANGE` reduced from `STATION_RADIUS * 0.6` (1200 units) to `STATION_RADIUS * 0.15` (300 units)
- Now requires the player to actually fly up to the bay face to trigger docking

### Planet/Sun Proximity Zoom
- Added a loop over all `renderedSystem.planetObjects` in the camera update
- Approach range scales with body size (`bodyRadius * 5`); target scale fills ~50% of screen at contact
- Uses same smoothstep + `Math.min` pattern as the existing station proximity zoom
- `zoomRatio = scale / MAXSCALE` passed to minimap HUD each frame

### Ghost Ship Overlay
- Second canvas element in `Minimap`, fixed-positioned at screen center
- Fades in when `zoomRatio < 0.3`, fully visible at `0.05`
- Draws the same ship triangle (matching minimap style) at the player's heading angle
- Activates on any zoom-out (speed or proximity), not just near planets

### Comms System (`stardust/comms.js`)
- `CommsSystem` class: DOM-based overlay (bottom-left), up to 5 messages, auto-fade
- Source types: `trader` (yellow), `station` (cyan), `pirate` (red), `police` (blue), `system` (grey)
- `broadcast({ source, label, text, ttl })` core method; typed helpers: `.trader()`, `.station()`, `.pirate()`, `.police()`, `.system()`
- `generateShipName()` exported — uses `generateEliteName` with random seed for NPC ship names
- Wired into `scene.js` (create + update + destroy alongside minimap)
- On dock: station greeting + 1–2 staggered trader chatter messages; on undock: station farewell

### NPC Trader Ships
- `'trader'` PID preset added to `NPC_PRESETS` (softer gains than patrol)
- `traderControl(ship, dt)` exported from `npc.js` — waypoint following with deceleration on approach
- `_spawnTraderShips()` in `scene.js`: up to 3 visible traders per system (1 per ~4 simulation traders)
  - 40% arriving (spawn at warp tunnel → fly to station)
  - 40% departing (spawn near station → fly to tunnel)
  - 20% waiting near station (current stand-in for between-tick state)
- Uses `Bobcat` ship class; each ship gets a `generateShipName()` name stored as `traderName`
- Comms broadcast at spawn (staggered): arriving announces from-system, departing announces to-system
- On `traderArrived`: quiet despawn (no explosion)
- On destruction (`e < 0`): `universe[systemId].shipDistribution[TRADER]--` + MAYDAY comms

### Design Documents Written
- `stardust/notes/npc_traders.md`: Full lifecycle design — tick types (full/soft/mini), waiting state
  semantics, arrival/departure/reconcile flow, pirate disruption hook, integration points
- `stardust/notes/combat_factions.md`: Threat detection via `lastAttacker`/`lastHitTime`,
  wanted level (0–5), trader armed/unarmed reactions, security ship patrol→chase transition,
  NPC weapon loadouts per ship type, ship production via HighTech worlds closing the lifecycle loop

## Files Touched

### Core Game Logic
- **stardust/station.js**: `DOCK_BAY_RANGE` reduced to `STATION_RADIUS * 0.15`
- **stardust/scene.js**: Planet/sun proximity zoom loop; `zoomRatio` in HUD; `CommsSystem` create/update/destroy; `_spawnTraderShips()`; `traderControl` in update loop; trader arrival despawn + destruction economy impact; imports for `Bobcat`, `traderControl`, `ShipTypes`, `generateShipName`
- **stardust/npc.js**: `'trader'` PID preset; `traderControl()` function exported
- **stardust/stardust.js**: `generateShipName` + `universe` imports; `showDockedScreen` sends station comms + `_traderChatter()`; `dismissDockedScreen` sends farewell

### New Files
- **stardust/comms.js**: `CommsSystem` class + `generateShipName()` utility
- **stardust/notes/npc_traders.md**: NPC trader lifecycle design document
- **stardust/notes/combat_factions.md**: Combat reactions, wanted system, weapon loadouts, ship production design

### HUD / Minimap
- **stardust/minimap.js**: Ghost ship overlay canvas (`_ghostCanvas`, `_ghostCtx`, `_drawGhost()`); `zoomRatio` consumed from HUD state; `destroy()` removes both canvases

## Current State / Next Steps

### Immediate
- **Waiting ship drift** (`scene.js` `_spawnTraderShips`, `npcState = 'idle'` branch): currently
  motionless. Fix: assign a random nearby waypoint as `traderDest` and loop — on `traderArrived`,
  pick a new waypoint within `STATION_R * 3`. Uses existing `traderControl` unchanged.
- **Weapon loadouts on security ships** (`scene.js` `_spawnSecurityShips`): Lynx constructed
  with no `weapons:` prop. Add `weapons: [new LaserGun()]` for police, `weapons: [new GaussCannon()]`
  for military. Import from `stardust/weapons/weapons.js`. The `ammo` system initialises automatically.

### Short Term (from combat_factions.md)
1. **Hit registration** (`stardust/base/shipbase.js` bullet-collision path): add `lastAttacker` /
   `lastHitTime` to any ship that takes a hit. Foundation for everything below.
2. **Security patrol→chase** (`npc.js` `_patrolTick`): scan nearby ships for `lastAttacker` set;
   switch `npcState = 'chase'`, set `ship.target = lastAttacker`. Attach `ship.scene` at spawn
   so `_patrolTick` can read `otherShips`.
3. **Wanted level** (`scene.js`): `scene.wantedLevel` int 0–5; increment when player is
   `lastAttacker`; display as red dots near minimap in `minimap.js`.
4. **Trader flee/fight** (`npc.js` or `scene.js` update loop): `isArmed` flag set at spawn;
   on hit switch to `'fleeing'` state, `traderDest` = nearest station or tunnel; if armed,
   also fire back via `otherControl`.

### Medium Term
- **Soft tick on system entry + mini-tick every ~4 min**: run production/consumption/route
  reassignment for current system only (no government transitions). Trigger in `stardust.js`
  on jump arrival and via a `setInterval`.
- **`reconcileLocalShips()`** in `scene.js`: replace the static spawn with a proper post-tick
  reconcile — assign waiting ships to departure transactions, spawn arriving ships at tunnels.
- **Pirate NPC spawning**: `shipDistribution[TRADER.PIRATE]` counts exist but no ships spawn.
  Spawn on system entry, target nearest trader immediately.

### Long Term
- **`shipProductionTick()`**: HighTech Industrial/Research systems increment `shipDistribution`
  each tick. Add alongside `productionTick` in the dock tick chain (`stardust.js`).
- **Commerce screen**: `playerBuy`/`playerSell` stubs exist in `tinker/trade.js`; need
  `player.currentSystem`, `player.credits`, `player.inventory` wired up.
- **Galaxy-wide wanted persistence**: local-only for now; future = bounty hunters follow through tunnels.
