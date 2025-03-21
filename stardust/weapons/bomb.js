export { Bomb, dropBomb };

import { Mesh, Meshes } from "../mesh.js";
import { Base1 } from "../base.js";
import { FillGradient } from "../../libs/3rdparty/pixi.mjs";
const dropBomb = (shooter, bulletList) => {
  if (shooter.human) {
    shooter.stats.shots["kBomb"].fired++;
  }
  const b = new Bomb({
    pos: shooter.pos,
    vel: {
      x: 0,
      y: 0,
    },
    scale: shooter.scale,
    source: shooter._id,
  });
  b.shooter = shooter;
  b.firedBy = "kBomb";
  bulletList.push(b);
};

class Bomb extends Base1 {
  constructor(props) {
    let meshes = [];

    for (let i = 1; i <= 20; i++) {
      const mesh = new Mesh({
        kind: Meshes.kCircle,
        center: [0, 0],
        radius: 3 * i,
        color: 0x2089d9,
        width: 2,
        gradienter:
          (mesh, p) =>
          (s1 = 1, s2 = 1) => {
            const colorStops = [0xda9933, 0x999933];
            const gradientFill = new FillGradient(
              -50 * s1,
              -50 * s2,
              50 * s1,
              50 * s2,
            );
            colorStops.forEach((number, index) => {
              const ratio = index / colorStops.length;

              gradientFill.addColorStop(ratio, number);
            });
            p.clear()
              .circle(mesh.center[0], mesh.center[1], mesh.radius)
              .stroke({ fill: gradientFill, width: 2 }); //, width: mesh.width ?? 4 });
          },
      });
      mesh.name = "ripple";
      meshes.push(mesh);
    }
    const mesh = new Mesh({
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      fill: 0xcc6600,
    });
    mesh.name = "bomb";
    meshes.push(mesh);
    super({ ...props, meshes: meshes });
    this.e = 5000;
    this.f = props.f ?? 0.2; // Multiplying factor for energy
    this.decay = props.decay ?? 0.2;
    this.source = props.source ?? -1;
    this.baseScale = props.scale ?? 1;
    this.scale = 1;
    this.kind = "kBombBlast";
    this.s = 10; //
    this.radius = 100; // TODO
    this.goOff = performance.now() + 2000;
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    if (this.goOff < performance.now()) {
      this.scale = this.baseScale * (10 - this.s);
      const r = 60 * (10 - this.s);
      this.radius = r;
      this.s -= this.decay * delta.deltaTime;
    }
    if (this.s < 1) {
      this.e = -1;
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
      if (this.goOff > performance.now()) {
        if (presentation.name === "bomb") {
          presentation.alpha = 1;
        }
        if (presentation.name === "ripple") {
          presentation.alpha = 0;
        }
      } else {
        if (presentation.name === "bomb") {
          presentation.alpha = 0;
        }
        if (presentation.name === "ripple") {
          presentation.scale = this.scale;
          presentation.alpha = 0.4 + Math.random() * 0.3;
          presentation.rotation = Math.random() * Math.PI * 2;
        }
      }
    }
  }
}
