export { Bobcat, Lynx };

import { Mesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";
import { PlasmaGun } from "./weapon.js";
import { rotate, sqnorm } from "./math.js";

import { Flame } from "./flame.js";
import { seededRnd } from "./rnd.js";

const rnd = seededRnd(performance.now());

class Ship extends Base1 {
  static kind = "kShip";

  constructor(props) {
    super(props);
    this.e = 1000;
    //this.scale = props.scale ?? 1
    this.weapons = props.weapons ?? [];
    this.actions = [];
    this.flameList = []; // TODO: careful with this as a dangling reference
    this.bulletList = [];
  }

  action() {
    return;
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

  backThrust(f = 1) {
    this.actions.push("backThrust");
    const _vx = this.vel.x + 0.1 * Math.cos(this.r) * f;
    const _vy = this.vel.y + 0.1 * Math.sin(this.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < 1e6) {
      this.vel.x = _vx;
      this.vel.y = _vy;
    }
    for (let i = 0; i < 3; i++) {
      this._backThrust();
    }
  }

  _backThrust() {
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
      //scale: this.scale
    });
    this.flameList.push(fl);
  }

  forwardThrust(f = 1) {
    this.actions.push("forwardThrust");
    const _vx = this.vel.x - 0.1 * Math.cos(this.r) * f;
    const _vy = this.vel.y - 0.1 * Math.sin(this.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < 1e6) {
      this.vel.x = _vx;
      this.vel.y = _vy;
    }
    for (let i = 0; i < 3; i++) {
      this._forwardThrust();
    }
  }

  _forwardThrust() {
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
      //scale: this.scale
    });
    this.flameList.push(fl);
  }

  yawRight(f = 1) {
    this.r += 0.03 * f;
  }

  yawLeft(f = 1) {
    console.log(f, this.r);
    this.r -= 0.03 * f;
  }

  generate() {
    super.generate();
    //this.presentation.scale.set(this.scale)
  }

  /* pos would be universe coordinates, then here I need to use screen coordinates */

  update(delta) {
    this.actions = this.actions.slice(-2);
    super.update(delta);
    super.move(delta.deltaTime);
    for (let presentation of this.presentations) {
      presentation.rotation = this.r;
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
    let weapons = [];
    try {
      const plasmaGun1 = new PlasmaGun({
        pos: {
          x: -40,
          y: 40,
        },
      });
      const plasmaGun2 = new PlasmaGun({
        pos: {
          x: -40,
          y: -40,
        },
      });
      weapons = [plasmaGun1, plasmaGun2];
    } catch (err) {
      console.error(err);
    }

    super({ ...props, meshes: [mesh], weapons: weapons });
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
    let weapons = [];
    try {
      const plasmaGun1 = new PlasmaGun({
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
      });
      weapons = [plasmaGun1, plasmaGun2];
    } catch (err) {
      console.error(err);
    }

    super({ ...props, meshes: [mesh], weapons: weapons });
    this.mass = 10;
  }
}
