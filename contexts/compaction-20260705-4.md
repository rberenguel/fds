# Session Compaction Summary

## User Intent
- Fix NPC chase AI so player momentum can actually be exploited (enemy was more agile than player)
- Add photon torpedoes to NPC police ships and make combat threatening
- Give player lasers + photon launcher for testing
- Bind secondary fire (Enter) correctly, matching Destrier's pattern

## Contextual Work Summary

### NPC Chase AI — Ghost Velocity Rework
- Previous model wrote `ship.vel` directly at 0.35/tick — 3.5× more agile than player (0.1/tick)
- Tried switching to player thrust model (`backThrust`/`forwardThrust`) — produced silly ministry-of-silly-walks overshoot
- Reverted to ghost velocity but with split-axis rates: `CHASE_FWD_RATE = 0.22` (forward) and `CHASE_LAT_RATE = 0.08` (lateral)
- Forward: fast pursuit in a straight line, shows thrust. Lateral: 90° redirect takes ~13 seconds — player can exploit sharp turns
- Arrive steering fixed: orbit waypoint was stationary by assumption; at high player speeds NPC was decelerating to zero while waypoint ran away. Fixed by adding `playerSpeed` as base to `desiredSpeed`

### NPC Speed Tiers
- Police: `chaseMaxSpeed = 105`, `chaseFwdRate = 0.7` (0→105 in ~2.5s)
- Military: `chaseMaxSpeed = 110`, `chaseFwdRate = 1.0` (0→110 in ~1.8s)
- Pirates/generic: `CHASE_MAX_SPEED = 95` default, `CHASE_FWD_RATE = 0.22` (scrappy, not disciplined)
- Player torus threshold is 100.5 — police/military can always run you down without torus

### NPC Weapons — Photon Torpedo
- Photon torpedo is a `secondaryWeapon`, not primary — must go in `ship.secondaryWeapons` with its own `_initAmmo` call
- NPC fire loop: primary weapons burst-gated as before; secondary weapons loop with `elapsed < weapon.firerate` guard (the only rate check — `fire()` itself has none)
- Ammo check: skip fire if `weapon.ammo !== undefined && weapon.ammo.count < 1` (float ammo, matches shipbase line 699)
- Torpedo `firerate` set to 6000ms at spawn (not class-level) so NPC doesn't burn 20 ammo in 20s
- Torpedo velocity fixed: was `0.1 * shooter.vel` (torpedo slower than both ships at high speed). Fixed to full `shooter.vel` inheritance — torpedo at 155 closes on player at 100.5

### NPC Aiming — Lead Targeting
- Was aiming at player's current position — misses any fast mover
- Fixed: first-order intercept using `weapon.stats.ACCEL` for time-of-flight; uses **relative** velocity (`target.vel - ship.vel`), not absolute — critical when both ships are doing 100+ in the same direction
- `npcAccuracy` factor (0–1) blends lead correction: military = 1.0, police = 0.95, traders = random 0.1–0.5, pirates = random 0.3–0.8 (locked at spawn per ship instance)
- Fire cone and rotation still use lead point

### Torpedo Trail Visual
- Trail particles were spawning at current position with `0.2 * vel` — separated from torpedo by 122 units/tick at warp speed
- Fixed: spawn one frame behind torpedo at full torpedo velocity

### Player Debug Setup (stardust.js)
- Lasers on both gun mounts, photon torpedo launcher as `secondaryWeapons[0]` with 5 ammo
- Set on player instance after `new Bobcat()`, before `generate()` — Bobcat class untouched

### Secondary Fire Binding (incomplete at session end)
- Destrier codebase at `../destrier` (session lost time reading wrong codebase `../roids2`)
- Destrier pattern: gate on `player.secondaryPrevshot + weapon.firerate` in the action handler; rate check is on the player not inside `fire()`
- The session ended before verifying the binding was correctly ported

## Files Touched

### Core Logic
- **stardust/npc.js**: `_chaseTickArtificial` — split-axis ghost velocity, arrive steering fix, lead aiming with accuracy factor, primary burst fire, secondary weapon loop with firerate + ammo checks, torpedo cadence. `_spawnPolice`/`_spawnMilitary`: `chaseMaxSpeed`, `chaseFwdRate`, `npcAccuracy`, photon in `secondaryWeapons`. `_spawnDebugPolice`: same, accuracy 1.0 for testing.
- **stardust/stardust.js**: Player weapon override post-Bobcat construction (lasers + photon launcher). Secondary fire action with `secondaryPrevshot` gating. Enter + gamepad b2 binding.

### Visual
- **stardust/weapons/photonTorpedoLauncher.js**: Torpedo velocity full inheritance. Trail particle spawn one frame behind at full velocity.

## Key Invariants / Notes for Next Session
- Destrier comparison path: `../destrier` — NOT `../roids2`
- `fire()` on all weapons has NO internal rate check — callers must check `elapsed < weapon.firerate`
- `weapon.ammo.count` is a float (regenerates); fire gate is `< 1` not `=== 0`
- `secondaryWeapons` require separate `_initAmmo` call
- Debug police spawn (`_spawnDebugPolice` call in scene constructor) must be removed before shipping
- `npcAccuracy` for pirates not yet set (pirate spawn not yet implemented)

## Current State / Next Steps
- Secondary fire Enter binding may need re-check against Destrier pattern
- Pirate spawning still not implemented (accuracy constant ready: 0.3–0.8)
- Wanted level HUD display still missing
- Debug police spawn must be removed before shipping
