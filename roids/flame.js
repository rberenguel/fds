export { Flame }

import { rotate } from "./math.js"
import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";

class Flame{
  constructor(props={}){
    const accel = 0.3;
    const rf = Math.random();
    const r = 0.3 - 0.6 * rf;
    this.x = props.x
    this.y = props.y
    this.vx = props.vx + accel * Math.cos(props.d) * rf
    this.vy = props.vy + accel * Math.sin(props.d) * rf
    this.e = props.e ?? 10
    const [nvx, nvy] = rotate(this.vx, this.vy, r);
    this.vx = nvx;
    this.vy = nvy;
    const flame = new Graphics();
    flame.moveTo(this.x, this.y);
    flame.circle(0, 0, 1, 1);
    flame.fill(0xffff00);
    flame.x = this.x;
    flame.y = this.y;
    this.pres = flame;
  }

  kind(){
    return "kFlame"
  }

  update(){
    this.pres.x += this.vx;
    this.pres.y += this.vy;
    this.e -= 0.3;
    if(this.e <= 0.1){
      this.e = 0;
      this.pres.destroy()
      this.pres = null
      return
    }
    const ne = Math.max(0, Math.min(1, this.e / 10));

    const red = Math.floor(255 * ne); // Red decreases from 255 to 0
    const green = Math.floor(255 * Math.pow(ne, 2)); // Green decreases faster
    const blue = 0;

    const hexColor = (red << 16) | (green << 8) | blue;
    this.pres.tint = hexColor;
  }
}


