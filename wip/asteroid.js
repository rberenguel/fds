export { Asteroid }

import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";

import { dist, sqnorm, rotate } from "./math.js"

class Asteroid {
  constructor(center, velocity, sides, size, spin) {
    this.x = center.x; // Assuming center has x and y properties
    this.y = center.y;
    this.v = {
      x: velocity.x,
      y: velocity.y,
    }
    this.vx = velocity.x; // Assuming velocity has x and y properties
    this.vy = velocity.y;
    this.sides = sides;
    this.size = size;
    this.spin = spin;
    this.e = Math.floor(0.1 * sides * size); // Use Math.floor() for integer

    // Create the graphical representation using PIXI.Graphics
    const ast = new Graphics();
    this.vertices = this.getVertices()
    ast.poly(this.vertices);
    ast.fill({color: 0x808080});     // Dark grey fill (adjust color as needed)
    this.pres = ast
    this.pres.x = this.x
    this.pres.y = this.y; 
   }

  addCrack(from){
    if(this.e <= 0){
      return false
    }
    if(Math.random() > from.e){
      return false
    }
    let vx = this.x - from.x, vy = this.y - from.y
    const nsq = Math.sqrt(sqnorm(vx, vy))
    if(nsq < 1e-3){
      return false
    }
    vx /= nsq
    vy /= nsq
    const s = 0.4 * this.size * Math.random()
    const p0x = from.x-this.x, p0y = from.y-this.y
    const q0x = from.x-this.x + s*vx, q0y = from.y-this.y + s*vy
    const [p1x, p1y] = rotate(p0x, p0y, -this.pres.rotation)
    const [q1x, q1y] = rotate(q0x, q0y, -this.pres.rotation)
    const verts = [p1x, p1y, q1x, q1y]
    this.pres.poly(verts)
    const red = Math.floor(10 + 80 * Math.random());
    const hexColor = (red << 16);
    this.pres.stroke({color: hexColor})
    console.log(from.e)
    this.e-= Math.max(2, from.e)
    if(this.e <= 0){
      // It's not exactly normal, why?
      //const [rvx, rvy] = rotate(vx, vy, -this.pres.rotation)
      this.e = -1
      const a = this
      this.pres.destroy()
      if(a.size / 2 < 5){
        return false
      }
      const a1 = new Asteroid({x: a.x, y: a.y}, {x: -vy, y: vx}, a.sides, a.size/2, a.spin)
      const a2 = new Asteroid({x: a.x, y: a.y}, {x: vy, y: -vx}, a.sides, a.size/2, a.spin)
      return [a1, a2]
    }
    return false
  }

  collision(other){
    if(dist(other, this) < 1.05*this.size){
      return true
    }
    return false
  }

  getVertices() {
    let path = [];
    const a = Math.PI * 2 / this.sides;
    for (let i = 0; i < this.sides; i++) {
      const wiggled = i * a + 0.3 * a + 0.6 * a * (Math.random());
      const radius = this.size + this.size * 0.1 * (Math.random());
      const x = radius * Math.cos(wiggled);
      const y = radius * Math.sin(wiggled);
      path.push(x, y);
    }
    return path
  }

  // Add an update method to handle movement and rotation
  update(delta) {
    if(this.pres.destroyed){
      return
    }
    this.x += this.vx * delta.deltaTime;
    this.y += this.vy * delta.deltaTime;
    this.pres.rotation += 0.5*this.spin * delta.deltaTime; 
    this.pres.x = this.x
    this.pres.y = this.y; 
 
  }
}
