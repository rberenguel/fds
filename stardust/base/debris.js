import { Graphics } from "../../libs/3rdparty/pixi.mjs";
import { Base1 } from "../base.js";
import { Mesh, Meshes } from "../mesh.js";

export { Debris, kinds, shipDebrisFilter };

const shipDebrisFilter = (d) => d.kind === "kShipDebris";

const kinds = {
  kShipDebris: "kShipDebris",
  kAsteroidDebris: "kAsteroidDebris",
};

class Debris extends Base1 {
  constructor(props = {}) {
    const meshes = Debris.getMeshes(props.kind, props.vertices, props.width);
    super({ ...props, meshes: meshes });
    this.kind = props.kind;
    this.vertices = props.vertices;
    this.e = 100;
    this.initialE = 100;
    this.decay = 0.01;
    if (this.kind === kinds.kAsteroidDebris) {
      this.e = 200;
      this.initialE = 200;
    }
    this.width = props.width;
    this.color = props.color;
  }

  static getMeshes(kind, vertices, width) {
    let meshes = [];
    for (let i = 1; i < vertices.length; i++) {
      const v0 = vertices[i - 1];
      const v1 = vertices[i];
      const mesh = new Mesh({
        kind: Meshes.kLine,
        vertices: [v0, v1],
        color: 0xffffff,
        width: width ?? 10,
      });

      meshes.push(mesh);
    }
    return meshes;
  }

  generate() {
    this.presentations = [];
    for (const mesh of this.meshes) {
      let p = new Graphics();
      if (mesh.kind === Meshes.kLine) {
        p.moveTo(...mesh.vertices[0]);
        p.lineTo(...mesh.vertices[1]);
        if (mesh.width) {
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
        if (mesh.gradienter) {
          mesh.gradienter(mesh, p)();
          p.gradienter = mesh.gradienter(mesh, p);
        }
        p.pivot.x = (mesh.vertices[1][0] + mesh.vertices[0][0]) / 2;
        p.pivot.y = (mesh.vertices[1][1] + mesh.vertices[0][1]) / 2;
        p.rotation = this.r;
      }
      p.shiftX = 0;
      p.shiftY = 0;
      p.shiftR = 0;
      if (this.kind === kinds.kAsteroidDebris) {
        p.rSpeed = 0.02;
        p.shiftSpeed = 0.9 + 0.9 * Math.random();
      } else {
        p.rSpeed = 0.01;
        p.shiftSpeed = 0.1 + 0.5 * Math.random();
      }

      p.shiftSpeedDecay = 0.001;
      p.rSpeedDecay = 0.00005;
      this.presentations.push(p);
    }
    this.generated = true;
  }

  update(delta) {
    if (this.e <= 0.1) {
      this.e = -1;
      for (let presentation of this.presentations) {
        if (!presentation || presentation.destroyed) {
          continue;
        }
        presentation.destroy();
        presentation = null;
        this.destroyed = true;
      }
      return;
    }
    const t = delta.deltaTime;
    for (let i = 0; i < this.presentations.length; i++) {
      let p = this.presentations[i];
      if (p != null && !p.destroyed) {
        const a = -this.r + (Math.PI * i) / this.presentations.length;
        p.shiftX += p.shiftSpeed * Math.cos(a) * t;
        p.shiftY += p.shiftSpeed * Math.sin(a) * t;
        p.shiftR += p.rSpeed * t;
        p.shiftSpeed = Math.max(0.001, p.shiftSpeed - p.shiftSpeedDecay * t);
        p.rSpeed = Math.max(0.0007, p.rSpeed - p.rSpeedDecay * t);
        p.x = this.pos.x - this.viewframe.pos.x + p.shiftX;
        p.y = this.pos.y - this.viewframe.pos.y + p.shiftY;
        p.rotation = p.shiftR;
      }
    }
    super.move(t);

    this.e -= 0.1;
    if (this.kind === kinds.kShipDebris) {
      this.e = Math.max(1, this.e);
    }
    const ne = Math.max(0, Math.min(1, this.e / this.initialE));
    const g = (this.kind === kinds.kShipDebris ? 100 : 0) + 155 * ne;
    const hexColor = (g << 16) | (g << 8) | g;
    for (let presentation of this.presentations) {
      if (!presentation) {
        this.presentation = { destroyed: true };
        return;
      }
      if (presentation.destroyed) {
        this.presentation = { destroyed: true };
        return;
      }
      presentation.tint = hexColor;
    }
  }
}
