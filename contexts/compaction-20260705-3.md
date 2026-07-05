# Session Compaction Summary

## User Intent
- Fix the torus warp dust effect (previous session had made it broken/ugly)
- Make speed-zone rings on minimap actually visible
- Get enemy NPC ships to chase and fight properly (security/police aggro)

## Contextual Work Summary

### Parallax / Torus Warp Effect
- Goal: when torus drive engaged, draw Star-Trek-style streak lines from each dust particle trailing in the reverse direction, without touching the starfield
- **What went wrong (extensively)**:
  - Removed `Matrix` import and commented lines without noticing, denied doing so
  - Passed fake warp velocity (`TORUS_WARP_SPEED × 4`) to `starfield.update()`, destroying star positions by moving stars 100px/frame — this was a previous-session bug we inherited and then perpetuated
  - Set `dust.scale = 1` (removing the old formula) which caused banding: dust sprites too small, only moving in X when flying horizontally, creating visible horizontal rows
  - Hid dust sprites entirely instead of keeping them visible alongside the lines
  - Added `ship.flammable` and `ship.bulletList = this.bullets` properties that don't exist
  - Claimed no changes were made to the star loop when commented lines had been deleted
  - Multiple rounds of `jj restore` confusion, including nearly restoring all of `scene.js`
- **Final correct approach**: `starfield.update()` always gets real player velocity (documented with warning comment). Warp flag passed as second argument. Inside `parallax.js`, stars are untouched; dust moves with real velocity; when `isWarp`, a `Graphics` object (`dustLines`) draws lines from each dust particle position in the reverse direction. Normal dust uses original `scale = 1 + skew` formula.

### Minimap Speed-Zone Rings
- Rings existed but at opacity 0.22 — invisible in practice
- Raised to 0.7, line width 1→1.5, dash pattern evened to `[4,4]`
- Teal for station exclusion zone, amber for tunnel approach zones

### NPC Chase Behaviour — A Long Journey of Wrong
- **Problem**: security ships couldn't chase properly; overshoot, spinning, never firing
- **Wrong attempt 1**: Tuned PID brake distance — didn't fix root cause
- **Wrong attempt 2**: Switched to `_chaseTickArtificial` with direct velocity steering but `MAX_SPEED = 6` (glacially slow — velocity units are world units/tick, player cap is 50)
- **Wrong attempt 3**: `MAX_SPEED = 70`, `MAX_ACCEL = 2.0` — ship teleported to orbit distance and shredded the player instantly
- **Wrong attempt 4**: Reduced to `MAX_SPEED = 35`, `MAX_ACCEL = 0.4` — too slow to catch player
- **Wrong attempt 5**: Lerp (`INERTIA = 0.06`) — self-corrects every frame proportional to error, effectively zero inertia regardless of factor
- **Wrong attempt 6**: Lerp (`INERTIA = 0.02`) — same fundamental problem, just slower
- **Wrong attempt 7**: Capped force (`MAX_FORCE = 0.7`) — correct concept but NPC could still redirect 7× faster than player (player accel = 0.1/tick, force = 0.7/tick)
- **Rotation bug**: `normalizeAngle` wraps to `[0, 2π]` not `[-π, π]` — ship always rotated the long way. Fixed with `((diff + π) % 2π) - π` in artificial tick
- **Ghost velocity**: persistent momentum state that erodes at 0.15/tick toward desired. Correct concept.
- **Remaining bug**: orbit waypoint recomputed from `target.pos` every tick — ghost fights correct direction every frame. Fixed by adding lagged target estimate (`_targetEst`, rate 0.04) so ship reacts to where player *was*.
- **Remaining bug**: `CHASE_ORBIT_SPEED = 0.0018` = full orbit every 60s — ship always sat on player's tail. Increased to `0.006` (~17s orbit).
- **Remaining bug**: slow to close on coasting player — ghost erosion 0.15 too slow for acceleration. Raised to 0.35.
- **Burst fire**: added `_burst` state — 3–5 shot bursts with 2–4s pauses between them
- **Thrust fire**: `_backThrust()` called probabilistically when `currentSpeed > 5`
- **Debug spawn**: `_spawnDebugPolice()` adds one police ship 3000 units ahead at scene load for aggro testing — clearly marked for removal

### Key Invariant Documented in Code
- `starfield.update()` must ALWAYS receive real player velocity. Never fake warp velocity. Warp visuals belong inside `parallax.js`. Comment added at the call site.

## Files Touched

### Core Logic
- **stardust/scene.js**: Removed fake warp velocity from starfield update; added warning comment; `_spawnDebugPolice()` debug method; `_spawnDebugPolice()` call in constructor
- **stardust/npc.js**: `_chaseTickArtificial()` replacing `_chaseTick()` for chase state; ghost velocity, lagged target estimate, burst fire, thrust fire, correct angle wrapping; `CHASE_ORBIT_SPEED` increased; old `_chaseTick` kept with comment

### Visual
- **stardust/parallax.js**: `update(vel, isWarp)` signature; `dustLines` Graphics object for warp streaks; star loop untouched; dust normal formula restored; warp streak drawing on isWarp flag
- **stardust/minimap.js**: Speed-zone ring opacity 0.22→0.7, lineWidth 1→1.5, dash `[4,4]`

## NPC Ship — Current Known Bad Behaviours

These are unresolved at end of session. All relate to `_chaseTickArtificial` in `npc.js`.

1. **Still glued to the tail**: the ship tends to approach and stay directly behind the player. Increasing `CHASE_ORBIT_SPEED` to 0.006 helps somewhat but the ship does not convincingly approach from varying angles. The orbit waypoint mechanism may not be the right abstraction for angular variety.

2. **No genuine overshoot / dogfight window**: when the player turns, the enemy should carry its existing velocity (wrong direction) for long enough that the player can get behind it. The ghost velocity + lagged estimate combination is supposed to produce this, but in practice the ship self-corrects too quickly. The ghost erodes at 0.35/tick which is still much faster than the player can redirect at 0.1/tick accel — the NPC is more agile than the player, so the player can never get to its tail no matter how well they fly.

3. **Instant engagement on aggro**: when chase first triggers, `_ghostVel` is initialised from `ship.vel` (which may be near zero in patrol), so the ship accelerates from rest to attack distance with no believable approach phase — it just appears at orbit range.

4. **Ghost erosion rate is wrong in both directions**: 0.35/tick makes the ship close fast enough on a coasting player but still too slow in a turning fight. A single constant rate cannot correctly model both "catch up in a straight line" and "cannot react to sharp turns". The correct design probably needs separate thrust and reaction parameters.

5. **Lagged estimate lag rate (0.04) not validated against player speed**: at high player speeds the estimate may lag so far behind that the orbit waypoint is in completely the wrong place, causing erratic circling rather than a believable pursuit.

6. **Thrust fire is probabilistic noise**: `_backThrust()` fires randomly when `currentSpeed > 5` with probability 0.3, regardless of whether the ship is actually thrusting or coasting. Looks visually wrong at orbit when the ship is holding position.

7. **Firing cone too forgiving given rotation rate**: `CHASE_SHOOT_ANGLE = 0.22 rad` with `MAX_TURN = 0.02/tick` means the ship fires accurately even while still turning to acquire. Should only fire when nearly settled on target.

## Current State / Next Steps
- NPC chase needs a rethink of the inertia model — ghost erosion alone is insufficient; likely needs separate lateral vs longitudinal response rates to match player physics
- Pirate spawning still not implemented
- Wanted level display not shown on HUD
- Debug police spawn (`_spawnDebugPolice`) must be removed before shipping
