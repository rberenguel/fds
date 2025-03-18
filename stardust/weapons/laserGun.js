export { LaserGun };

import { Gun } from "./weaponBase.js";
import { rotate } from "../math.js";
import { Base1 } from "../base.js";
import { Mesh, Meshes } from "../mesh.js";
import { seededRnd } from "../rnd.js";

class LaserGun extends Gun {
  static kind = "LaserGun";
  kind = "LaserGun";
  firerate = 50;
  html = "Lg";
  static baseStats = {
    // Energy, no mass use really
    minRange: 3500,
    baseE: 20,
    decay: 0.3,
    ACCEL: 100,
    ammoRefreshRate: 0.05,
  };
  ammo = true;
  ammoMax = 10;
  // Although it's an energy weapon, it uses a lot of energy. Let's treat it as ammo
  static present = () => {
    const stats = LaserGun.baseStats;
    const range = (
      (stats.baseE / LaserGun.baseStats.decay) *
      stats.ACCEL
    ).toFixed(0);
    const mip = LaserGun.baseStats.baseE.toFixed(0);
    const html = `<p>Laser gun</p><hr/><p>Energy (recharging)</p><table><tr><td>Point blank dmg: </td><td>${mip}</td></tr><tr><td>Speed: </td><td>${stats.ACCEL}</td></tr><td>Range: </td><td>${range}</td></tr></table>`;
    return html;
  };
  present() {
    return LaserGun.present();
  }
  constructor(props) {
    super({ ...props });
    this.stats = { ...this.constructor.baseStats };
    this.color = props.color ?? 0x00ccff;
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    if ((shooter.ammo[LaserGun.kind].count ?? 0) <= 1) {
      return;
    }
    if (shooter.disabled > performance.now()) {
      return;
    }
    const spread = 0;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = this.stats.ACCEL * ivx + 0.01 * shooter.vel.x;
    const vy = this.stats.ACCEL * ivy + 0.01 * shooter.vel.y; // Very little affected from player movement
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    const b = new LaserGunShot({
      pos: {
        x: shooter.pos.x + rpx,
        y: shooter.pos.y + rpy,
      },
      vel: {
        x: vx,
        y: vy,
      },
      r: shooter.r,
      e: this.stats.baseE,
      minRange: this.stats.minRange,
      decay: this.stats.decay,
      scale: shooter.scale,
      color: this.color,
      source: this.source,
    });
    bulletList.push(b);
    shooter.ammo[LaserGun.kind].count--;
    if (window.drumSampler && shooter.human) {
      window.drumSampler.triggerAttackRelease("a3", 0.5); // Choke
    }
  }
}

class LaserGunShot extends Base1 {
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: [
        [20, 8],
        [20, -8],
        [-20, -8],
        [-20, 8],
      ],
      color: props.color,
      fill: props.color,
    });
    super({ ...props, meshes: [mesh] });

    this.e = props.e ?? 10;
    this.initialE = this.e;
    this.decay = props.decay ?? 0.15;
    this.mass = props.mass ?? 0.0001;
    this.source = props.source ?? -1;
    this.minRange = props.minRange ?? 2000;
    this.moved = 0;
    this.kind = "kLaserGunShot";
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    this.e -= 0.5;
    this.moved += Math.abs(this.vel.x) + Math.abs(this.vel.y);
    if (this.moved > this.minRange) {
      this.e -= 1000;
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
    }
  }
}
