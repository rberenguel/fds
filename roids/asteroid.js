export { Asteroid }

import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";

import { dist } from "./math.js"

class Asteroid {
  constructor(center, velocity, sides, size, spin) {
    this.x = center.x; // Assuming center has x and y properties
    this.y = center.y;
    this.vx = velocity.x; // Assuming velocity has x and y properties
    this.vy = velocity.y;
    this.sides = sides;
    this.size = size;
    this.spin = spin;
    this.energy = Math.floor(0.8 * sides * size); // Use Math.floor() for integer
    console.log(size)

    // Create the graphical representation using PIXI.Graphics
    const ast = new Graphics();
    this.vertices = this.getVertices()
    ast.poly(this.vertices);
    ast.fill({color: 0x808080});     // Dark grey fill (adjust color as needed)
    this.pres = ast
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
    console.log(path)
    return path
    // Draw the polygon
    //this.pres.lineStyle(10, 0xffffff); // White stroke, 10px width
        // Set initial position and scale
    //this.pres.position.set(this.x, this.y);
    //this.pres.scale.set(0.2); // Adjust scale as needed
  }

  // Add an update method to handle movement and rotation
  update(delta) {
    this.x += this.vx * delta.deltaTime;
    this.y += this.vy * delta.deltaTime;
    this.pres.rotation += 0.5*this.spin * delta.deltaTime; 
    this.pres.x = this.x
    this.pres.y = this.y; 
 
  }
}
