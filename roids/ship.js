export { Ship }

import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";


class Ship {
  constructor(props) {
    this.x = props.x;
    this.y = props.y;
    this.vx = props.vx ?? 0;
    this.vy = props.vy ?? 0;
    this.r = props.r ?? 0;

    this.pres = new Graphics();
    const path = [-70, 50, 70, 0, -70, -50, -30, 0, -70, 50];
    this.pres.poly(path);

    this.pres.scale.set(0.1);
    this.pres.stroke({ color: 0xffffff, width: 10 });
  }



  update(delta) {
    this.x += this.vx * delta.deltaTime;
    this.y += this.vy * delta.deltaTime;
    this.pres.rotation = this.r;
    this.pres.x = this.x
    this.pres.y = this.y; 
  }
}
