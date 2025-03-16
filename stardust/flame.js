export { Flame };
import { Mesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";

class Flame extends Base1 {
  static ACCEL = 0.4;
  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      fill: props.fill ?? 0xffff00,
    });
    super({ ...props, meshes: [mesh] });
    this.e = props.e ?? 10;
    this.initialE = this.e;
    this.scale = props.scale ?? 1;
    this.fill = props.fill;
    this.decay = props.decay ?? 0.3;
  }

  generate() {
    super.generate();
    for (let presentation of this.presentations) {
      presentation.scale.set(this.scale);
    }
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);

    this.e -= this.decay;
    const ne = Math.max(0, Math.min(1, this.e / this.initialE));
    let hexColor;
    if (this.fill) {
      const r = (this.fill >> 16) & 0xff;
      const g = (this.fill >> 8) & 0xff;
      const b = this.fill & 0xff;
      const scaledR = Math.floor(r * ne);
      const scaledG = Math.floor(g * ne);
      const scaledB = Math.floor(b * ne);
      hexColor = (scaledR << 16) | (scaledG << 8) | scaledB;
    } else {
      const red = Math.floor(255 * ne); // Red decreases from 255 to 0
      const green = Math.floor(255 * ne * ne); // Green decreases faster
      const blue = 0;
      hexColor = (red << 16) | (green << 8) | blue;
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
      presentation.tint = hexColor;
    }
  }
}
