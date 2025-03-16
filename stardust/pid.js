export { PIDController, otherControl };

import { normalizeAngle } from "./math.js";

class PIDController {
  constructor(Kp, Ki, Kd, dt) {
    this.Kp = Kp; // Proportional gain
    this.Ki = Ki; // Integral gain
    this.Kd = Kd; // Derivative gain
    //this.dt = dt; // Time step (delta time)
    this._integral = +0;
    this.previousError = 0;
  }

  update(setpoint, processVariable, dt) {
    this._error = setpoint - processVariable;

    // Proportional term
    const P = this.Kp * this._error;

    // Integral term

    //this._integral += this._error * this.dt;
    // Anti-windup: only add I when it's small
    if (Math.abs(this._error) < 300) {
      this._integral += this._error * dt;
      // And clamp it
    }
    this._integral =
      Math.sign(this._integral) * Math.min(100, Math.abs(this._integral));
    const I = this.Ki * this._integral;

    // Derivative term
    this._derivative = (this._error - this.previousError) / dt;
    this._derivative =
      Math.sign(this._derivative) * Math.min(300, Math.abs(this._derivative));
    const D = this.Kd * this._derivative;

    // Store previous error for next iteration
    this.previousError = this._error;

    // Sum the terms and return the control output
    return P + I + D;
  }
  reset() {
    this.integral = 0;
    this.previousError = 0;
  }
}

