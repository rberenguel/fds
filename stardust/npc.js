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
  else if (ship.npcState === 'chase') _chaseTick(ship, deltaTime);
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
    if (aligned) ship.forwardThrust();
  } else {
    // Decelerate — back-thrust if still moving toward target
    const fwd = ship.vel.x * Math.cos(ship.r) + ship.vel.y * Math.sin(ship.r);
    if (speed > 8 && fwd > 0) ship.backThrust();
  }
}

const CHASE_ATTACK_RANGE  = 1400; // world units — desired engagement distance
const CHASE_SHOOT_ANGLE   = 0.22; // radians — firing cone half-angle
const CHASE_ABANDON_RANGE = 200_000; // give up if target escapes this far
const CHASE_ORBIT_SPEED   = 0.0018; // rad/tick — orbit waypoint rotation speed

// Orbit-and-strafe: the ship chases a waypoint that orbits the player at ATTACK_RANGE.
// This is inherently stable — the waypoint never stops, so there's no position to
// oscillate around.  Thrust convention matches _patrolTick (confirmed working):
//   backThrust() = accelerate in heading direction, forwardThrust() = brake/reverse.
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

  // Thrust — same convention as _patrolTick (confirmed working):
  //   backThrust() = accelerate in heading direction, forwardThrust() = brake/reverse
  const BRAKE_DIST = CHASE_ATTACK_RANGE * 3;
  const speed      = Math.sqrt(ship.vel.x ** 2 + ship.vel.y ** 2);
  const aligned    = Math.abs(angleDiff) < Math.PI / 3;
  if (wdist > BRAKE_DIST) {
    if (aligned) ship.backThrust();
  } else {
    const fwd = ship.vel.x * Math.cos(ship.r) + ship.vel.y * Math.sin(ship.r);
    if (speed > 8 && fwd > 0) ship.forwardThrust();
    else if (wdist > 400 && aligned) ship.backThrust();
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
