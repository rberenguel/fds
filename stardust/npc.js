export { NPC_PRESETS, initNpcPIDs, npcControl, traderControl };

import { PIDController } from './pid.js';
import { normalizeAngle } from './math.js';

// PID gains per behavior mode.  All use dt = deltaTime/1000 (same convention as pid.js).
// Patrol is deliberately calm — ships look purposeful, not frantic.
// Chase is toned down from Destrier to reduce overshoot in open space.
// Raid is aggressive but still physically believable.
const NPC_PRESETS = {
  trader: {
    yaw:    { Kp: 0.03,  Ki: 0.001,  Kd: 0.004   },
    thrust: { Kp: 0.025, Ki: 0.0003, Kd: 0.00003 },
    pos:    { Kp: 0.008, Ki: 0,       Kd: 0       },
  },
  patrol: {
    yaw:    { Kp: 0.04,  Ki: 0.002,  Kd: 0.005   },
    thrust: { Kp: 0.03,  Ki: 0.0005, Kd: 0.00005  },
    pos:    { Kp: 0.012, Ki: 0,       Kd: 0        },
  },
  chase: {
    yaw:    { Kp: 0.08,  Ki: 0.006,  Kd: 0.008   },
    thrust: { Kp: 0.05,  Ki: 0.001,  Kd: 0.0001  },
    pos:    { Kp: 0.018, Ki: 0,       Kd: 0       },
  },
  raid: {
    yaw:    { Kp: 0.12,  Ki: 0.010,  Kd: 0.012   },
    thrust: { Kp: 0.07,  Ki: 0.001,  Kd: 0.0002  },
    pos:    { Kp: 0.025, Ki: 0,       Kd: 0       },
  },
};

function initNpcPIDs(ship, preset) {
  const p = NPC_PRESETS[preset];
  ship.yawPID    = new PIDController(p.yaw.Kp,    p.yaw.Ki,    p.yaw.Kd);
  ship.thrustPID = new PIDController(p.thrust.Kp, p.thrust.Ki, p.thrust.Kd);
  ship.posPID    = new PIDController(p.pos.Kp,    p.pos.Ki,    p.pos.Kd);
  ship._npcPreset = preset;
}

// Main NPC control tick.  deltaTime is the raw PIXI delta.deltaTime (~1.0 at 60fps).
// Ship must have: npcState ('patrol'|'chase'|'raid'), homePos, patrolRadius, orbitAngle, orbitSpeed.
// player is passed so chase mode can fall back to patrol when needed.
const npcControl = (ship, deltaTime, player) => {
  if (!ship.npcState) return;

  const preset = ship.npcState === 'patrol' ? 'patrol'
               : ship.npcState === 'chase'   ? 'chase'
               : 'raid';

  if (!ship.yawPID || ship._npcPreset !== preset) initNpcPIDs(ship, preset);

  if (ship.npcState === 'patrol') _patrolTick(ship, deltaTime);
  else if (ship.npcState === 'chase') _chaseTickArtificial(ship, deltaTime);
};

// Fly toward ship.traderDest, decelerate on approach, set ship.traderArrived when close.
// ship.traderArrivalRange: distance threshold to count as "arrived".
function traderControl(ship, deltaTime) {
  if (!ship.traderDest) return;

  if (!ship.yawPID || ship._npcPreset !== 'trader') initNpcPIDs(ship, 'trader');
  const dt = deltaTime / 1000;

  const dx   = ship.traderDest.x - ship.pos.x;
  const dy   = ship.traderDest.y - ship.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  const arrivalRange = ship.traderArrivalRange ?? 8000;

  if (dist < arrivalRange) {
    ship.traderArrived = true;
    return;
  }

  // Yaw toward destination
  const desiredAngle = Math.atan2(dy, dx);
  const angleDiff    = normalizeAngle(desiredAngle - ship.r);
  const yawOut       = ship.yawPID.update(0, angleDiff, dt);
  if      (yawOut >  0.015) ship.yawRight();
  else if (yawOut < -0.015) ship.yawLeft();

  // Thrust: full ahead when well-aligned and far; coast+brake when close
  const brakeDist = arrivalRange * 5;
  const speed     = Math.sqrt(ship.vel.x ** 2 + ship.vel.y ** 2);
  const aligned   = Math.abs(angleDiff) < Math.PI / 3;

  if (dist > brakeDist) {
    if (aligned) ship.backThrust();
  } else {
    // Decelerate — forward-thrust (brake) if still moving toward target
    const fwd = ship.vel.x * Math.cos(ship.r) + ship.vel.y * Math.sin(ship.r);
    if (speed > 8 && fwd > 0) ship.forwardThrust();
  }
}

