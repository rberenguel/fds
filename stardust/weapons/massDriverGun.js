export { MassDriverGun, MassDriverBullet };

import { Gun } from "./weaponBase.js";

import { Base1 } from "../base.js";
import { sqnorm, rotate } from "../math.js";
import { Mesh, Meshes } from "../mesh.js";
import { seededRnd } from "../rnd.js";

const rnd = seededRnd(performance.now());

class MassDriverGun extends Gun {
  static ACCEL = 50;
  firerate = 100;
  kind = "MassDriverGun";
  static kind = "MassDriverGun";
  html = "Md"; // Dot
  static baseStats = {
    // Mass, no energy use really
    mass: 0.4,
    ACCEL: 50,
    f: 0.2,
    decay: 0.01,
    ammoRefreshRate: 0.009,
  };
  ammo = true;
  ammoMax = 99;
  static present = () => {
    const stats = MassDriverGun.baseStats;
    const range = ((stats.f / stats.decay) * stats.ACCEL).toFixed(0);
    const mip = (stats.f * stats.mass * stats.ACCEL * stats.ACCEL).toFixed(0);
    const html = `<p>Mass driver</p><hr/><p>Kinetic (needs ammo)</p><table><tr><td>Point blank dmg: </td><td>${mip}</td></tr><tr><td>Mass: </td><td>${stats.mass}</td></tr><tr><td>Speed: </td><td>${stats.ACCEL}</td></tr><td>Range: </td><td>${range}</td></tr></table>`;
    return html;
  };
  present() {
    return MassDriverGun.present();
  }
  constructor(props) {
    super({ ...props });
    this.stats = { ...this.constructor.baseStats };
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    if ((shooter.ammo[MassDriverGun.kind].count ?? 0) < 1) {
      return;
    }
    const rf = rnd();
    const spread = -0.005 + 0.01 * rf;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = this.stats.ACCEL * ivx + shooter.vel.x;
    const vy = this.stats.ACCEL * ivy + shooter.vel.y;
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    const b = new MassDriverBullet({
      pos: {
        x: shooter.pos.x + rpx,
        y: shooter.pos.y + rpy,
      },
      vel: {
        x: vx,
        y: vy,
      },
      r: shooter.r,
      e: this.stats.e,
      f: this.stats.f,
      decay: this.stats.decay,
      mass: this.stats.mass,
      scale: shooter.scale,
      source: this.source,
    });
    bulletList.push(b);
    shooter.ammo[MassDriverGun.kind].count--;
  }
}

class MassDriverBullet extends Base1 {
  // TODO: fire repeat timing
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 5,
      color: 0xffffff,
      fill: 0xffffff,
    });
    super({ ...props, meshes: [mesh] });
    this.f = props.f ?? 0.2; // Multiplying factor for energy
    this.decay = props.decay ?? 0.01;
    this.e = this.f * sqnorm(this.vel.x, this.vel.y) * this.mass;
    this._initial_e = this.e;
    this.mass = props.mass ?? 0.4;
    this.source = props.source ?? -1;
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    this.e = this.f * sqnorm(this.vel.x, this.vel.y) * this.mass;
    this.f -= this.decay;
    const ne = Math.max(0, Math.min(1, this.e / this._initial_e));
    const gray = Math.floor(200 + 55 * ne); // Cools to black

    const hexColor = (gray << 16) | (gray << 8) | gray;
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
