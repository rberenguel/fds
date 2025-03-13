export { PlasmaGun, MassDriverGun, GaussCannon, PhotonTorpedoLauncher };

import { Base1 } from "./base.js";
import { Mesh, Meshes } from "./mesh.js";
import { dist, sqnorm, rotate } from "./math.js";
import { Graphics } from "../libs/3rdparty/pixi.mjs";
import { seededRnd } from "./rnd.js";

const rnd = seededRnd(performance.now());

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
    this.e = props.e ?? 10;
    this.mass = props.mass ?? 3;
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    this.e -= Math.random() * 0.15 + 0.1;
    const ne = Math.max(0, Math.min(1, this.e / 10));
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
    this.e = this.f * sqnorm(this.vel.x, this.vel.y) * this.mass;
    this._initial_e = this.e;
    this.mass = props.mass ?? 0.4;
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    this.e = this.f * sqnorm(this.vel.x, this.vel.y) * this.mass;
    this.f -= 0.01;
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

class PlasmaGun extends Gun {
  kind = "PlasmaGun";
  html = "&#9732;"; // Comet;
  static ACCEL = 20;
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
    const vx = PlasmaGun.ACCEL * ivx + shooter.vel.x;
    const vy = PlasmaGun.ACCEL * ivy + shooter.vel.y;
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
      e: 10,
      scale: shooter.scale,
    });
    bulletList.push(b);
  }
}

class MassDriverGun extends Gun {
  static ACCEL = 50;
  kind = "MassDriverGun";
  html = "&#9679;"; // Dot
  constructor(props) {
    super({ ...props });
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    if (shooter.massDriverAmmo <= 0) {
      return;
    }
    const rf = rnd();
    const spread = -0.005 + 0.01 * rf;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = MassDriverGun.ACCEL * ivx + shooter.vel.x;
    const vy = MassDriverGun.ACCEL * ivy + shooter.vel.y;
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
      e: 10,
      scale: shooter.scale,
    });
    bulletList.push(b);
    shooter.massDriverAmmo--;
  }
}

class GaussCannon extends Gun {
  kind = "GaussCannon"; // TODO make an object with these constants
  html = "&#9678;"; // Fisheye
  static ACCEL = 250;
  constructor(props) {
    super({ ...props });
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.
    const rf = rnd();
    const spread = -0.0005 + 0.001 * rf;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = MassDriverGun.ACCEL * ivx + shooter.vel.x;
    const vy = MassDriverGun.ACCEL * ivy + shooter.vel.y;
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    const b = new MassDriverBullet({
      f: 1,
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
      e: 10,
      scale: shooter.scale,
    });
    bulletList.push(b);
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
    this.moved = 0;
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
    if (this.moved > 1500) {
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

class PhotonTorpedoLauncher extends Gun {
  kind = "PhotonTorpedo"; // TODO make an object with these constants
  html = "&#8251;"; // Asterisk alignment
  static ACCEL = 20;
  constructor(props) {
    super({ ...props });
  }

  fire(shooter, bulletList) {
    // Shooter is a reference to whoever is shooting, so we can take
    // direction and velocity vector.

    // Photon torpedos will eventually be tracking, so this will need more information somehow.
    const spread = 0;
    const ivx = Math.cos(shooter.r + spread);
    const ivy = Math.sin(shooter.r + spread);
    const vx = PhotonTorpedoLauncher.ACCEL * ivx + shooter.vel.x;
    const vy = PhotonTorpedoLauncher.ACCEL * ivy + shooter.vel.y;
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
      e: 1000,
      scale: shooter.scale,
    });
    bulletList.push(b);
  }
}
