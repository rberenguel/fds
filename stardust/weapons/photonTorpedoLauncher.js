export { PhotonTorpedoLauncher };

import { Gun } from "./weaponBase.js";
import { Mesh, Meshes } from "../mesh.js";
import { Graphics } from "../../libs/3rdparty/pixi.mjs";
import { rotate } from "../math.js";
import { Base1 } from "../base.js";

import { seededRnd } from "../rnd.js";
import { Flame } from "../flame.js";

class PhotonTorpedoLauncher extends Gun {
  static kind = "kPhotonTorpedoLauncher"; // TODO make an object with these constants
  kind = PhotonTorpedoLauncher.kind;
  firerate = 1000; // It's not really a rate and it is annoying me
  html = "Pt"; // Asterisk alignment
  ammo = true;
  ammoMax = 2;
  static baseStats = {
    // Energy, no mass usage really
    minRange: 1500,
    baseE: 1000,
    ACCEL: 50,
    ammoRefreshRate: 0.001,
  };

  static present = () => {
    const stats = PhotonTorpedoLauncher.baseStats;
    const range = stats.minRange;
    const mip = PhotonTorpedoLauncher.baseStats.baseE.toFixed(0);
    const html = `<p>Photon torpedo</p><hr/><p>Kinetic/Energy (needs ammo)</p><table><tr><td>Point blank dmg: </td><td>${mip}</td></tr><tr><td>Speed: </td><td>${stats.ACCEL}</td></tr><td>Min range: </td><td>${range}</td></tr></table>`;
    return html;
  };
  present() {
    return PhotonTorpedoLauncher.present();
  }
  constructor(props) {
    super({ ...props });
    this.stats = { ...this.constructor.baseStats };
    this.color = props.color ?? 0xff0000;
    this.haloColor = props.haloColor ?? 0xffcc33;
  }

  fire(shooter, bulletList) {
    super.fire(shooter, bulletList);
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    if ((shooter.ammo[PhotonTorpedoLauncher.kind].count ?? 0) < 1) {
      return;
    }
    if (shooter.disabled > performance.now()) {
      return;
    }
    if (shooter.shieldsOn()) {
      return;
    }
    // Photon torpedos will eventually be tracking, so this will need more information somehow.
    const spread = 0;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = this.stats.ACCEL * ivx + 0.1 * shooter.vel.x;
    const vy = this.stats.ACCEL * ivy + 0.1 * shooter.vel.y; // Less affected by player speed
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    const b = new PhotonTorpedo({
      mass: 3,
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
      color: this.color,
      haloColor: this.haloColor,
      scale: shooter.scale,
      source: this.source,
      flameList: shooter.flameList,
    });
    b.shooter = shooter;
    b.firedBy = "kPhotonTorpedoLauncher";
    bulletList.push(b);
    if (window.drumSampler && shooter.human) {
      window.drumSampler.triggerAttackRelease("b0", 0.8); // Torpedo, based on Hihat foot stomp
    }
    shooter.ammo[PhotonTorpedoLauncher.kind].count--;
  }
}

class PhotonTorpedo extends Base1 {
  constructor(props) {
    const numMeshes = 10;
    let meshes = [];
    const baseColor = props.haloColor ?? 0xffaa33;
    for (let i = 0; i < numMeshes; i++) {
      const radius = Math.random() * 10 + 15;
      let vertices = [];
      for (let j = 0; j < 3; j++) {
        const angle = Math.random() * 2 * Math.PI;
        vertices.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }

      const mesh = new Mesh({
        kind: Meshes.kPoly,
        vertices: vertices,
        color: baseColor,
        fill: { color: baseColor, alpha: 0.2 * Math.random() + 0.8 },
      });
      meshes.push(mesh);
    }

    super({ ...props, meshes: meshes });
    this.color = props.color ?? 0xff0000;
    this.e = props.e ?? 10;
    this.mass = props.mass ?? 3;
    this.minRange = props.minRange ?? 1000;
    this.moved = 0;
    this.source = props.source ?? -1;
    this.flameList = props.flameList;
    this.kind = "kPhotonTorpedo";
  }

  generate() {
    let p = new Graphics();
    p.circle(0, 0, 12);
    p.fill(this.color);
    this.presentations = [p];
    for (const mesh of this.meshes) {
      let p = new Graphics();
      if (mesh.kind === Meshes.kPoly) {
        p.poly(mesh.flatten());
        if (mesh.fill !== undefined) {
          p.fill(mesh.fill);
        }
        if (mesh.width) {
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
      }
      this.presentations.push(p);
    }

    this.generated = true;
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    if (this.flameList && this.e > 0) {
      const fl = new Flame({
        pos: {
          x: this.pos.x,
          y: this.pos.y,
        },
        vel: {
          x: 0.2 * this.vel.x,
          y: 0.2 * this.vel.y,
        },
        fill: this.haloColor,
        r: 0,
        e: 1,
        scale: 0.8,
        decay: 0.5,
      });
      this.flameList.push(fl);
    }
    this.e -= Math.random() * 0.1;
    const ne = Math.max(0, Math.min(1, this.e / 1000));
    this.moved +=
      Math.abs(this.vel.x * delta.deltaTime) +
      Math.abs(this.vel.y * delta.deltaTime);
    if (this.moved > this.minRange) {
      this.e -= 10;
    }

    for (let i = 0; i < this.presentations.length; i++) {
      const presentation = this.presentations[i];
      const alpha = 0.3 + 0.7 * Math.random();
      if (!presentation || presentation.destroyed) {
        this.presentations[i] = { destroyed: true };
        continue;
      }
      presentation.rotation = Math.random() * Math.PI * 2;

      presentation.alpha = alpha;
    }
  }
}
