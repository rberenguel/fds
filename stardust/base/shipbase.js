export { Ship };

import { Base1 } from "../base.js";

import { dist, sqnorm, rotate, normalizeAngle } from "../math.js";
import { Flame } from "../flame.js";
import { seededRnd } from "../rnd.js";
import { settings } from "../../roids2/settings.js";
import { Debris, kinds as debrisKinds } from "./debris.js";
const rnd = seededRnd(performance.now());

function shortestAngleDifference(angle1, angle2) {
  let difference = angle1 - angle2;
  const twoPI = 2 * Math.PI;
  while (difference > Math.PI) difference -= twoPI;
  while (difference < -Math.PI) difference += twoPI;
  return difference;
}

let shipIdCounter = 0;

function getShipId() {
  return shipIdCounter++;
}

class Ship extends Base1 {
  static kind = "kShip";

  constructor(props) {
    super(props);
    this.vertices = props.vertices;
    this.e = props.e ?? 1000;
    this.initialE = this.e;
    this.weapons = props.weapons ?? [];
    this.secondaryWeapons = props.secondaryWeapons ?? [];
    this.ammo = {};
    this._initAmmo([...this.weapons, ...this.secondaryWeapons]);
    this.flameList = [];
    this.bulletList = [];
    this.recoveryRate = props.recoveryRate ?? 0;
    this.activeAbilityEnergyRecoveryRate =
      props.activeAbilityEnergyRecoveryRate ?? 0;
    this.activeAbilityEnergy = 1;
    this.maxActiveAbilityEnergy = 1;
    this.shieldEnergyRecoveryRate = props.shieldEnergyRecoveryRate ?? 0;
    this.boostStop = 0;
    this.shieldEnergy = 1;
    this.maxShieldEnergy = 1;
    this._id = getShipId();
    this.prevShot = -1;
    this.secondaryPrevShot = -1;
    this.yawRate = props.yawRate ?? 0.03;
    this.accel = props.accel ?? (settings.shipProps?.accel ?? 0.1);
    this.extraAmmo = 1;
    this._magicalCounter = 0;
    this.disabled = 0;
    this.radius = props.radius;
    this.inertialDampener = 0;
  }

  _initAmmo(weapons) {
    for (const w of weapons) {
      if (w.ammo && !this.ammo[w.kind]) {
        this.ammo[w.kind] = { count: w.ammoMax ?? 99, max: w.ammoMax ?? 99 };
      }
    }
  }

  increaseEnergy(pct) {
    const inc = (this.maxE * pct) / 100;
    this.e += inc;
    this.e = Math.min(this.e, this.maxE);
  }

  action() {
    return;
  }

  burst(props = {}) {
    const minenergy = props.minenergy ?? 12;
    const explenergy = Math.min(Math.max(props.e ?? 3, 1), 5);
    const pos = props.pos ?? { x: 0, y: 0 };
    const [rpx, rpy] = rotate(pos.x, pos.y, this.r);
    const count = props.count ?? (settings.explosions.ships.explode.baseCount * explenergy);
    for (let i = 0; i < count; i++) {
      const m = 8 * Math.random();
      const a = Math.random() * 2 * Math.PI;
      const fl = new Flame({
        pos: {
          x: this.pos.x + rpx,
          y: this.pos.y + rpy,
        },
        vel: {
          x: m * Math.cos(a),
          y: m * Math.sin(a),
        },
        fill: props.fill,
        r: 0,
        e: minenergy + Math.random() * 8,
        scale: settings.explosions.ships.flame.scale?.() ?? 1,
      });
      this.flameList.push(fl);
    }
  }

