export { Bobcat, Lynx };

import { Mesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";
import { PlasmaGun } from "./weapon.js";

import { rotate } from "./math.js";

class Flame extends Base1 {
  static ACCEL = 0.4;
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      fill: 0xffff00,
    });
    super({ ...props, meshes: [mesh] });
    this.e = props.e ?? 10;
  }

  generate() {
    super.generate();
    //this.presentation.scale.set(this.scale)
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);

    this.e -= 0.3;
    const ne = Math.max(0, Math.min(1, this.e / 10));
    const red = Math.floor(255 * ne); // Red decreases from 255 to 0
    const green = Math.floor(255 * ne * ne); // Green decreases faster
    const blue = 0;
    const hexColor = (red << 16) | (green << 8) | blue;
    for (let presentation of this.presentations) {
      if (!presentation) return;
      if (presentation.destroyed) return;
      presentation.rotation = this.r;
      presentation.tint = hexColor;
    }
  }
}

class Ship extends Base1 {
  static kind = "kShip";

  constructor(props) {
    super(props);
    this.e = 1000;
    //this.scale = props.scale ?? 1
    this.weapons = props.weapons ?? [];
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

  backThrust(flameList) {
    for (let i = 0; i < 3; i++) {
      this._backThrust(flameList);
    }
  }

  _backThrust(flameList) {
    const rf = Math.random();
    const spread = 0.3 - 0.6 * rf;
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const vx = Flame.ACCEL * ivx + this.vel.x * Math.sqrt(Math.random());
    const vy = Flame.ACCEL * ivy + this.vel.y * Math.sqrt(Math.random());
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
    flameList.push(fl);
  }

  forwardThrust(flameList) {
    for (let i = 0; i < 3; i++) {
      this._forwardThrust(flameList);
    }
  }

  _forwardThrust(flameList) {
    const rf = Math.random();
    const spread = 0.15 - 0.3 * rf;
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const vx = Flame.ACCEL * ivx + this.vel.x * Math.sqrt(Math.random());
    const vy = Flame.ACCEL * ivy + this.vel.y * Math.sqrt(Math.random());
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
    flameList.push(fl);
  }

  generate() {
    super.generate();
    //this.presentation.scale.set(this.scale)
  }

  /* pos would be universe coordinates, then here I need to use screen coordinates */

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    for (let presentation of this.presentations) {
      presentation.rotation = this.r;
    }
  }
}

class Bobcat extends Ship {
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
  }
}

class Lynx extends Ship {
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
  }
}
