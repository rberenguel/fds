export { Bobcat, Lynx };

import { Mesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";
import {
  GaussCannon,
  MassDriverGun,
  PhotonTorpedoLauncher,
  PlasmaGun,
} from "./weapons/weapons.js";
import { FillGradient } from "../libs/3rdparty/pixi.mjs";
import { dist, sqnorm, rotate } from "../stardust/math.js";
import { Flame } from "./flame.js";
import { seededRnd } from "./rnd.js";
import { normalizeAngle } from "../stardust/math.js";
import { settings } from "../roids2/settings.js";
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
    this.e = props.e ?? 1000;
    this.initialE = this.e;
    //this.scale = props.scale ?? 1
    this.weapons = props.weapons ?? [];
    this.primaryWeaponShift = 0;
    this.secondaryWeaponShift = 0;
    this.secondaryWeapons = props.secondaryWeapons ?? [];
    this.ammo = {};
    this.actions = [];
    this.flameList = []; // TODO: careful with this as a dangling reference
    this.bulletList = [];
    this.recoveryRate = props.recoveryRate ?? 0;
    this.activeAbilityEnergyRecoveryRate =
      props.activeAbilityEnergyRecoveryRate ?? 0;
    this.activeAbilityEnergy = 1;
    this.maxActiveAbilityEnergy = 1;
    this.shieldEnergyRecoveryRate = props.shieldEnergyRecoveryRate ?? 0;
    this.shieldEnergy = 1;
    this.maxShieldEnergy = 1;
    this._id = getShipId();
    this.prevShot = -1;
    this.secondaryPrevShot = -1;
    this.yawRate = props.yawRate ?? 0.03;
    this.accel = props.accel ?? 0.1;
    this.extraAmmo = 1;
    this._magicalCounter = 0;
    this.disabled = 0;
  }

  action() {
    return;
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
      const m = 4 * Math.random();
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
        scale: settings.explosions.ships.flame.scale(),
      });
      this.flameList.push(fl);
    }
  }

  collision(other) {
    // TODO: This could be in Base, somehow?
    // TODO For ship, this is totally made up
    const energyShots = ["kPlasmaBullet", "kLaserGunShot", "kPhotonTorpedo"];
    const massShots = ["kGaussCannonBullet", "kMassDriverBullet"];
    const shieldRadius = 130;
    if (this.phaseShield > performance.now()) {
      return false;
    }
    if (this.energyShield > performance.now()) {
      const distToOther = Math.sqrt(
        Math.pow(other.pos.x - this.pos.x, 2) +
          Math.pow(other.pos.y - this.pos.y, 2),
      );
      // Energy shields null all energy weapons
      if (distToOther <= 1.3 * shieldRadius + (other.radius || 0)) {
        if (this.energyShield && energyShots.includes(other.kind)) {
          other.e = 0;
          return false;
        }
      }
    }
    if (this.deflectorShield > performance.now()) {
      let refractionFactor = -0.9; // For energy stuff
      if (massShots.includes(other.kind)) {
        refractionFactor = 0.6;
      }
      const shieldRadius = 130;
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

        // Only refract if the object is moving towards the shield
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

          // Removed the overlap correction here, as the refraction should handle the change in direction

          return false;
        }
      }
    }
    if (dist(other.pos, this.pos) < 50) {
      return true;
    }
    if (dist(other.pos, this.pos) < (other.radius ?? 0) + 50) {
      return true;
    }

    if (dist(other.pos, this.pos) < (other.size ?? 0) + 50) {
      return true;
    }
    return false;
  }

  annotateMountPoints() {
    // Right point
    this.presentation.circle(-40, 40, 5);
    this.presentation.fill(0xff0000);
    // Left point
    // What, why?
    this.presentation.circle(-40, -40, 5);
    this.presentation.fill(0x0000ff);
    // Middle point
    this.presentation.circle(70, 0, 5);
    this.presentation.fill(0xff00ff);
    // Back thruster
    this.presentation.circle(-60, 0, 10);
    this.presentation.fill(0xff8800);
    // Forward thruster
    this.presentation.circle(90, 0, 10);
    this.presentation.fill(0xff8800);
  }

  backThrust(f = 1, limit = 1e6) {
    if (this.disabled > performance.now()) {
      return;
    }
    this.actions.push("backThrust");
    const nv = sqnorm(this.vel.x, this.vel.y);
    const velocityAngle = Math.atan2(this.vel.y, this.vel.x);

    const oppositeVelocityAngle = normalizeAngle(velocityAngle + Math.PI);

    const angleDifference = shortestAngleDifference(
      this.r,
      oppositeVelocityAngle,
    );

    if (nv > 10 && Math.abs(angleDifference) < 0.5 && this.emergencyBrakes) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.explode({
        pos: { x: -60, y: 0 },
        count: 15,
        minenergy: 20,
        fill: 0x00ccff,
      });
      if (window.drumSampler && this.human) {
        window.drumSampler.triggerAttackRelease("e1", 0.8); // Snare ghost
      }
      return;
    }

    const _vx = this.vel.x + this.accel * Math.cos(this.r) * f;
    const _vy = this.vel.y + this.accel * Math.sin(this.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < limit) {
      if (window.drumSampler && this.human && Math.random() < 0.05) {
        window.drumSampler.triggerAttackRelease("e2", 0.3); // Wind
      }
      this.vel.x = _vx;
      this.vel.y = _vy;
      for (let i = 0; i < 3; i++) {
        this._backThrust();
      }
    } else {
      if (Math.random() < 0.5) {
        this._backThrust({ fill: 0x0099ff });
      }
    }
  }

  _backThrust(props = {}) {
    const rf = rnd();
    const spread = 0.3 - 0.6 * rf;
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const vx = Flame.ACCEL * ivx + this.vel.x * Math.sqrt(rnd());
    const vy = Flame.ACCEL * ivy + this.vel.y * Math.sqrt(rnd());
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
    this.actions.push("forwardThrust");
    const nv = sqnorm(this.vel.x, this.vel.y);
    const velocityAngle = Math.atan2(this.vel.y, this.vel.x);
    //const angleDifference = normalizeAngle(this.r - velocityAngle);
    const angleDifference = shortestAngleDifference(this.r, velocityAngle);
    if (nv > 10 && Math.abs(angleDifference) < 0.2 && this.emergencyBrakes) {
      this.vel.x = 0;
      this.vel.y = 0;
      this.explode({
        pos: { x: 90, y: 0 },
        count: 15,
        minenergy: 20,
        fill: 0x00ccff,
      });
      if (window.drumSampler && this.human) {
        window.drumSampler.triggerAttackRelease("e1", 0.8); // Snare ghost
      }
      return;
    }

    const _vx = this.vel.x - this.accel * Math.cos(this.r) * f;
    const _vy = this.vel.y - this.accel * Math.sin(this.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < limit) {
      this.vel.x = _vx;
      this.vel.y = _vy;
      for (let i = 0; i < 3; i++) {
        this._forwardThrust();
      }
      if (window.drumSampler && this.human && Math.random() < 0.05) {
        window.drumSampler.triggerAttackRelease("e2", 0.3); // Wind
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

  /* pos would be universe coordinates, then here I need to use screen coordinates */

  update(delta) {
    this.actions = this.actions.slice(-2);
    super.update(delta);
    super.move(delta.deltaTime);
    this.e += this.recoveryRate * delta.deltaTime;
    this.e = Math.min(this.e, this.initialE);
    this.activeAbilityEnergy +=
      this.activeAbilityEnergyRecoveryRate * delta.deltaTime;
    this.activeAbilityEnergy = Math.min(
      this.activeAbilityEnergy,
      this.maxActiveAbilityEnergy,
    );
    this.shieldEnergy += this.shieldEnergyRecoveryRate * delta.deltaTime;
    this.shieldEnergy = Math.min(this.shieldEnergy, this.maxShieldEnergy);
    let w = this.weapons[0];
    if (w) {
      const rr = w.stats.ammoRefreshRate;
      if (rr) {
        this.ammo[w.kind].count += rr * delta.deltaTime;
        this.ammo[w.kind].count = Math.min(
          this.ammo[w.kind].max,
          this.ammo[w.kind].count,
        );
      }
    }
    w = this.secondaryWeapons[0];
    if (w) {
      const rr = w.stats.ammoRefreshRate;
      if (rr) {
        this.ammo[w.kind].count += rr * delta.deltaTime;
        this.ammo[w.kind].count = Math.min(
          this.ammo[w.kind].max,
          this.ammo[w.kind].count,
        );
      }
    }

    // TODO this is repeated EVERYWHERE
    const ne = Math.max(0, Math.min(1, this.e / this.initialE));
    const red = 255;
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne);
    const hexColor = (red << 16) | (green << 8) | blue;
    if (isNaN(this.vel.x) || isNaN(this.vel.y)) {
      this.presentation = { destroyed: true };
      return;
    }
    if (isNaN(this.pos.x) || isNaN(this.pos.y)) {
      this.presentation = { destroyed: true };
      return;
    }
    for (let presentation of this.presentations) {
      if (!presentation) {
        this.presentation = { destroyed: true };
        return;
      }
      if (presentation.destroyed) {
        this.presentation = { destroyed: true };
        return;
      }
      presentation.rotation = this.r;
      if (presentation.name == "") {
        presentation.tint = hexColor;
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
        if (presentation.name == "primaryWeapon") {
          if (this.weapons[0] && this.weapons[0].kind) {
            presentation.tint = this.weapons[0].color;
          }
        }
        if (presentation.name == "secondaryWeapon") {
          if (
            this.secondaryWeapons[0] &&
            this.ammo[this.secondaryWeapons[0].kind].count >= 1
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
            const green = Math.floor(255 * Math.random()); // Green-blue hue
            const blue = Math.floor(255 * Math.random());
            const hexColor = (red << 16) | (green << 8) | blue;
            presentation.alpha = 0.3 + Math.random() * 0.3;
            presentation.tint = hexColor;
          } else {
            presentation.alpha = 0;
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
    }
  }
}

class Lynx extends Ship {
  constructor(props) {
    const vertices = [
      [-70, 50],
      [70, 0],
      [-70, -50],
      [-30, 0],
      [-70, 50],
    ];
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: vertices,
      color: 0xffffff,
      width: 10,
      fill: 0x000000,
    });
    const secondaryWeaponMesh = new Mesh({
      name: "secondaryWeapon",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      color: 0xffffff,
      fill: 0xffffff,
    });
    const shieldMesh = new Mesh({
      name: "shield",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 130,
      color: 0xcccccc,
      width: 10,
    });
    const phaseShieldMesh = new Mesh({
      name: "phaseShield",
      kind: Meshes.kPoly,
      vertices: vertices,
      color: 0xcccccc,
      gradienter:
        (mesh, p) =>
        (s1 = 1, s2 = 1) => {
          const colorStops = [0x00ff00, 0x000000];
          const gradientFill = new FillGradient(
            -50 * s1,
            -50 * s2,
            50 * s1,
            50 * s2,
          );
          colorStops.forEach((number, index) => {
            const ratio = index / colorStops.length;

            gradientFill.addColorStop(ratio, number);
          });
          p.clear().poly(mesh.flatten()).fill({ fill: gradientFill }); //, width: mesh.width ?? 4 });
        },
    });
    const pointSightMesh = new Mesh({
      name: "pointSight",
      kind: Meshes.kPoly,
      vertices: [
        [20000, 6],
        [20000, -6],
        [0, -6],
        [0, 6],
      ],
      fill: 0x00ff00,
    });
    let weapons = props.weapons ?? [];
    let secondaryWeapons = props.secondaryWeapons ?? [];
    if (!props.weapons) {
      try {
        const plasmaGun1 = new PlasmaGun({
          pos: {
            x: -40,
            y: 40,
          },
          source: this._id,
        });
        const plasmaGun2 = new PlasmaGun({
          pos: {
            x: -40,
            y: -40,
          },
          source: this._id,
        });
        weapons = [plasmaGun1, plasmaGun2];
        const railGun = new GaussCannon({
          pos: {
            x: 0,
            y: 0,
          },
          source: this._id,
        });
        const photonTorpedo = new PhotonTorpedoLauncher({
          pos: {
            x: 0,
            y: 0,
          },
          source: this._id,
        });
        secondaryWeapons = [photonTorpedo, railGun];
      } catch (err) {
        console.error(err);
      }
    }

    super({
      ...props,
      meshes: [
        shieldMesh,
        pointSightMesh,
        mesh,
        phaseShieldMesh,
        secondaryWeaponMesh,
      ],
      weapons: weapons,
      secondaryWeapons: secondaryWeapons,
    });
    this.mass = 7;
  }
}

class Bobcat extends Ship {
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: [
        [-70, 50],
        [-50, 60],
        [70, 0],
        [-50, -60],
        [-70, -50],
        [-30, 0],
        [-70, 50],
      ],
      color: 0xffffff,
      width: 10,
      fill: 0x000000,
    });
    const meshAround = new Mesh({
      kind: Meshes.kPoly,
      vertices: [
        [-70, 50],
        [-50, 60],
        [70, 0],
        [-50, -60],
        [-70, -50],
        [-30, 0],
        [-70, 50],
      ],
      color: 0xffffff,
      width: 10,
    });
    const secondaryWeaponMesh = new Mesh({
      name: "secondaryWeapon",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      color: 0xffffff,
      fill: 0xffffff,
    });
    const primaryWeaponMesh1 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [
        [15, 35],
        [-50, 35],
        [-50, 25],
        [15, 25],
      ],
      fill: 0xffffff,
    });
    const primaryWeaponMesh2 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [
        [15, -35],
        [-50, -35],
        [-50, -25],
        [15, -25],
      ],
      fill: 0xffffff,
    });
    let weapons = [];
    super({
      ...props,
      meshes: [
        mesh,
        secondaryWeaponMesh,
        primaryWeaponMesh1,
        primaryWeaponMesh2,
        meshAround,
      ],
      weapons: weapons,
    });
    try {
      /*const plasmaGun1 = new PlasmaGun({
        pos: {
          x: -30,
          y: 50,
        },
      });
      const plasmaGun2 = new PlasmaGun({
        pos: {
          x: -30,
          y: -50,
        },
      });*/
      const massDriverGun1 = new MassDriverGun({
        pos: {
          x: -30,
          y: 50,
        },
        source: this._id,
      });
      const massDriverGun2 = new MassDriverGun({
        pos: {
          x: -30,
          y: -50,
        },
        source: this._id,
      });
      weapons = [massDriverGun1, massDriverGun2];
      this.weapons = weapons;
    } catch (err) {
      console.error(err);
    }

    this.mass = 10;
  }
}