  explode(props = {}) {
    const minenergy = props.minenergy ?? 12;
    const explenergy = Math.min(Math.max(props.e, 1), 5);
    const pos = props.pos ?? { x: 0, y: 0 };
    const [rpx, rpy] = rotate(pos.x, pos.y, this.r);
    for (
      let i = 0;
      i < settings.explosions.ships.explode.baseCount * explenergy;
      i++
    ) {
      const m = 8 * Math.random();
      const a = Math.random() * 2 * Math.PI;
      const fl = new Flame({
        pos: {
          x: this.pos.x + rpx,
          y: this.pos.y + rpy,
        },
        vel: {
          x: m * Math.cos(a),
          y: m * Math.sin(a),
        },
        fill: props.fill,
        r: 0,
        e: minenergy + Math.random() * 8,
        scale: settings.explosions.ships.flame.scale?.() ?? 1,
      });
      this.flameList.push(fl);
    }
    let rotatedVertices = [];
    if (this.vertices) {
      for (let v of this.vertices) {
        const [rvx, rvy] = rotate(v[0], v[1], this.r);
        rotatedVertices.push([rvx, rvy]);
      }
    }
    if (rotatedVertices.length > 0) {
      const debris = new Debris({
        pos: {
          x: this.pos.x,
          y: this.pos.y,
        },
        vel: props.vel ?? {
          x: 0,
          y: 0,
        },
        kind: debrisKinds.kShipDebris,
        vertices: rotatedVertices,
        width: this.width,
        color: this.color,
        r: this.r,
      });
      return debris;
    }
    return null;
  }

  getPan() {
    if (!this.viewframe) return 0;
    return window.calculatePanFromPosition?.(this, {
      wmin: 0,
      wmax: this.viewframe.app?.renderer.width / this.viewframe.scale,
      hmin: 0,
      hmax: this.viewframe.app?.renderer.height / this.viewframe.scale,
    }) ?? 0;
  }

  collision(other) {
    const energyShots = ["kPlasmaBullet", "kLaserGunShot", "kPhotonTorpedo"];
    const massShots = ["kGaussCannonBullet", "kMassDriverBullet"];
    const shieldRadius = 130;
    if (other.source === this._id) {
      return;
    }
    if (this.phaseShield > performance.now()) {
      return false;
    }
    if (this.vsRespawnAt > 0) {
      return false;
    }
    if (this.energyShield > performance.now()) {
      const distToOther = Math.sqrt(
        Math.pow(other.pos.x - this.pos.x, 2) +
          Math.pow(other.pos.y - this.pos.y, 2),
      );
      if (distToOther <= 1.3 * shieldRadius + (other.radius || 0)) {
        if (this.energyShield && energyShots.includes(other.kind)) {
          other.e = -1;
          return false;
        }
      }
    }
    if (this.deflectorShield > performance.now()) {
      let refractionFactor = -0.9;
      if (massShots.includes(other.kind)) {
        refractionFactor = 0.6;
      }
      const distToOther = Math.sqrt(
        Math.pow(other.pos.x - this.pos.x, 2) +
          Math.pow(other.pos.y - this.pos.y, 2),
      );

      if (distToOther <= 1.3 * shieldRadius + (other.radius || 0)) {
        const collisionVector = {
          x: other.pos.x - this.pos.x,
          y: other.pos.y - this.pos.y,
        };
        const collisionNormalMagnitude = Math.sqrt(
          Math.pow(collisionVector.x, 2) + Math.pow(collisionVector.y, 2),
        );
        const collisionNormal = {
          x: collisionVector.x / collisionNormalMagnitude,
          y: collisionVector.y / collisionNormalMagnitude,
        };

        const velocity = { x: other.vel.x, y: other.vel.y };
        const dotProduct =
          velocity.x * collisionNormal.x + velocity.y * collisionNormal.y;

        if (dotProduct < 0) {
          const tangent = { x: -collisionNormal.y, y: collisionNormal.x };
          const tangentMagnitude = Math.sqrt(
            Math.pow(tangent.x, 2) + Math.pow(tangent.y, 2),
          );
          const unitTangent = {
            x: tangent.x / tangentMagnitude,
            y: tangent.y / tangentMagnitude,
          };

          const velocityNormalScalar =
            velocity.x * collisionNormal.x + velocity.y * collisionNormal.y;
          const velocityNormal = {
            x: velocityNormalScalar * collisionNormal.x,
            y: velocityNormalScalar * collisionNormal.y,
          };

          const velocityTangentScalar =
            velocity.x * unitTangent.x + velocity.y * unitTangent.y;
          const velocityTangent = {
            x: velocityTangentScalar * unitTangent.x,
            y: velocityTangentScalar * unitTangent.y,
          };

          const refractedVelocityNormal = {
            x: -velocityNormal.x * refractionFactor,
            y: -velocityNormal.y * refractionFactor,
          };
          const refractedVelocity = {
            x: refractedVelocityNormal.x + velocityTangent.x,
            y: refractedVelocityNormal.y + velocityTangent.y,
          };

          other.vel.x = refractedVelocity.x;
          other.vel.y = refractedVelocity.y;

          if (typeof other.angle !== "undefined") {
            other.angle = Math.atan2(refractedVelocity.y, refractedVelocity.x);
          }

          const speed = Math.sqrt(
            Math.pow(velocity.x, 2) + Math.pow(velocity.y, 2),
          );
          const pushFactor = Math.max(0.1, Math.abs(dotProduct) / speed);
          const pushVector = {
            x: collisionNormal.x * pushFactor * 5,
            y: collisionNormal.y * pushFactor * 5,
          };

          other.vel.x += pushVector.x;
          other.vel.y += pushVector.y;

          return false;
        }
      }
    }
    const d = dist(other.pos, this.pos);
    if (
      other.kind === "kPhotonTorpedo" ||
      other.kind === "kGaussCannonBullet"
    ) {
      if (!other.minDistance) {
        other.minDistance = {};
        other.minDistance[this._id] = d;
      }
      if (
        (other.minDistance[this._id] ?? Infinity) > 0 &&
        d > other.minDistance[this._id]
      ) {
        return -other.minDistance[this._id];
      }
      other.minDistance[this._id] = Math.min(
        other.minDistance[this._id] ?? Infinity,
        d,
      );
    }

    if (d < 50) {
      return 1;
    }
    if (d < (other.radius ?? 0) + (this.radius ?? 50)) {
      return 1;
    }

    if (d < (other.size ?? 0) + (this.radius ?? 50)) {
      return 1;
    }
    return 0;
  }

