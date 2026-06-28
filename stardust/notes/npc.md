# NPC / Enemy Ship Design

## Trading Post (Station)

**Location**: Orbiting the main EarthLike planet at a fixed radius. Natural torus-drive
destination; the player has a concrete goal to fly toward.

**Shape**: Coriolis-style rotating box/ring — a few PIXI polygons, docking slot on one
face. Iconic, readable, gives gameplay surface (docking orientation matters visually).

**Handling — 3 layers**:
1. **No-fire zone** (~500 units radius): firing inside triggers security response
2. **2–3 security ships** patrolling circular paths around the station; attack anyone
   with a bounty or who fires nearby
3. **Docking**: fly into the opening → scene detects proximity + facing → fade to
   trade screen overlay

---

## Enemy / NPC AI

### The Destrier problem

Destrier's `otherControl` (pid.js) is a PID-based chase-and-shoot loop. It works for
Destrier because that game's erratic, overshooting behaviour reads as "aggressive alien
fighter." In Stardust — larger space, slower pacing, Elite-flavoured — the same
behaviour will feel like a bug. The control system needs to be calmer and more purposeful.

### Design: 4-state FSM, role-parameterised

Every NPC ship runs the same state machine; roles differ only in thresholds and patrol
anchors.

```
PATROL → ALERT → ATTACK → FLEE
```

- **PATROL**: PID chases a moving waypoint (circle around homePos — station, planet,
  belt). Ship ignores the player unless an aggression trigger fires.
- **ALERT**: 0.5–1 s transition — ship faces the threat and "decides." Prevents the
  snap-to-attack feel. Can return to PATROL if threat disappears.
- **ATTACK**: PID chase + lead-target shooting, similar to Destrier but tuned for
  calmer tracking. Lower Kp/Kd to reduce overshoot. Ships should feel like they mean
  business, not like they are drunk.
- **FLEE**: thrust away from threat, stop shooting, stop turning to face. Triggered by
  hull% threshold.

### Role parameters

| Role     | Patrol anchor       | Aggression trigger              | Flee threshold |
|----------|---------------------|---------------------------------|----------------|
| Security | Station radius      | Bounty present / shot fired nearby | Never       |
| Pirate   | Asteroid belt / deep space | Player nearby + slow enough | 20% hull   |
| Trader   | Trade route waypoints | Never attacks                 | 60% hull (immediate) |
| Police   | Near planet         | Pirate spotted / player bounty  | 10% hull       |

### Key differences from Destrier's otherControl

- Drop the wrap-around distance math (stardust is unbounded, not a toroidal arena)
- Add `homePos` so patrol ships don't drift to infinity
- Lower PID gains to avoid overshoot and oscillation — smooth is more believable
- Separate the "chase" target from the "shoot" target (a ship can orbit a planet while
  scanning for threats)
- State transitions are explicit; no implicit behaviour from a single monolithic function

### Implementation order

1. PATROL + homePos waypoint following (proves calm PID tuning)
2. ATTACK state with Destrier-derived logic, retuned
3. Security ships around station (tests PATROL → ATTACK transition)
4. FLEE state
5. Trader and Pirate roles
