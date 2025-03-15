export { PhotonTorpedoLauncher };

import { Gun } from "./weaponBase.js";
import { Mesh, Meshes } from "../mesh.js";
import { Graphics } from "../../libs/3rdparty/pixi.mjs";
import { rotate } from "../math.js";
import { Base1 } from "../base.js";

import { seededRnd } from "../rnd.js";

class PhotonTorpedoLauncher extends Gun {
  static kind = "PhotonTorpedo"; // TODO make an object with these constants
  kind = PhotonTorpedoLauncher.kind;
  html = "Pt"; // Asterisk alignment
  ammo = true;
  static baseStats = {
    // Energy, no mass usage really
    minRange: 1500,
    baseE: 1000,
    ACCEL: 20,
    ammoRefreshRate: 0.00001,
  };
  baseStats = PhotonTorpedoLauncher.baseStats;
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
  }

  fire(shooter, bulletList) {
    console.log("Firing torpedo");
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    if ((shooter.ammo[PhotonTorpedoLauncher.kind] ?? 0) < 1) {
      return;
    }
    // Photon torpedos will eventually be tracking, so this will need more information somehow.
    const spread = 0;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = PhotonTorpedoLauncher.baseStats.ACCEL * ivx + shooter.vel.x;
    const vy = PhotonTorpedoLauncher.baseStats.ACCEL * ivy + shooter.vel.y;
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
      e: PhotonTorpedoLauncher.baseStats.baseE,
      minRange: PhotonTorpedoLauncher.baseStats.minRange,
      scale: shooter.scale,
      source: this.source,
    });
    console.log(b);
    bulletList.push(b);
    shooter.ammo[PhotonTorpedoLauncher.kind]--;
  }
}

class PhotonTorpedo extends Base1 {
  constructor(props) {
    const numMeshes = 10;
    let meshes = [];
    const baseColor = 0xffee77;

    for (let i = 0; i < numMeshes; i++) {
      const radius = Math.random() * 10 + 10;
      let vertices = [];
      for (let j = 0; j < 3; j++) {
        const angle = Math.random() * 2 * Math.PI;
        vertices.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
      }

      const mesh = new Mesh({
        kind: Meshes.kPoly,
        vertices: vertices,
        color: baseColor,
        fill: { color: baseColor, alpha: 0xff * (0.3 * Math.random() + 0.7) },
      });
      meshes.push(mesh);
    }

    super({ ...props, meshes: meshes });
    this.e = props.e ?? 10;
    this.mass = props.mass ?? 3;
    this.minRange = props.minRange ?? 1500;
    this.moved = 0;
    this.source = props.source ?? -1;
  }

  generate() {
    let p = new Graphics();
    p.circle(0, 0, 10);
    p.fill(0xff0000);
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
    this.e -= Math.random() * 0.1;
    const ne = Math.max(0, Math.min(1, this.e / 1000));
    this.moved += Math.abs(this.vel.x) + Math.abs(this.vel.y);
    if (this.moved > this.minRange) {
      this.e -= 10;
    }

    for (let i = 0; i < this.presentations.length; i++) {
      const red = ne * (0.9 + 0.1 * Math.random()) * 0xff; // Cools to red
      const green = ne * (0.6 + 0.2 * Math.random()) * 0xff;
      const blue = ne * (0.3 + 0.5 * Math.random()) * 0xff;
      const hexColor = (red << 16) | (green << 8) | blue;
      const presentation = this.presentations[i];
      const alpha = Math.random() * 155;
      if (!presentation || presentation.destroyed) {
        this.presentations[i] = { destroyed: true };
        continue;
      }
      presentation.rotation = Math.random() * Math.PI * 2;

      presentation.tint = hexColor;
      presentation.alpha = alpha;
    }
  }
}