const CHASE_ATTACK_RANGE  = 800;     // world units — desired engagement distance
const CHASE_SHOOT_ANGLE   = 0.22;   // radians — firing cone half-angle
const CHASE_ABANDON_RANGE = 200_000; // give up if target escapes this far
const CHASE_ORBIT_SPEED   = 0.006;  // rad/tick — orbit waypoint rotation speed (~17s full orbit)
const CHASE_MAX_SPEED     = 95;     // world units/tick — default NPC chase speed (player torus threshold ~100.5)
const CHASE_SLOW_RADIUS   = CHASE_ATTACK_RANGE * 2.5;
// Forward accel (along current motion): fast, readable as "engine thrust".
// Lateral accel (perpendicular): slow, so sharp player turns create an exploitable window.
// Player accel is 0.1/tick heading-locked; lateral 0.08 ≈ equivalent after yaw cost.
// A 90° redirect at full speed takes ~(65/0.08) ≈ 812 ticks ≈ 13 s.
const CHASE_FWD_RATE = 0.22;   // main engine: aggressive straight-line pursuit
const CHASE_LAT_RATE = 0.08;   // lateral: slow, player can outmaneuver with turns

// Movement uses a ghost-velocity model split into forward and lateral components.
// Forward is fast (shows thrust, closes on straight-running player);
// lateral is slow (player can exploit with sharp turns).
// Rotation (for shooting) is fully decoupled from movement.
function _chaseTickArtificial(ship, deltaTime) {
  const target = ship.chaseTarget;
  if (!target || target.e < 0) { ship.npcState = 'patrol'; return; }

  const dx = target.pos.x - ship.pos.x;
  const dy = target.pos.y - ship.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > CHASE_ABANDON_RANGE) { ship.npcState = 'patrol'; return; }

  // Lagged position estimate — the enemy reacts to where the player WAS.
  // When the player turns sharply the estimate keeps pointing at the old trajectory,
  // causing the enemy to carry momentum in the wrong direction for a moment.
  if (!ship._targetEst) ship._targetEst = { x: target.pos.x, y: target.pos.y };
  ship._targetEst.x += (target.pos.x - ship._targetEst.x) * 0.05;
  ship._targetEst.y += (target.pos.y - ship._targetEst.y) * 0.05;

  // Orbit waypoint revolves slowly so the approach angle varies.
  if (ship._chaseOrbitAngle === undefined)
    ship._chaseOrbitAngle = Math.atan2(ship.pos.y - ship._targetEst.y, ship.pos.x - ship._targetEst.x);
  ship._chaseOrbitAngle += CHASE_ORBIT_SPEED * deltaTime;

  const wpx = ship._targetEst.x + Math.cos(ship._chaseOrbitAngle) * CHASE_ATTACK_RANGE;
  const wpy = ship._targetEst.y + Math.sin(ship._chaseOrbitAngle) * CHASE_ATTACK_RANGE;
  const wdx = wpx - ship.pos.x;
  const wdy = wpy - ship.pos.y;
  const wdist = Math.sqrt(wdx * wdx + wdy * wdy);

  // Arrive steering for a MOVING waypoint: base velocity = player velocity (keeps pace),
  // plus a correction toward the waypoint scaled by arrive factor.
  // Without the base, desiredSpeed collapses to 0 at the waypoint while it keeps running.
  const maxSpeed = ship.chaseMaxSpeed ?? CHASE_MAX_SPEED;
  const corrFactor = Math.min(wdist / CHASE_SLOW_RADIUS, 1);
  const corrVx = wdist > 0 ? (wdx / wdist) * maxSpeed * corrFactor : 0;
  const corrVy = wdist > 0 ? (wdy / wdist) * maxSpeed * corrFactor : 0;
  let desiredVx = target.vel.x + corrVx;
  let desiredVy = target.vel.y + corrVy;
  const desiredLen = Math.sqrt(desiredVx * desiredVx + desiredVy * desiredVy);
  if (desiredLen > maxSpeed) { desiredVx = desiredVx / desiredLen * maxSpeed; desiredVy = desiredVy / desiredLen * maxSpeed; }
  const desiredSpeed = Math.sqrt(desiredVx * desiredVx + desiredVy * desiredVy);

  // Ghost velocity: split into forward (along current motion) and lateral (perpendicular).
  // Forward uses a high rate — aggressive pursuit, readable as engine thrust.
  // Lateral uses a low rate — the player can exploit turns because the enemy
  // carries wrong-direction momentum for many seconds before it can correct.
  if (!ship._ghostVel) ship._ghostVel = { x: ship.vel.x, y: ship.vel.y };
  const gx = desiredVx - ship._ghostVel.x;
  const gy = desiredVy - ship._ghostVel.y;
  const currentSpeed = Math.sqrt(ship._ghostVel.x ** 2 + ship._ghostVel.y ** 2);
  const fwdRate = ship.chaseFwdRate ?? CHASE_FWD_RATE;
  let dvFwd = 0;
  if (currentSpeed > 0.5) {
    // Project deltaV onto forward (current motion) and lateral axes.
    const fwdX = ship._ghostVel.x / currentSpeed;
    const fwdY = ship._ghostVel.y / currentSpeed;
    dvFwd = gx * fwdX + gy * fwdY;
    const dvLat = gx * (-fwdY) + gy * fwdX;
    const stepFwd = Math.max(-fwdRate, Math.min(fwdRate, dvFwd)) * deltaTime;
    const stepLat = Math.max(-CHASE_LAT_RATE, Math.min(CHASE_LAT_RATE, dvLat)) * deltaTime;
    ship._ghostVel.x += fwdX * stepFwd + (-fwdY) * stepLat;
    ship._ghostVel.y += fwdY * stepFwd + fwdX    * stepLat;
  } else {
    // From near-rest, accelerate freely in any direction.
    const gLen = Math.sqrt(gx * gx + gy * gy);
    if (gLen > 0) {
      const step = Math.min(gLen, fwdRate * deltaTime) / gLen;
      ship._ghostVel.x += gx * step;
      ship._ghostVel.y += gy * step;
      dvFwd = gLen; // treat as forward accel for thrust visual
    }
  }
  ship.vel.x = ship._ghostVel.x;
  ship.vel.y = ship._ghostVel.y;

  // Show thrust whenever the ship is trying to go somewhere (desiredSpeed high)
  // OR is actively accelerating forward.  At cruise the delta is ~0 but the engine
  // is still "on" — without this the ship looks like it's floating for free.
  if (desiredSpeed > 8 || dvFwd > 1) {
    const moveAngle = Math.atan2(ship._ghostVel.y, ship._ghostVel.x);
    const savedR = ship.r;
    ship.r = moveAngle;
    ship._backThrust?.();
    ship.r = savedR;
  }

  // Lead aim using the primary weapon's projectile speed for time-of-flight.
  // Accuracy (0–1) blends from "point at target" to "perfect lead" — set per ship type.
  // Even at low accuracy the ship still aims roughly at the target and fires in the cone,
  // so it can hit if the player flies straight through it.
  const projectileSpeed = ship.weapons?.[0]?.stats?.ACCEL ?? 50;
  const tof    = dist / projectileSpeed;
  const relVx  = (target.vel.x - ship.vel.x) * tof;
  const relVy  = (target.vel.y - ship.vel.y) * tof;
  const accuracy = ship.npcAccuracy ?? 1.0;
  const leadX  = target.pos.x - ship.pos.x + relVx * accuracy;
  const leadY  = target.pos.y - ship.pos.y + relVy * accuracy;

  // Rotate toward lead point at a limited rate (independent of movement).
  const targetAngle = Math.atan2(leadY, leadX);
  let angleDiff = targetAngle - ship.r;
  angleDiff = ((angleDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
  const MAX_TURN = ship.yawRate * deltaTime;
  ship.r += Math.max(-MAX_TURN, Math.min(MAX_TURN, angleDiff));

  let aimDiff = targetAngle - ship.r;
  aimDiff = ((aimDiff + Math.PI) % (2 * Math.PI)) - Math.PI;
  const inCone  = Math.abs(aimDiff) < CHASE_SHOOT_ANGLE;
  const inRange = dist < CHASE_ATTACK_RANGE * 2.5;
  const now = performance.now();

  // Burst fire for primary weapons (mass driver etc.) — short bursts with pauses.
  if (!ship._burst) ship._burst = { shotsLeft: 0, nextBurstAt: 0 };
  if (ship._burst.shotsLeft === 0 && now > ship._burst.nextBurstAt) {
    ship._burst.shotsLeft  = 3 + Math.floor(Math.random() * 3);
    ship._burst.nextBurstAt = now + 2000 + Math.random() * 2000;
  }
  if (ship._burst.shotsLeft > 0 && inCone && inRange) {
    for (const weapon of (ship.weapons ?? [])) {
      if (!weapon) continue;
      const elapsed = now - (ship[`_prevshot_${weapon.kind}`] ?? 0);
      if (elapsed < (weapon.firerate ?? 200)) continue;
      if (weapon.ammo && (ship.ammo?.[weapon.kind]?.count ?? 0) < 1) continue;
      weapon.fire(ship, ship.bulletList);
      ship[`_prevshot_${weapon.kind}`] = now;
      ship._burst.shotsLeft--;
    }
  }

  // Secondary weapons: fire when aimed, rate governed by weapon.firerate.
  if (inCone) {
    for (const weapon of (ship.secondaryWeapons ?? [])) {
      if (!weapon) continue;
      const elapsed = now - (ship[`_prevshot_${weapon.kind}`] ?? 0);
      if (elapsed < (weapon.firerate ?? 1000)) continue;
      if (weapon.ammo && (ship.ammo?.[weapon.kind]?.count ?? 0) < 1) continue;
      weapon.fire(ship, ship.bulletList);
      ship[`_prevshot_${weapon.kind}`] = now;
    }
  }
}

// Old physics-based chase — kept for reference. Uses player thrust/brake/yaw methods
// which caused persistent overshoot that artificial movement above fixes.
function _chaseTick(ship, deltaTime) {
  const target = ship.chaseTarget;
  if (!target || target.e < 0) {
    ship.npcState = 'patrol';
    return;
  }

  const dt = deltaTime / 1000;
  const dx = target.pos.x - ship.pos.x;
  const dy = target.pos.y - ship.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > CHASE_ABANDON_RANGE) {
    ship.npcState = 'patrol';
    return;
  }

  // Initialise orbit angle to the ship's current bearing from the target,
  // then advance each tick.
  if (ship._chaseOrbitAngle === undefined) {
    ship._chaseOrbitAngle = Math.atan2(ship.pos.y - target.pos.y, ship.pos.x - target.pos.x);
  }
  ship._chaseOrbitAngle += CHASE_ORBIT_SPEED * deltaTime;

  // Orbit waypoint: always ATTACK_RANGE away from target, revolving slowly.
  const wpx = target.pos.x + Math.cos(ship._chaseOrbitAngle) * CHASE_ATTACK_RANGE;
  const wpy = target.pos.y + Math.sin(ship._chaseOrbitAngle) * CHASE_ATTACK_RANGE;

  const wdx   = wpx - ship.pos.x;
  const wdy   = wpy - ship.pos.y;
  const wdist = Math.sqrt(wdx * wdx + wdy * wdy);

  // Yaw toward orbit waypoint
  const desiredAngle = Math.atan2(wdy, wdx);
  const angleDiff    = normalizeAngle(desiredAngle - ship.r);
  const yawOut       = ship.yawPID.update(0, angleDiff, dt);
  if      (yawOut >  0.01) ship.yawRight();
  else if (yawOut < -0.01) ship.yawLeft();

  // Thrust — approach speed scales with distance so ships don't overshoot the waypoint.
  //   backThrust() = accelerate in heading direction, forwardThrust() = brake/reverse
  const aligned = Math.abs(angleDiff) < Math.PI / 3;
  const radialVel = wdist > 0
    ? (ship.vel.x * wdx + ship.vel.y * wdy) / wdist  // positive = closing
    : 0;
  const desiredApproach = Math.min(wdist * 0.08, 120); // slow down as we get close
  if (radialVel > desiredApproach && aligned) {
    ship.forwardThrust(); // brake
  } else if (wdist > 300 && aligned) {
    ship.backThrust();    // accelerate
  }

  // Fire at target (not waypoint) when the nose sweeps through the firing cone
  const aimDiff = normalizeAngle(Math.atan2(dy, dx) - ship.r);
  if (Math.abs(aimDiff) < CHASE_SHOOT_ANGLE && dist < CHASE_ATTACK_RANGE * 2.5) {
    const now = performance.now();
    for (const weapon of (ship.weapons ?? [])) {
      if (!weapon) continue;
      const elapsed = now - (ship[`_prevshot_${weapon.kind}`] ?? 0);
      if (elapsed < (weapon.firerate ?? 200)) continue;
      weapon.fire(ship, ship.bulletList);
      ship[`_prevshot_${weapon.kind}`] = now;
    }
  }
}

