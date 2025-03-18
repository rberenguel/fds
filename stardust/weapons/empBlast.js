export { EmpBlast, dropEmp };

import { sqnorm, rotate } from "../math.js";
import { Mesh, Meshes } from "../mesh.js";
import { seededRnd } from "../rnd.js";
import { Base1 } from "../base.js";
import { FillGradient } from "../../libs/3rdparty/pixi.mjs";
const dropEmp = (shooter, bulletList) => {
  const b = new EmpBlast({
    pos: shooter.pos,
    vel: {
      x: 0,
      y: 0,
    },
    scale: shooter.scale,
    source: shooter._id,
  });
  bulletList.push(b);
};

class EmpBlast extends Base1 {
  constructor(props) {
    let meshes = [];

    for (let i = 1; i <= 10; i++) {
      const mesh = new Mesh({
        kind: Meshes.kCircle,
        center: [0, 0],
        radius: 10 * i,
        color: 0x838ff7,
        width: 2,
        gradienter:
          (mesh, p) =>
          (s1 = 1, s2 = 1) => {
            const colorStops = [0x00ff00, 0x000000];
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
      meshes.push(mesh);
    }
    super({ ...props, meshes: meshes });
    this.e = 100;
    this.f = props.f ?? 0.2; // Multiplying factor for energy
    this.decay = props.decay ?? 0.1;
    this.source = props.source ?? -1;
    this.baseScale = props.scale ?? 1;
    this.kind = "kEmpBlast";
    this.s = 10; //
    this.radius = 100; // TODO
  }

  generate() {
    super.generate();
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    this.scale = this.baseScale * (10 - this.s);
    const r = 100 * (10 - this.s);
    this.radius = r;
    this.s -= this.decay * delta.deltaTime;
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
      presentation.scale = this.scale;
      presentation.alpha = 0.4 + Math.random() * 0.3;
      presentation.rotation = Math.random() * Math.PI * 2;
    }
  }
}
