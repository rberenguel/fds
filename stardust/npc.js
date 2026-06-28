export { NPC_PRESETS, initNpcPIDs, npcControl };

import { PIDController } from './pid.js';
import { normalizeAngle } from './math.js';

// PID gains per behavior mode.  All use dt = deltaTime/1000 (same convention as pid.js).
// Patrol is deliberately calm — ships look purposeful, not frantic.
// Chase is toned down from Destrier to reduce overshoot in open space.
// Raid is aggressive but still physically believable.
const NPC_PRESETS = {
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
const npcControl = (ship, deltaTime) => {
  if (!ship.npcState) return;

  const preset = ship.npcState === 'patrol' ? 'patrol'
               : ship.npcState === 'chase'   ? 'chase'
               : 'raid';

  if (!ship.yawPID || ship._npcPreset !== preset) initNpcPIDs(ship, preset);

  if (ship.npcState === 'patrol') _patrolTick(ship, deltaTime);
};

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
