export { GaussCannon };
import { Gun } from "./weaponBase.js";
import { MassDriverBullet } from "./massDriverGun.js";
import { rotate } from "../math.js";

import { seededRnd } from "../rnd.js";

const rnd = seededRnd(performance.now());

class GaussCannon extends Gun {
  kind = "GaussCannon"; // TODO make an object with these constants
  static kind = "GaussCannon"; // TODO make an object with these constants
  firerate = 1000;
  html = "Gc"; // Fisheye
  static baseStats = {
    mass: 5,
    ACCEL: 80,
    f: 1,
    decay: 0.01,
    ammoRefreshRate: 0.0005,
  };
  ammo = true;
  ammoMax = 2;
  static present = () => {
    const stats = GaussCannon.baseStats;
    const range = ((stats.f / stats.decay) * stats.ACCEL).toFixed(0);
    const mip = (stats.f * stats.mass * stats.ACCEL * stats.ACCEL).toFixed(0);
    const html = `<p>Gauss cannon</p><hr/><p>Kinetic (needs ammo)</p><table><tr><td>Point blank dmg: </td><td>${mip}</td></tr><tr><td>Mass: </td><td>${stats.mass}</td></tr><tr><td>Speed: </td><td>${stats.ACCEL}</td></tr><td>Range: </td><td>${range}</td></tr></table>`;
    return html;
  };
  present() {
    return GaussCannon.present();
  }
  constructor(props) {
    super({ ...props });
    this.stats = { ...this.constructor.baseStats };
    this.color = 0xffffff;
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    if ((shooter.ammo[GaussCannon.kind].count ?? 0) < 1) {
      return;
    }
    if (shooter.disabled > performance.now()) {
      return;
    }
    const rf = rnd();
    const spread = -0.0005 + 0.001 * rf;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = this.stats.ACCEL * ivx + shooter.vel.x;
    const vy = this.stats.ACCEL * ivy + shooter.vel.y;
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    const b = new MassDriverBullet({
      f: 1,
      mass: this.stats.mass,
      pos: {
        x: shooter.pos.x + rpx,
        y: shooter.pos.y + rpy,
      },
      vel: {
        x: vx,
        y: vy,
      },
      r: shooter.r,
      f: this.stats.f,
      decay: this.stats.decay,
      e: 1,
      scale: shooter.scale,
      source: this.source,
      flameList: shooter.bulletList,
    });
    shooter.ammo[GaussCannon.kind].count--;
    b.kind = "kGaussCannonBullet"; // TODO: unify these constants somewhere
    bulletList.push(b);
    if (window.drumSampler && shooter.human) {
      window.drumSampler.triggerAttackRelease("f0", 0.5); // Crash
    }
  }
}
