export { Bobcat, Lynx };

import { Mesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";
import {
  GaussCannon,
  MassDriverGun,
  PhotonTorpedoLauncher,
  PlasmaGun,
} from "./weapons/weapons.js";
import { dist, sqnorm, rotate } from "../stardust/math.js";
import { Flame } from "./flame.js";
import { seededRnd } from "./rnd.js";
import { normalizeAngle } from "../stardust/math.js";
const rnd = seededRnd(performance.now());

function shortestAngleDifference(angle1, angle2) {
  let difference = angle1 - angle2;
  const twoPI = 2 * Math.PI;
  while (difference > Math.PI) difference -= twoPI;
  while (difference < -Math.PI) difference += twoPI;
  return difference;
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
    this._id = performance.now();
  }

  action() {
    return;
  }

  explode(props = {}) {
    const minenergy = props.minenergy ?? 12;
    const explenergy = Math.min(Math.max(props.e, 1), 5);
    const pos = props.pos ?? { x: 0, y: 0 };
    const [rpx, rpy] = rotate(pos.x, pos.y, this.r);
    for (let i = 0; i < (props.count ?? 12) * explenergy; i++) {
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
        scale: 0.8,
      });
      this.flameList.push(fl);
    }
  }

  collision(other) {
    // TODO: This could be in Base, somehow?
    // TODO For ship, this is totally made up
    if (dist(other.pos, this.pos) < 50) {
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

    const _vx = this.vel.x + 0.1 * Math.cos(this.r) * f;
    const _vy = this.vel.y + 0.1 * Math.sin(this.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < limit) {
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

    const _vx = this.vel.x - 0.1 * Math.cos(this.r) * f;
    const _vy = this.vel.y - 0.1 * Math.sin(this.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < limit) {
      this.vel.x = _vx;
      this.vel.y = _vy;
      for (let i = 0; i < 3; i++) {
        this._forwardThrust();
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
    this.r += 0.03 * f;
  }

  yawLeft(f = 1) {
    this.r -= 0.03 * f;
  }

  generate() {
    super.generate();
  }

  /* pos would be universe coordinates, then here I need to use screen coordinates */

  update(delta) {
    this.actions = this.actions.slice(-2);
    super.update(delta);
    super.move(delta.deltaTime);
    this.e += this.recoveryRate * delta.deltaTime;
    this.e = Math.min(this.e, this.initialE);
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
    const red = 255; // Red decreases from 255 to 0
    const green = Math.floor(255 * ne); // Green decreases faster
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
      } else {
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
            presentation.alpha = 0.2;
          }
        }
      }
    }
  }
}

class Lynx extends Ship {
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: [
        [-70, 50],
        [70, 0],
        [-70, -50],
        [-30, 0],
        [-70, 50],
      ],
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
    const pointSightMesh = new Mesh({
      name: "pointSight",
      kind: Meshes.kPoly,
      vertices: [
        [20000, 6],
        [20000, -6],
        [0, -6],
        [0, 6],
      ],
      radius: 10,
      color: 0x00ff00,
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
        /*const massDriverGun1 = new MassDriverGun({
          pos: {
            x: -40,
            y: 40,
          },
        });
        const massDriverGun2 = new MassDriverGun({
          pos: {
            x: -40,
            y: -40,
          },
        });*/
        //weapons = [massDriverGun1, massDriverGun2];
      } catch (err) {
        console.error(err);
      }
    }

    super({
      ...props,
      meshes: [pointSightMesh, mesh, secondaryWeaponMesh],
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
    const secondaryWeaponMesh = new Mesh({
      name: "secondaryWeapon",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      color: 0xffffff,
      fill: 0xffffff,
    });
    let weapons = [];
    super({ ...props, meshes: [mesh, secondaryWeaponMesh], weapons: weapons });
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