const otherControl = (props = {}) => {
  const other = props.other;
  const ship = props.ship;
  const target = props.target;
  const deltaTime = props.deltaTime;
  const bulletList = props.bulletList;
  const asteroids = props.asteroids;
  const gameWidth = props.gameWidth;
  const gameHeight = props.gameHeight;
  const dt = deltaTime / 1000;

  if (!other.yawPID) {
    other.yawPID = new PIDController(0.1, 0.01, 0.01, dt);
    other.thrustPID = new PIDController(0.05, 0.001, 0.0001, dt);
    other.positionPID = new PIDController(0.01, 0.0, 0.0, dt);
  }

  // --- Wrapped Distance Calculation to Target ---
  let dx = target.pos.x - other.pos.x;
  if (dx > gameWidth / 2) {
    dx -= gameWidth;
  } else if (dx < -gameWidth / 2) {
    dx += gameWidth;
  }

  let dy = target.pos.y - other.pos.y;
  if (dy > gameHeight / 2) {
    dy -= gameHeight;
  } else if (dy < -gameHeight / 2) {
    dy += gameHeight;
  }

  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) {
    other.yawPID.reset();
    other.thrustPID.reset();
    other.positionPID.reset();
    return;
  }

  // --- Predictive Asteroid Avoidance (Wrapped Distance) ---
  let avoidanceAngle = 0;
  let isAvoiding = false;
  const avoidanceTimeThreshold = 2; // Time in seconds to look ahead for collisions
  const collisionRadiusFactor = 1.5; // Multiply combined radius for safety

  let closestThreatTime = Infinity;
  let bestAvoidanceAngle = 0;

  for (const asteroid of asteroids) {
    // Wrapped relative position to asteroid
    let relativePositionX = other.pos.x - asteroid.pos.x;
    if (relativePositionX > gameWidth / 2) {
      relativePositionX -= gameWidth;
    } else if (relativePositionX < -gameWidth / 2) {
      relativePositionX += gameWidth;
    }

    let relativePositionY = other.pos.y - asteroid.pos.y;
    if (relativePositionY > gameHeight / 2) {
      relativePositionY -= gameHeight;
    } else if (relativePositionY < -gameHeight / 2) {
      relativePositionY += gameHeight;
    }

    const relativeVelocityX = other.vel.x - asteroid.vel.x;
    const relativeVelocityY = other.vel.y - asteroid.vel.y;

    const a =
      relativeVelocityX * relativeVelocityX +
      relativeVelocityY * relativeVelocityY;
    if (a <= 0) continue; // Avoid division by zero if no relative velocity

    const b =
      relativePositionX * relativeVelocityX +
      relativePositionY * relativeVelocityY;
    const timeToClosestApproach = -b / a;

    if (
      timeToClosestApproach > 0 &&
      timeToClosestApproach < avoidanceTimeThreshold
    ) {
      const closestPointRelativeX =
        relativePositionX + relativeVelocityX * timeToClosestApproach;
      const closestPointRelativeY =
        relativePositionY + relativeVelocityY * timeToClosestApproach;
      const distanceAtClosestApproachSq =
        closestPointRelativeX * closestPointRelativeX +
        closestPointRelativeY * closestPointRelativeY;

      const combinedRadius =
        ((other.size || 10) / 2 + asteroid.size / 2) * collisionRadiusFactor;

      if (distanceAtClosestApproachSq < combinedRadius * combinedRadius) {
        isAvoiding = true;

        // Calculate avoidance angle based on the direction to the asteroid at the closest approach
        const angleToClosestApproach = Math.atan2(
          closestPointRelativeY,
          closestPointRelativeX,
        );
        const shipAngle = other.r;
        const angleDifferenceToAsteroid = normalizeAngle(
          angleToClosestApproach - shipAngle,
        );

        // Steer away - try both directions and pick the one that requires less rotation
        const avoidLeftAngle = normalizeAngle(
          angleDifferenceToAsteroid + Math.PI / 2,
        );
        const avoidRightAngle = normalizeAngle(
          angleDifferenceToAsteroid - Math.PI / 2,
        );

        // Choose the avoidance direction that is closer to the current facing
        if (Math.abs(avoidLeftAngle) < Math.abs(avoidRightAngle)) {
          avoidanceAngle = avoidLeftAngle;
        } else {
          avoidanceAngle = avoidRightAngle;
        }

        // Prioritize the most imminent threat
        if (timeToClosestApproach < closestThreatTime) {
          closestThreatTime = timeToClosestApproach;
          bestAvoidanceAngle = avoidanceAngle;
        }
      }
    }
  }

  // --- Asteroid Shooting Logic (Wrapped Distance) ---
  const asteroidShootingRange = 900; // Adjust this value
  const asteroidFacingThreshold = 0.7;

  for (const asteroid of asteroids) {
    // Wrapped distance to asteroid
    let distanceToAsteroidX = asteroid.pos.x - other.pos.x;
    if (distanceToAsteroidX > gameWidth / 2) {
      distanceToAsteroidX -= gameWidth;
    } else if (distanceToAsteroidX < -gameWidth / 2) {
      distanceToAsteroidX += gameWidth;
    }

    let distanceToAsteroidY = asteroid.pos.y - other.pos.y;
    if (distanceToAsteroidY > gameHeight / 2) {
      distanceToAsteroidY -= gameHeight;
    } else if (distanceToAsteroidY < -gameHeight / 2) {
      distanceToAsteroidY += gameHeight;
    }

    const distanceToAsteroid = Math.sqrt(
      distanceToAsteroidX * distanceToAsteroidX +
        distanceToAsteroidY * distanceToAsteroidY,
    );

    if (distanceToAsteroid < asteroidShootingRange) {
      const angleToAsteroid = Math.atan2(
        distanceToAsteroidY,
        distanceToAsteroidX,
      );
      const shipAngle = other.r;
      const angleDifferenceToAsteroid = normalizeAngle(
        angleToAsteroid - shipAngle,
      );

      if (Math.abs(angleDifferenceToAsteroid) < asteroidFacingThreshold) {
        const now = performance.now();
        if (now - other.prevshot < 120) {
          continue; // Don't shoot too rapidly
        }
        other.prevshot = now;
        if ((other.ammo?.[other.weapons[0]?.kind]?.count ?? 0) >= 2) {
          if (other.weapons && other.weapons[0])
            other.weapons[0].fire(other, bulletList);
          if (other.weapons && other.weapons[1])
            other.weapons[1].fire(other, bulletList);
        }
        if (target.kind === "kAsteroid") {
          if (distanceToAsteroid < 1000 && other.secondaryWeapons[0]) {
            other.secondaryWeapons[0].fire(other, bulletList);
          }
        }
        break; // Shoot at one asteroid at a time for now
      }
    }
  }

  // --- Target Prediction for Chasing (Wrapped Distance) ---
  const predictionTime = 100 * dt;
  const predictedTargetX = target.pos.x + target.vel.x * predictionTime;
  const predictedTargetY = target.pos.y + target.vel.y * predictionTime;

  // Wrapped distance to predicted target
  let predictedDX = predictedTargetX - other.pos.x;
  if (predictedDX > gameWidth / 2) {
    predictedDX -= gameWidth;
  } else if (predictedDX < -gameWidth / 2) {
    predictedDX += gameWidth;
  }

  let predictedDY = predictedTargetY - other.pos.y;
  if (predictedDY > gameHeight / 2) {
    predictedDY -= gameHeight;
  } else if (predictedDY < -gameHeight / 2) {
    predictedDY += gameHeight;
  }

  let desiredAngle;
  if (isAvoiding) {
    desiredAngle = normalizeAngle(other.r + bestAvoidanceAngle);
  } else {
    desiredAngle = Math.atan2(predictedDY, predictedDX);
  }

  const angleDifference = normalizeAngle(desiredAngle - other.r);

  // --- Yaw Control (PID) ---
  const yawRate = other.yawPID.update(0, angleDifference, dt);

  if (yawRate > 0.01) {
    other.yawRight();
  } else if (yawRate < -0.01) {
    other.yawLeft();
  }

  if (ship) {
    // Ship targetting
    const shootingAngle = Math.atan2(
      other.pos.y - ship.pos.y,
      other.pos.x - ship.pos.x,
    );

    let sdx = ship.pos.x - other.pos.x;
    if (sdx > gameWidth / 2) {
      sdx -= gameWidth;
    } else if (sdx < -gameWidth / 2) {
      sdx += gameWidth;
    }

    let sdy = ship.pos.y - other.pos.y;
    if (sdy > gameHeight / 2) {
      sdy -= gameHeight;
    } else if (sdy < -gameHeight / 2) {
      sdy += gameHeight;
    }
    const sdist = Math.sqrt(sdx * sdx + sdy * sdy);

    if (
      Math.abs(normalizeAngle(shootingAngle - other.r + Math.PI)) < 0.3 &&
      sdist < 0.8 * (other.weapons[0]?.stats?.minRange ?? 1500)
    ) {
      const now = performance.now();
      if (now - other.prevshot < (other.weapons[0]?.fireRate ?? 100)) {
        return;
      }
      if ((other.ammo?.[other.weapons[0]?.kind]?.count ?? 0) < 2) {
        return;
      }
      other.prevshot = now;
      if (other.weapons && other.weapons[0])
        other.weapons[0].fire(other, bulletList);
      if (other.weapons && other.weapons[1])
        other.weapons[1].fire(other, bulletList);

      // TODO tracking firerate should be internal of the weapon itself
      if (sdist < 1000 && other.secondaryWeapons[0]) {
        other.secondaryWeapons[0].fire(other, bulletList);
      }
    }
  }

  // --- Thrust Control (PID) --- (No changes here)
  const dirX = dx / dist;
  const dirY = dy / dist;

  const targetForwardVelocity_ff =
    target.vel.x * Math.cos(other.r) + target.vel.y * Math.sin(other.r);

  const desiredSpeed_pid = other.positionPID.update(dist, 0, dt);

  const desiredSpeed = desiredSpeed_pid + targetForwardVelocity_ff;

  const targetVelX = dirX * desiredSpeed;
  const targetVelY = dirY * desiredSpeed;
  const shipAngle = other.r;
  const forwardX = Math.cos(shipAngle);
  const forwardY = Math.sin(shipAngle);
  const targetForwardVelocity = targetVelX * forwardX + targetVelY * forwardY;
  const currentForwardVelocity =
    other.vel.x * forwardX + other.vel.y * forwardY;

  const thrust = other.thrustPID.update(
    targetForwardVelocity,
    currentForwardVelocity,
    dt,
  );
  if (thrust > 0.01) {
    other.backThrust();
  } else if (thrust < -0.01) {
    other.forwardThrust();
  }
};
