export { Ship }

import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";


class Ship {
  constructor(props) {
    this.x = props.x;
    this.y = props.y;
    this.v = {
      x: props.vx ?? 0,
      y: props.vy ?? 0
    }
    this.r = props.r ?? 0;
    this.e = 1000
    this.vertices = [[-70, 50], [70, 0], [-70, -50], [-30, 0], [-70, 50]];
    this.pres = new Graphics();
    const path = [-70, 50, 70, 0, -70, -50, -30, 0, -70, 50];
    this.pres.poly(path);

    this.pres.scale.set(0.1);
    this.pres.stroke({ color: 0xffffff, width: 10 });
  }

  kind(){
    return "kShip"
  }

  update(delta) {
    if(this.e <= 0.1){
      this.e = 0;
      this.pres.destroy()
      return
    }

    this.x += this.v.x * delta.deltaTime;
    this.y += this.v.y * delta.deltaTime;
    this.pres.rotation = this.r;
    this.pres.x = this.x
    this.pres.y = this.y; 
  }
}
