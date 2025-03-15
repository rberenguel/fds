export { PlasmaGun };

import { Gun } from "./weaponBase.js";
import { rotate } from "../math.js";
import { Base1 } from "../base.js";
import { Mesh, Meshes } from "../mesh.js";
import { seededRnd } from "../rnd.js";

const rnd = seededRnd(performance.now());

class PlasmaGun extends Gun {
  static kind = "PlasmaGun";
  kind = "PlasmaGun";
  firerate = 50;
  html = "Pg";
  static baseStats = {
    // Energy, no mass use really
    baseE: 20,
    decay: 0.5,
    ACCEL: 40,
  };
  ammo = false;
  baseStats = PlasmaGun.baseStats;
  static present = () => {
    const stats = PlasmaGun.baseStats;
    const range = (
      (stats.baseE / PlasmaGun.baseStats.decay) *
      stats.ACCEL
    ).toFixed(0);
    const mip = PlasmaGun.baseStats.baseE.toFixed(0);
    const html = `<p>Plasma gun</p><hr/><p>Energy (no ammo)</p><table><tr><td>Point blank dmg: </td><td>${mip}</td></tr><tr><td>Speed: </td><td>${stats.ACCEL}</td></tr><td>Range: </td><td>${range}</td></tr></table>`;
    return html;
  };
  present() {
    return PlasmaGun.present();
  }
  constructor(props) {
    super({ ...props });
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    const rf = rnd();
    const spread = -0.01 + 0.02 * rf;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = PlasmaGun.baseStats.ACCEL * ivx + shooter.vel.x;
    const vy = PlasmaGun.baseStats.ACCEL * ivy + shooter.vel.y;
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
      e: PlasmaGun.baseStats.baseE,
      decay: PlasmaGun.baseStats.decay,
      scale: shooter.scale,
      source: this.source,
    });
    bulletList.push(b);
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

    this.e = props.e ?? 10;
    this.initialE = this.e;
    this.decay = props.decay ?? 0.15;
    this.mass = props.mass ?? 1;
    this.source = props.source ?? -1;
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    this.e -= 0.5 * (Math.random() * this.decay + this.decay);
    const ne = Math.max(0, Math.min(1, this.e / this.initialE));
    const red = Math.floor(255 * (1 - ne)); // Cools to red
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne * ne);
    const hexColor = (red << 16) | (green << 8) | blue;
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
      presentation.tint = hexColor;
    }
  }
}
