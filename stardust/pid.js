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

const otherControl = (other, ship, target, deltaTime, bulletList) => {
  const dt = deltaTime / 1000; // Assuming 60 FPS

  // --- Yaw Control (PID) ---
  if (!other.yawPID) {
    other.yawPID = new PIDController(0.1, 0.01, 0.01, deltaTime / 1000);

    other.thrustPID = new PIDController(0.05, 0.001, 0.0001, deltaTime / 1000);

    other.positionPID = new PIDController(
      0.1,
      0.0001,
      0.0001,
      deltaTime / 1000,
    );
  }

  const dx = target.pos.x - other.pos.x;
  const dy = target.pos.y - other.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist < 5) {
    // Dead zone (close enough)
    //other.vel.x = 0;
    //other.vel.y = 0;
    other.yawPID.reset(); // Reset integral term when at target
    other.thrustPID.reset();
    other.positionPID.reset();
    return; // Exit early - no need to calculate angles or thrust
  }
  // --- Prediction ---
  const predictionTime = 2 * dt;
  const predictedTargetX = target.pos.x + target.vel.x * predictionTime;
  const predictedTargetY = target.pos.y + target.vel.y * predictionTime;

  const desiredAngle = Math.atan2(
    predictedTargetY - other.pos.y,
    predictedTargetX - other.pos.x,
  );
  const angleDifference = normalizeAngle(desiredAngle - other.r);

  // Yaw PID output is the desired *yaw rate*
  const yawRate = other.yawPID.update(0, angleDifference, dt); // Setpoint is 0

  if (yawRate > 0.01) {
    // Use a small threshold to avoid rapid switching
    other.yawRight(); // Turn right
  } else if (yawRate < -0.01) {
    other.yawLeft(); // Turn left
  } // Else:  Don't rotate (within the threshold)

  const shootingAngle = Math.atan2(
    other.pos.y - ship.pos.y,
    other.pos.x - ship.pos.x,
  );

  const sdx = ship.pos.x - other.pos.x;
  const sdy = ship.pos.y - other.pos.y;
  const sdist = Math.sqrt(sdx * sdx + sdy * sdy);

  if (
    Math.abs(normalizeAngle(shootingAngle - other.r + Math.PI)) < 0.3 &&
    sdist < 1000
  ) {
    //console.log("Bang")
    const now = performance.now();
    if (now - other.prevshot < 100) {
      return;
    }
    other.prevshot = now;
    other.weapons[0].fire(other, bulletList);
    other.weapons[1].fire(other, bulletList);
  }

  // --- Thrust Control (PID) --- (No changes here from the previous *correct* version)
  const dirX = dx / dist;
  const dirY = dy / dist;

  // Feedforward Velocity
  const targetForwardVelocity_ff =
    target.vel.x * Math.cos(other.r) + target.vel.y * Math.sin(other.r);

  // Position PID (Outer Loop)
  const desiredSpeed_pid = other.positionPID.update(dist, 0, dt);

  // Combine Feedforward and PID output
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
  //console.log(thrust)
  if (thrust > 0.01) {
    other.backThrust();
  } else if (thrust < -0.01) {
    other.forwardThrust();
  }
  //document.querySelector("#pid-dt").innerHTML = deltaTime.toFixed(3)
  /*document.querySelector("#pid-p").innerHTML =
    other.positionPID._error.toFixed(0);
  document.querySelector("#pid-i").innerHTML =
    other.positionPID._integral.toFixed(0);
  document.querySelector("#pid-d").innerHTML =
    other.positionPID._derivative.toFixed(0);*/
};