  annotateMountPoints() {
    this.presentation.circle(-40, 40, 5);
    this.presentation.fill(0xff0000);
    this.presentation.circle(-40, -40, 5);
    this.presentation.fill(0x0000ff);
    this.presentation.circle(70, 0, 5);
    this.presentation.fill(0xff00ff);
    this.presentation.circle(-60, 0, 10);
    this.presentation.fill(0xff8800);
    this.presentation.circle(90, 0, 10);
    this.presentation.fill(0xff8800);
  }

  backThrust(f = 1, limit = 1e6) {
    if (this.disabled > performance.now()) {
      return;
    }
    const nv = sqnorm(this.vel.x, this.vel.y);
    if (nv < limit) {
      this.noLimits = false;
    }
    const velocityAngle = Math.atan2(this.vel.y, this.vel.x);

    const oppositeVelocityAngle = normalizeAngle(velocityAngle + Math.PI);

    const angleDifference = shortestAngleDifference(
      this.r,
      oppositeVelocityAngle,
    );

    if (nv > 10 && Math.abs(angleDifference) < 0.5 && this.emergencyBrakes) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.burst({
        pos: { x: -60, y: 0 },
        count: 15,
        minenergy: 20,
        fill: 0x00ccff,
      });
      if (this.human) {
        window.sampler?.("e2", 0.8, { pan: this.getPan() });
      }
      return;
    }

    let _vx = this.vel.x + this.accel * Math.cos(this.r) * f;
    let _vy = this.vel.y + this.accel * Math.sin(this.r) * f;

    if (this.inertialDampener > 0) {
      const rightX = Math.cos(this.r + Math.PI / 2);
      const rightY = Math.sin(this.r + Math.PI / 2);
      const lateralVelocity = this.vel.x * rightX + this.vel.y * rightY;
      const dampeningFactor = this.inertialDampener;
      _vx -= lateralVelocity * rightX * dampeningFactor;
      _vy -= lateralVelocity * rightY * dampeningFactor;
    }

