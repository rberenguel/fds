# Session Compaction Summary

## User Intent
- Implement a commerce system: player buys/sells commodities at stations, jump costs, cargo tracking
- Polish gameplay feel: speed zones, docking, torus drive effects, minimap improvements
- Fix NPC bugs introduced in previous sessions (trader overshoot, missing stations)

## Contextual Work Summary

### Commerce System
- New `stardust/market.js`: `MarketScreen` class shown on dock, replaces inline "DOCKED" screen
- Commodities from system's production/consumption model; buy at market price, sell at 90% (surcharge)
- Profit column tracks weighted average cost basis per commodity (`player.inventoryCost`)
- Jump cost deducted on tunnel entry, tiered by destination system category (50–200 cr), comms notification
- `System._initInventory()` seeds starting stock from production weights — no scene-level seeding needed

### Player State Design Fix
- `cargoMax = 20` on `Bobcat` (ship property); `credits`, `inventory`, `inventoryCost`, `cargo` initialised on player object in `stardust.js` (not in ship class)

### Speed Zones & Torus
- `STATION_EXCLUSION_ZONE = 120000`: no torus + 50 m/s cap near station
- `TUNNEL_APPROACH_ZONE = 60000`: same speed cap near each warp tunnel; torus also blocked here
- Comms message (`NAVCON`) when speed cap engages, throttled 4s; mass-lock message on torus disengage from ship proximity
- Torus warp effect: passes fake high velocity (`TORUS_WARP_SPEED × 4`) to starfield; dust scale formula uses `√speed` so streaks grow dramatically at warp speed without affecting normal flight

### NPC & Spawn Fixes
- `traderControl` had `backThrust`/`forwardThrust` swapped — traders never accelerated, caused overshoot beyond tunnels. Fixed.
- `_buildStation` now falls back to innermost non-sun body when no earth-like planet exists; all systems get a station
- Docking speed tightened to 5 m/s; bay trigger radius tightened to `STATION_RADIUS × 0.1`
- Undock places player at 1.5× station radius from bay entrance, velocity zeroed

### Minimap & System Map
- Speed-cap zone rings drawn on minimap: dashed teal circle (station), dashed amber circles (tunnels)
- `STATION_EXCLUSION_ZONE` and `TUNNEL_APPROACH_ZONE` exported from `scene.js`, imported in `minimap.js`
- Hover line on system map: dashed green line from player to hovered object with distance label
- All `_hitTargets` entries now include `wx, wy` world coords; player entry has `isPlayer: true`
- Prograde/retrograde minimap markers replaced with triangles; centroid-corrected (tip at `+r`, base at `-r/2`) so triangle sits correctly on the indicator ring

### Parallax
- Dust streak scale now grows as `1 + √(speed/√maxMagnitude) × maxSkew` — uncapped, same value at old ceiling speed, dramatically larger at torus velocity
- Stars unchanged (user rejected star elongation)

## Files Touched

### Core Logic
- **stardust/scene.js**: Jump cost check + comms; speed cap zones for station and tunnels; torus block near tunnels; mass-lock comms; `_buildStation` fallback; export zone constants; pass fake torus velocity to starfield
- **stardust/npc.js**: Fixed `traderControl` thrust direction (backThrust = accelerate, forwardThrust = brake)
- **stardust/tinker/system.js**: `_initInventory()` seeds stock from production model in constructor
- **stardust/base/bobcat.js**: Added `cargoMax = 20`
- **stardust/station.js**: `DOCK_MAX_SPEED` 20 → 5 m/s; `DOCK_BAY_RANGE` 0.15 → 0.1 × radius

### New Files
- **stardust/market.js**: `MarketScreen` class — full buy/sell UI, profit tracking, equipment section, undock button

### UI / HUD
- **stardust/stardust.js**: Player state init (`credits`, `inventory`, `inventoryCost`, `cargo`); `showDockedScreen` uses `MarketScreen`; undock repositions player safely; `marketScreen` replaces `dockedScreen`
- **stardust/minimap.js**: Speed-cap zone rings; import zone constants; centroid-fixed prograde/retrograde triangles
- **stardust/systemMap.js**: Hover distance line; `wx`/`wy` world coords on all hit targets; `_hoveredTarget` tracked; redraw on every mousemove

### Visual
- **stardust/parallax.js**: Dust scale formula uncapped (grows with √speed); torus `torus` param removed (velocity-driven)

## Current State / Next Steps

### Immediate
- **Pirate spawning**: `shipDistribution[PIRATE]` counts exist, nothing spawns; would complete basic combat loop
- **Wanted level display**: `wantedLevel` tracked in scene but not shown; red dots near minimap, decay over time
- **Independent hardpoint fire**: separate bindings for `weapons[0]`/`weapons[1]`

### Medium Term
- Soft economy tick on system entry (production/consumption)
- Asteroid fields for mining
- Ship purchase at military/high-tech stations
