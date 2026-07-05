# Session Compaction Summary

## User Intent
- Add hit registration so security ships respond to player attacks on NPCs
- Fix multiple gameplay bugs: dead ship visuals, debris persistence, chase AI oscillation, zoom near ships
- Make security AI not trivially aggressive or trivially useless

## Contextual Work Summary

### Hit Registration & Security Alert
- Player bullets now stamp `lastAttacker`/`lastHitTime` on any ship they hit
- `_alertNearbySecurityFor(victim)` called on any player bullet hit — alerts security ships within **30k of the victim** (not the player; was 100k of player, causing all-system-wide hostility)
- `wantedLevel` (0–5) increments on player kills
- Security ships set `npcRole = 'security'` on spawn so alert can filter them

### Chase AI: Orbit-and-Strafe
- Replaced oscillating PID chase with orbit-and-strafe: security ship chases a waypoint revolving around the player at `CHASE_ATTACK_RANGE` (1400 units)
- Waypoint initialised to ship's current bearing from player, advances at `CHASE_ORBIT_SPEED = 0.0018 rad/tick`
- Ship fires at the actual player (not the waypoint) when nose sweeps through `CHASE_SHOOT_ANGLE` (0.22 rad)
- Thrust convention confirmed: `backThrust()` = accelerate forward, `forwardThrust()` = brake/reverse (matches `_patrolTick`)
- Abandon chase if target dead or beyond 200k units; reset `npcState` to `'patrol'`

### Patrol Thrust Convention Fix
- `_patrolTick` had `backThrust`/`forwardThrust` swapped (introduced this session, then reverted)
- Final state: original convention restored — `backThrust` for acceleration, `forwardThrust` for braking
- User confirmed patrol ships now move under visible control

### Dead Ship Visual / Debris Fixes
- Dead ships were not removed from PIXI scene on death — added `p?.parent?.removeChild(p)` in the `ship.e < 0` cleanup branch
- `debris.js`: removed `Math.max(1, this.e)` floor that prevented `kShipDebris` from ever being destroyed; debris now fades and clears in ~16s

### Zoom Improvements
- Added ship proximity zoom: lerps `scale` toward `MAXSCALE` when within **12k world units** of any ship, counteracting planet/station zoom-out
- Gives a full viewport when approaching or fighting near a body

### Security Aggression Scoping
- `_alertNearbySecurityFor` previously measured proximity to **player** — attacking anyone in the inner system alerted all police
- Fixed to measure proximity to **victim** with reduced range (30k) — police only respond if they're near the incident

## Files Touched

### Core Game Logic
- **stardust/scene.js**: `wantedLevel` init; `npcRole = 'security'` on spawn; `lastAttacker`/`lastHitTime` on bullet hit; `_alertNearbySecurityFor()` method (victim-relative, 30k range); dead ship presentation cleanup; ship proximity zoom (12k); `npcControl` receives player arg
- **stardust/npc.js**: `_chaseTick()` — orbit-and-strafe implementation; `npcControl` wired to call it; patrol thrust convention confirmed correct (reverted swap)
- **stardust/base/debris.js**: Removed `kShipDebris` energy floor so ship debris actually disappears

## Current State / Next Steps

### What's Playable Now
- Fly, shoot, scoop wrecks; attack traders and trigger police response
- Security ships patrol station, chase and shoot player on aggression, orbit rather than oscillate
- Ship deaths produce visible debris that fades; no ghost ships left on screen

### Immediate
- **Commerce screen**: `playerBuy`/`playerSell` in `tinker/trade.js`; wire `player.credits`, `player.cargo` — scooped credits need somewhere to go
- **Pirate spawning**: `shipDistribution[PIRATE]` exists but nothing spawns; would create unprovoked combat and complete the basic loop
- **Wanted level display**: red dots near minimap; wantedLevel decay over time

### Medium Term
- Independent hardpoint fire (separate bindings for `weapons[0]`/`weapons[1]`)
- Asteroid fields for mining (reuse `destrier/src/asteroid.js`); noted as future feature
- Ship purchase at military/high-tech stations