function _patrolTick(ship, deltaTime) {
  const dt = deltaTime / 1000; // matches pid.js convention

  // Advance orbit waypoint
  ship.orbitAngle = (ship.orbitAngle ?? 0) + (ship.orbitSpeed ?? 0.0003) * deltaTime;

  const wx = ship.homePos.x + Math.cos(ship.orbitAngle) * ship.patrolRadius;
  const wy = ship.homePos.y + Math.sin(ship.orbitAngle) * ship.patrolRadius;

  const dx = wx - ship.pos.x;
  const dy = wy - ship.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 20) return;

  // --- Yaw toward waypoint ---
  const desiredAngle = Math.atan2(dy, dx);
  const angleDiff = normalizeAngle(desiredAngle - ship.r);
  const yawOut = ship.yawPID.update(0, angleDiff, dt);
  if      (yawOut >  0.01) ship.yawRight();
  else if (yawOut < -0.01) ship.yawLeft();

  // --- Thrust: maintain at least orbital tangential speed ---
  // orbitalSpeed is the linear speed needed to follow the waypoint on the circle.
  const orbitalSpeed = (ship.orbitSpeed ?? 0.0003) * ship.patrolRadius * deltaTime;
  const gapSpeed     = ship.posPID.update(dist, 0, dt);
  const desiredSpeed = Math.max(orbitalSpeed, gapSpeed);

  const fwdX = Math.cos(ship.r);
  const fwdY = Math.sin(ship.r);
  const currentFwd = ship.vel.x * fwdX + ship.vel.y * fwdY;

  const thrust = ship.thrustPID.update(desiredSpeed, currentFwd, dt);
  if      (thrust >  0.01) ship.backThrust();
  else if (thrust < -0.01) ship.forwardThrust();
}
