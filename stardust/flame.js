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
    this.scale = props.scale ?? 1;
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

    this.e -= 0.3;
    const ne = Math.max(0, Math.min(1, this.e / 10));
    const red = Math.floor(255 * ne); // Red decreases from 255 to 0
    const green = Math.floor(255 * ne * ne); // Green decreases faster
    const blue = 0;
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