    const _nv = sqnorm(_vx, _vy);
    if (_nv < limit || (this.noLimits && _nv < nv)) {
      this.vel.x = _vx;
      this.vel.y = _vy;
      for (let i = 0; i < 3; i++) {
        this._backThrust();
      }
      if (this.human && Math.random() < 0.05) {
        window.sampler?.("e1", 0.3, { pan: this.getPan() });
      }
    } else {
      if (Math.random() < 0.2) {
        this._backThrust({ fill: 0x0099ff });
      }
    }
  }

  _backThrust(props = {}) {
    const rf = rnd();
    const spread = 0.3 - 0.6 * rf;
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const pvx = props.pvx ?? 0;
    const pvy = props.pvy ?? 0;
    const vx = Flame.ACCEL * ivx + (this.vel.x + pvx) * Math.sqrt(rnd());
    const vy = Flame.ACCEL * ivy + (this.vel.y + pvy) * Math.sqrt(rnd());
    const [rvx, rvy] = rotate(vx, vy, spread);
    const [rpx, rpy] = rotate(-60, 0, this.r);
    const fl = new Flame({
      pos: {
        x: this.pos.x + rpx,
        y: this.pos.y + rpy,
      },
      vel: {
        x: rvx,
        y: rvy,
      },
      r: this.r,
      e: 12,
      fill: props.fill,
    });
    this.flameList.push(fl);
  }

  forwardThrust(f = 1, limit = 1e6) {
    if (this.disabled > performance.now()) {
      return;
    }
    const nv = sqnorm(this.vel.x, this.vel.y);
    if (nv < limit) {
      this.noLimits = false;
    }
    const velocityAngle = Math.atan2(this.vel.y, this.vel.x);
    const oppositeVelocityAngle = normalizeAngle(velocityAngle);

    const angleDifference = shortestAngleDifference(
      this.r,
      oppositeVelocityAngle,
    );

    if (nv > 10 && Math.abs(angleDifference) < 0.5 && this.emergencyBrakes) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.burst({
        pos: { x: -60, y: 0 },
        count: 15,
        minenergy: 10,
        fill: 0x00ccff,
      });
      if (this.human) {
        window.sampler?.("e2", 0.8, { pan: this.getPan() });
      }
      return;
    }

    let _vx = this.vel.x - this.accel * Math.cos(this.r) * f;
    let _vy = this.vel.y - this.accel * Math.sin(this.r) * f;

    if (this.inertialDampener > 0) {
      const rightX = Math.cos(this.r + Math.PI / 2);
      const rightY = Math.sin(this.r + Math.PI / 2);
      const lateralVelocity = this.vel.x * rightX + this.vel.y * rightY;
      const dampeningFactor = this.inertialDampener;
      _vx -= lateralVelocity * rightX * dampeningFactor;
      _vy -= lateralVelocity * rightY * dampeningFactor;
    }

    const _nv = sqnorm(_vx, _vy);
    if (_nv < limit || (this.noLimits && _nv < nv)) {
      this.vel.x = _vx;
      this.vel.y = _vy;
      for (let i = 0; i < 3; i++) {
        this._forwardThrust();
      }
      if (this.human && Math.random() < 0.05) {
        window.sampler?.("e1", 0.3, { pan: this.getPan() });
      }
    } else {
      if (Math.random() < 0.2) {
        this._forwardThrust({ fill: 0x0099ff });
      }
    }
  }

  _forwardThrust(props = {}) {
    const rf = rnd();
    const spread = 0.15 - 0.3 * rf;
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const vx = Flame.ACCEL * ivx + this.vel.x * Math.sqrt(rnd());
    const vy = Flame.ACCEL * ivy + this.vel.y * Math.sqrt(rnd());
    const [rvx, rvy] = rotate(vx, vy, spread);
    const [rpx, rpy] = rotate(90, 0, this.r);
    const fl = new Flame({
      pos: {
        x: this.pos.x + rpx,
        y: this.pos.y + rpy,
      },
      vel: {
        x: rvx,
        y: rvy,
      },
      r: this.r,
      e: 12,
      fill: props.fill,
    });
    this.flameList.push(fl);
  }

  yawRight(f = 1) {
    if (this.disabled > performance.now()) {
      return;
    }
    this.r += this.yawRate * f;
  }

  yawLeft(f = 1) {
    if (this.disabled > performance.now()) {
      return;
    }
    this.r -= this.yawRate * f;
  }

  generate() {
    super.generate();
    if (this.weapons[0] && this.weapons[0].rangeHint) {
      this.weapons[0].rangeHint.generate();
    }
    if (this.weapons[1] && this.weapons[1].rangeHint) {
      this.weapons[1].rangeHint.generate();
    }
  }

  attach(viewframe) {
    super.attach(viewframe);
  }

  shieldsOn() {
    if (this.phaseShield > performance.now()) {
      return true;
    }
    if (this.energyShield > performance.now()) {
      return true;
    }
    if (this.deflectorShield > performance.now()) {
      return true;
    }
    return false;
  }

  destroy() {
    this.presentation = { destroyed: true };
    this.destroyWeapons();
    super.destroy();
  }

  destroyWeapons() {
    for (let w of this.weapons ?? []) {
      w.destroy();
    }
  }

  update(delta) {
    if (this.boostStop != 0 && this.boostStop < performance.now()) {
      this.boostStop = 0;
      this.vel.x = 0;
      this.vel.y = 0;
      this.burst({
        pos: { x: 90, y: 0 },
        count: 15,
        minenergy: 25,
        fill: 0x00ccff,
      });
      if (this.human) {
        window.sampler?.("e2", 0.8, { pan: this.getPan() });
      }
    }
    super.update(delta);
    super.move(delta.deltaTime);
    this.e += this.recoveryRate * delta.deltaTime;
    this.e = Math.min(this.e, this.maxE ?? this.initialE);
    this.activeAbilityEnergy +=
      this.activeAbilityEnergyRecoveryRate * delta.deltaTime;
    this.activeAbilityEnergy = Math.min(
      this.activeAbilityEnergy,
      this.maxActiveAbilityEnergy,
    );
    this.shieldEnergy += this.shieldEnergyRecoveryRate * delta.deltaTime;
    this.shieldEnergy = Math.min(this.shieldEnergy, this.maxShieldEnergy);
    if (
      Math.abs(this.shieldEnergy - this.maxShieldEnergy) < 1e-5 &&
      !this.shieldBlinked
    ) {
      this.blinkShield = performance.now() + 500;
      this.shieldBlinked = true;
    }
    let w = this.weapons[0];
    if (w && w.kind) {
      const rr = w.stats.ammoRefreshRate;
      if (rr && this.ammo[w.kind]) {
        this.ammo[w.kind].count += rr * delta.deltaTime;
        this.ammo[w.kind].count = Math.min(
          this.ammo[w.kind].max,
          this.ammo[w.kind].count,
        );
      }
    }
    w = this.weapons[2];
    if (w && w.kind) {
      const rr = w.stats.ammoRefreshRate;
      if (rr && this.ammo[w.kind]) {
        this.ammo[w.kind].count += rr * delta.deltaTime;
        this.ammo[w.kind].count = Math.min(
          this.ammo[w.kind].max,
          this.ammo[w.kind].count,
        );
      }
    }
    w = this.secondaryWeapons[0];
    if (w && w.kind) {
      const rr = w.stats.ammoRefreshRate;
      if (rr && this.ammo[w.kind]) {
        this.ammo[w.kind].count += rr * delta.deltaTime;
        this.ammo[w.kind].count = Math.min(
          this.ammo[w.kind].max,
          this.ammo[w.kind].count,
        );
      }
    }

    const ne = Math.max(0, Math.min(1, this.e / (this.maxE ?? this.initialE)));
    const red = 255;
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne);
    let hexColor = (red << 16) | (green << 8) | blue;
    if (isNaN(ne)) {
      hexColor = 0xff9900;
    }
    if (isNaN(this.vel.x) || isNaN(this.vel.y)) {
      this.destroy(false);
      return;
    }
    if (isNaN(this.pos.x) || isNaN(this.pos.y)) {
      this.destroy(false);
      return;
    }
    for (let presentation of this.presentations) {
      if (!presentation) {
        this.destroy();
        return;
      }
      if (presentation.destroyed) {
        this.destroy();
        return;
      }
      presentation.rotation = this.r;
      if (presentation.name == "") {
        if (this.playerColor !== undefined) {
          const hr = (hexColor >> 16) & 0xff;
          const hg = (hexColor >> 8) & 0xff;
          const hb = hexColor & 0xff;
          const pr = (this.playerColor >> 16) & 0xff;
          const pg = (this.playerColor >> 8) & 0xff;
          const pb = this.playerColor & 0xff;
          presentation.tint =
            (Math.min(255, Math.floor((hr + pr) / 2)) << 16) |
            (Math.min(255, Math.floor((hg + pg) / 2)) << 8) |
            Math.min(255, Math.floor((hb + pb) / 2));
        } else {
          presentation.tint = hexColor;
        }
        if (this.disabled > performance.now()) {
          const red = Math.floor(200 * ne);
          const blue = 255;
          const green = Math.floor(200 * ne);
          presentation.tint = (red << 16) | (green << 8) | blue;
        }
        presentation.alpha = 1;
        if (this.phaseShield > performance.now()) {
          presentation.alpha = 0.2;
        }
      } else {
        if (presentation.name == "hitMesh") {
          if (this.showHit > performance.now()) {
            presentation.alpha = 1;
            presentation.tint = 0xcccccc;
          } else {
            presentation.alpha = 0;
            presentation.tint = 0x000000;
          }
        }
        if (presentation.name == "primaryWeapon") {
          if (this.weapons[0] && this.weapons[0].kind) {
            presentation.tint = this.weapons[0].color;
          }
        }
        if (presentation.name == "targetted") {
          if (this.targetted) {
            presentation.alpha = 0.8;
          } else {
            presentation.alpha = 0;
          }
          presentation.rotation = 0;
        }
        if (presentation.name == "secondaryWeapon") {
          presentation.alpha = 1;
          if (
            this.secondaryWeapons[0] &&
            (this.ammo[this.secondaryWeapons[0].kind]?.count ?? 0) >= 1
          ) {
            presentation.tint = this.secondaryWeapons[0].color;
          } else {
            presentation.tint = 0x000000;
          }
        }
        if (presentation.name == "pointSight") {
          if (!this.pointSight) {
            presentation.tint = 0xff0000;
            presentation.alpha = 0.0;
          }
          if (this.pointSight) {
            presentation.tint = 0x00ff00;
            presentation.alpha = 0.2;
          }
        }
        if (presentation.name == "shield") {
          if (this.deflectorShield > performance.now()) {
            presentation.alpha = 0.3 + Math.random() * 0.3;
            presentation.tint = null;
          } else if (this.energyShield > performance.now()) {
            const red = Math.floor(120 * Math.random());
            const green = Math.floor(255 * Math.random());
            const blue = Math.floor(255 * Math.random());
            const hexColor = (red << 16) | (green << 8) | blue;
            presentation.alpha = 0.3 + Math.random() * 0.3;
            presentation.tint = hexColor;
          } else {
            presentation.alpha = 0;
            if (this.blinkShield > performance.now()) {
              presentation.alpha = 0.3;
              presentation.tint = 0xffff00;
            }
          }
        }
        if (presentation.name == "phaseShield") {
          if (this.phaseShield > performance.now()) {
            this._magicalCounter = (this._magicalCounter + 1) % 100;
            presentation.gradienter(
              Math.cos((Math.PI * 2 * this._magicalCounter) / 100),
              Math.cos((Math.PI * 2 * this._magicalCounter) / 100),
            );
            presentation.alpha = 0.8;
          } else {
            presentation.alpha = 0;
          }
        }
      }
      if (this.vsRespawnAt > 0) {
        presentation.alpha = 0;
      }
    }
  }
}
