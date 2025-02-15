export { Bullet };

import { rotate } from "./math.js";
import { Graphics } from "../libs/3rdparty/pixi.mjs";
import { seededRnd } from "./rnd.js";

const rnd = seededRnd(performance.now());
class Bullet {
  constructor(props = {}) {
    const accel = 5;
    const rf = rnd();
    const r = -0.01 + 0.02 * rf;
    this.x = props.x;
    this.y = props.y;
    this.v = {
      x: accel * Math.cos(props.d) * rf,
      y: accel * Math.sin(props.d) * rf,
    };
    this.e = props.e ?? 10;
    const [nvx, nvy] = rotate(this.v.x, this.v.y, r);
    this.v.x = nvx;
    this.v.y = nvy;
    const bullet = new Graphics();
    const path = [0, 0, 3, -2, 3, 2];
    bullet.poly(path);
    bullet.fill(0x00ffff);
    bullet.x = this.x;
    bullet.y = this.y;
    this.pres = bullet;
  }

  kind() {
    return "kBullet";
  }

  update() {
    this.x += this.v.x;
    this.y += this.v.y;
    this.pres.x = this.x;
    this.pres.y = this.y;
    this.e -= 0.3;
    if (this.e <= 0.1) {
      this.e = 0;
      this.pres.destroy();
    }
    const ne = Math.max(0, Math.min(1, this.e / 10));
    const red = 0;
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne);
    const hexColor = (red << 16) | (green << 8) | blue;
    this.pres.tint = hexColor;
  }
}
