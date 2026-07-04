# Camera Design

## Intended behaviour

**Dead zone shrinks with speed. Pull strength grows with speed.**

At low speed (below ~50 m/s):
- Inner 80% of the viewport is a dead zone — camera does not move at all.
- Outer 20% is a pull zone: if the ship reaches the border, a smooth elastic pull
  draws the camera toward the ship. The pull uses a smoothstep ramp so there is
  zero discontinuity at the dead zone boundary.
- The ship can push against the border and settle there; releasing thrust lets the
  camera slowly catch up and return the ship toward center.

As speed increases (50 → 100 m/s):
- The dead zone radius shrinks continuously toward zero.
- The maximum pull rate grows from `FOLLOW_LOW` to `FOLLOW_HIGH`.
- In practice the ship becomes more and more centered as speed increases.

At torus speed / torus drive active:
- Camera locks directly to the player position (instant, no lag).

Zoom is entirely separate and speed-driven; it does not affect camera tracking logic.

## Constants

- `CAM_LOW_SPEED  = 50`   — m/s below which dead zone is at full size
- `CAM_HIGH_SPEED = 100`  — m/s at which dead zone has fully collapsed
- `PULL_BASE      = 0.80` — dead zone radius at low speed (fraction of half-viewport)
- `FOLLOW_LOW     = 0.03` — max follow rate at low speed (gentle at border)
- `FOLLOW_HIGH    = 0.25` — max follow rate just before torus (tight tracking)

## What NOT to do

- No base follow rate anywhere. Any nonzero follow in the dead zone causes molasses.
- Do not blend `warpFactor` into the dead-zone follow. Speed affects the dead zone
  *size* and the *maximum pull strength*, not a base tracking rate.
- Do not EMA-smooth the camera delta. The smoothstep already gives a smooth
  transition; extra smoothing causes wind-up/overshoot when re-entering the dead zone.
