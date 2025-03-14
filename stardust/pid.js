export { PIDController, otherControl };

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

function normalizeAngle(angle) {
  angle = angle % (2 * Math.PI);
  if (angle < 0) {
    angle += 2 * Math.PI;
  }
  return angle;
}

const otherControl = (
  other,
  ship,
  target,
  deltaTime,
  bulletList,
  asteroids,
) => {
  const dt = deltaTime / 1000;

  if (!other.yawPID) {
    other.yawPID = new PIDController(0.1, 0.01, 0.01, dt);
    other.thrustPID = new PIDController(0.05, 0.001, 0.0001, dt);
    other.positionPID = new PIDController(0.01, 0.0, 0.0, dt);
  }

  const dx = target.pos.x - other.pos.x;
  const dy = target.pos.y - other.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 10) {
    other.yawPID.reset();
    other.thrustPID.reset();
    other.positionPID.reset();
    return;
  }

  // --- Predictive Asteroid Avoidance ---
  let avoidanceAngle = 0;
  let isAvoiding = false;
  const avoidanceTimeThreshold = 2; // Time in seconds to look ahead for collisions
  const collisionRadiusFactor = 1.5; // Multiply combined radius for safety

  let closestThreatTime = Infinity;
  let bestAvoidanceAngle = 0;

  for (const asteroid of asteroids) {
    const relativePositionX = other.pos.x - asteroid.pos.x;
    const relativePositionY = other.pos.y - asteroid.pos.y;
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

  // --- Target Prediction for Chasing ---
  const predictionTime = 100 * dt;
  const predictedTargetX = target.pos.x + target.vel.x * predictionTime;
  const predictedTargetY = target.pos.y + target.vel.y * predictionTime;

  let desiredAngle;
  if (isAvoiding) {
    desiredAngle = normalizeAngle(other.r + bestAvoidanceAngle);
  } else {
    desiredAngle = Math.atan2(
      predictedTargetY - other.pos.y,
      predictedTargetX - other.pos.x,
    );
  }

  const angleDifference = normalizeAngle(desiredAngle - other.r);

  // --- Yaw Control (PID) ---
  const yawRate = other.yawPID.update(0, angleDifference, dt);

  if (yawRate > 0.01) {
    other.yawRight();
  } else if (yawRate < -0.01) {
    other.yawLeft();
  }

  // --- Shooting Logic (No changes here) ---
  const shootingAngle = Math.atan2(
    other.pos.y - ship.pos.y,
    other.pos.x - ship.pos.x,
  );

  const sdx = ship.pos.x - other.pos.x;
  const sdy = ship.pos.y - other.pos.y;
  const sdist = Math.sqrt(sdx * sdx + sdy * sdy);

  if (
    Math.abs(normalizeAngle(shootingAngle - other.r + Math.PI)) < 0.3 &&
    sdist < 1500
  ) {
    const now = performance.now();
    if (now - other.prevshot < 150) {
      return;
    }
    other.prevshot = now;
    if (other.weapons && other.weapons[0])
      other.weapons[0].fire(other, bulletList);
    if (other.weapons && other.weapons[1])
      other.weapons[1].fire(other, bulletList);
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
