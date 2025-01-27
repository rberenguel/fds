export { Bullet }

import { rotate } from "./math.js"
import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";

class Bullet{
  constructor(props={}){
    const accel = 5;
    const rf = Math.random();
    const r = 0.01 + 0.01 * rf;
    this.x = props.x
    this.y = props.y
    console.log(props.d)
    this.vx = accel * Math.cos(props.d) * rf
    this.vy = accel * Math.sin(props.d) * rf
    this.e = props.e ?? 10
    const [nvx, nvy] = rotate(this.vx, this.vy, r);
    this.vx = nvx;
    this.vy = nvy;
    const bullet = new Graphics();
    const path = [0, 0, 3, -2, 3, 2];
    bullet.poly(path);
    bullet.fill(0x00ffff);
    bullet.x = this.x;
    bullet.y = this.y;
    this.pres = bullet;
  }

  update(){
    this.pres.x += this.vx;
    this.pres.y += this.vy;
    this.e -= 0.3;
    if(this.e <= 0.1){
      this.e = 0;
      this.pres.destroy()
    }
    const ne = Math.max(0, Math.min(1, this.e / 10));
    const red = 0;
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne);
    const hexColor = (red << 16) | (green << 8) | blue;
    this.pres.tint = hexColor;
  }
}


