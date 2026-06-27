# Session Compaction Summary — 2026-06-27 (4)

## User Intent

- Polish the in-game HUD minimap: fix text rendering, add planet naming, navigation indicators
- Implement Elite-style intra-system travel (torus drive) for reaching distant planets
- Fix ship rendering order, improve camera feel, and tune flight controls

## Contextual Work Summary

### Minimap Text Fix
- Curved text in `minimap.js` was rendering right-to-left (e.g. "YKCOR" instead of "ROCKY") due to incorrect arc traversal direction — fixed by iterating θ from `π/2 + totalAngle/2` downward

### Planet Naming
- Habitable (EarthLike) planets now named after their system: single → "Lave Prime", multiple → "Lave I", "Lave II" by orbital order (using `pl.p.idx`)
- `_buildPlanetNames()` pre-computes a Map at scene construction; other planet types still show type from `pl.kind.slice(1)`
- Sun shows Elite system name via `pl.name` instead of "Sun"

### Minimap Navigation Indicators
- **Target lock**: when a planet is aimed at, a yellow dashed line runs from player centre to that planet's dot on the minimap, plus a yellow ring highlight
- **Prograde/retrograde markers**: green open circle (prograde) and orange circle-with-cross (retrograde) drawn at fixed radius around player; both brighten/thicken when heading is within 5° of alignment
- `velAngle` and `shipAngle` now passed to minimap via `setHUD`
- Torus drive state passed as `torus` to minimap; border ring pulses blue when active

### Rendering Order Fix
- Planets were rendering on top of the ship; fixed by attaching planets before player to the viewframe (PIXI draw order)

### Elastic Dead-Zone Camera
- Camera (`cameraPos`) decoupled from player; player roams freely within inner 98% of screen (MARGIN = 0.02)
- At the 2% border, camera elastically follows; `warpFactor` blends the follow rate and zoom based on speed, preventing shake at very high speeds
- At warp speed, camera locks to player instantly

### Torus Drive
- Implicitly engages when: aimed at a planet (`hudTarget.targetPos` non-null), speed ≥ 100 m/s, velocity direction within 15° of target direction, not within drop distance, no enemies nearby
- Hysteresis: disengages below 60 m/s to prevent flickering
- Warp displacement (5000 units/sec) added directly to `player.pos` each frame on top of normal physics
- Constants: `TORUS_WARP_SPEED`, `TORUS_SPEED_SQ`, `TORUS_HOLD_SQ`, `TORUS_DROP_DIST`, `TORUS_ENEMY_DIST`

### Flight Control Tuning
- Velocity-proportional brake added to `moveUp`/`fastUp` in `stardust.js` (0.1% / 0.3% speed reduction per frame) — gentle, not passive drag
- `emergencyBrakes` was considered but rejected (it's a Destrier powerup, not a base feature)

## Files Touched

### Game Scene
- **stardust/scene.js**: Camera dead-zone, torus drive logic, planet naming, target/velocity angle passed to minimap, rendering order fix, zoom-out reverted to original formula

### HUD
- **stardust/minimap.js**: Arc text direction fix, prograde/retrograde markers, target lock line + ring, torus pulse border, `velAngle`/`shipAngle`/`torus` in `_hud`

### Ship
- **stardust/base/bobcat.js**: No persistent changes (emergencyBrakes added then reverted)
- **stardust/base/shipbase.js**: No persistent changes (angle threshold changed then reverted)

### Controls
- **stardust/stardust.js**: Velocity brake on `moveUp`/`fastUp` actions (0.999/0.997 multiplier)
