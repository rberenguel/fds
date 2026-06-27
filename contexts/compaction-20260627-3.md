# Session Compaction Summary — 2026-06-27 (3)

## User Intent

- Port the ship/weapons system from `destrier` into `stardust` while keeping stardust's engine (parallax, speed-zoom)
- Add a minimap HUD to the stardust game with planet targeting, distance, and speed readout
- Fix crash on startup (ammo not initialized), and make the nebula fainter

## Contextual Work Summary

### Bug Fix: Ammo Crash
- `Bobcat.update()` crashed because `this.ammo[w.kind]` was undefined — ammo dict was never populated
- Added `_initAmmo(weapons)` to `Ship`, called in constructor and in `Bobcat` after post-super weapon assignment
- Also fixed unsafe `.count` access on secondary weapons with optional chaining

### Ship System Port from Destrier
- Created `stardust/base/` directory with files ported from `destrier/src/base/`:
  - `shipbase.js`: full Ship class — `burst()`, `increaseEnergy()`, `getPan()`, `inertialDampener`, `boostStop`, `vertices`, debris-generating `explode()`, `destroy()`/`destroyWeapons()`, shield blink, hit flash, 3-slot ammo refresh, safe `window.sampler?.()` calls
  - `debris.js`: ship wreckage fragments that drift and fade after death
  - `lynx.js`, `bobcat.js`: updated with `vertices` prop (enables debris), targeting crosshairs on Bobcat
  - `panther.js`: new large AI ship (6 guns: 4× mass driver + 2× laser)
- `stardust/ship.js` replaced with re-exports from `./base/`

### Weapons Port
- Added `stardust/weapons/missileLauncher.js`: homing missile with 30° cone targeting
- Added `stardust/weapons/boost.js`: speed burst with phase shield
- Updated `stardust/weapons/weapons.js` to export `MissileLauncher`
- Added missing settings fields to `roids2/settings.js`: `shipProps`, `player` (boostDuration, empDuration, etc.), `weaponProps.maxRange`, `showHitMs`

### Collision Handling in Scene
- `stardust/scene.js` now handles:
  - Bullet-to-player: hit flash, hit flames, player death with debris
  - Bullet-to-otherShip: hit flash, hit flames, ship death with debris
  - Dead ships pruned from `otherShips` each frame
  - Debris list rendered each frame (generate on first draw, attach to viewframe)
- Added imports: `Flame`, `settings`, `Debris`, `Minimap`

### Minimap HUD (`stardust/minimap.js`)
- New file: circular canvas element bottom-right, sized to ~1/5.5 screen width
- Ship-centred view with fixed `VIEW_RADIUS = 250000` world units (objects outside are clipped)
- Draws: sun (star colour), planets (blue-white dots), other ships (red dots), player (green directional triangle at centre)
- HUD text layers:
  - Curved arc at bottom: planet type + distance (`EARTHLIKE  2.3k`) in planet's colour
  - Straight centred line above: speed in green (`45.2 m/s`)
- `setHUD({targetName, targetColor, targetDist, speed})` called from scene each frame
- `setOtherShips(ships)` called each frame to show NPC positions

### Scene / HUD Wiring
- `scene.js`: removed DOM element refs for planet/speed display; targeting loop now calls `minimap.setHUD()`
- `index.html`: `#info` div hidden (minimap takes over)
- `planet.js` `pl.kind.slice(1)` used for planet type label; Sun avoided showing system name (uses `"Star"` label set in scene)

### Visual Tweaks
- Nebula alpha reduced to `0.15` in `renderedSystem.js` (was fully opaque)

## Files Touched

### New Files
- **stardust/base/shipbase.js**: Full Ship class from destrier
- **stardust/base/debris.js**: Ship wreckage system
- **stardust/base/lynx.js**: Lynx ship with vertices
- **stardust/base/bobcat.js**: Bobcat with targeting crosshairs and self-init ammo
- **stardust/base/panther.js**: New large AI ship class
- **stardust/weapons/missileLauncher.js**: Homing missile weapon
- **stardust/weapons/boost.js**: Speed boost ability
- **stardust/minimap.js**: Circular HUD minimap with curved text

### Modified Files
- **stardust/ship.js**: Now just re-exports from `./base/`
- **stardust/weapons/weapons.js**: Added MissileLauncher export
- **stardust/scene.js**: Collision handling, minimap wiring, removed DOM HUD refs
- **stardust/index.html**: Hidden `#info` div
- **stardust/tinker/renderedSystem.js**: Nebula alpha 0.15
- **roids2/settings.js**: Added shipProps, player, weaponProps, showHitMs

## Open Issues / Next Steps
- Planet names don't exist yet — type label (`pl.kind.slice(1)`) is used as a placeholder
- `kindLabels` mapping (kSun→"Star" etc.) should be added to a proper constants file, not inline
- The Sun currently shows `"Sun"` from `kind.slice(1)` — acceptable until proper names exist
- Minimap `VIEW_RADIUS` is fixed; zoom control would be a useful addition
