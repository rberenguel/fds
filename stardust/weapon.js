export { PlasmaGun };

import { Base1 } from "./base.js";
import { Mesh, Meshes } from "./mesh.js";
import { dist, sqnorm, rotate } from "./math.js";

class Gun {
  constructor(props) {
    // Still need to find out how to change the angle for spreads.
    this.pos = {
      x: props.pos?.x ?? 0,
      y: props.pos?.y ?? 0,
    };
  }
}

class PlasmaBullet extends Base1 {
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: [
        [12, 0],
        [0, -7],
        [-12, 0],
        [0, 7],
      ],
      color: 0x00ffff,
      fill: 0x00ffff,
    });
    super({ ...props, meshes: [mesh] });
  }

  generate() {
    super.generate();
    //this.presentation.scale.set(this.scale)
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    if (!this.presentation) return;
    if (this.presentation.destroyed) return;
    this.presentation.rotation = this.r;
    this.e -= 0.1;
    const ne = Math.max(0, Math.min(1, this.e / 10));
    const red = 0;
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne);
    const hexColor = (red << 16) | (green << 8) | blue;
    this.presentation.tint = hexColor;
  }
}

class PlasmaGun extends Gun {
  static ACCEL = 20;
  constructor(props) {
    super({ ...props });
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    const rf = Math.random();
    const spread = 0; //-0.01 + 0.02 * rf;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = PlasmaGun.ACCEL * ivx + shooter.vel.x;
    const vy = PlasmaGun.ACCEL * ivy + shooter.vel.y;
    //const [rvx, rvy] = rotate(vx, vy, shooter.r)
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    const b = new PlasmaBullet({
      pos: {
        x: shooter.pos.x + rpx,
        y: shooter.pos.y + rpy,
      },
      vel: {
        x: vx,
        y: vy,
      },
      r: shooter.r,
      e: 12,
      scale: shooter.scale,
    });
    bulletList.push(b);
  }
}
