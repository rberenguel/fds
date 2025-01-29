export { Entity, explode }
import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";


class Entity {
  constructor(x = 0, y = 0, vertices=[], velocity = { x: 0, y: 0 }, spin = 0, r = 0) {
    this.x = x;
    this.y = y;
    this.vertices = vertices; // Array of vertices for drawing
    this.v = velocity; // Assuming velocity has x and y properties
    this.spin = spin;
    this.r = r;
    this.e = 100; // Default energy value

    // Create the graphical representation using PIXI.Graphics
    this.pres = new Graphics();
    this.drawEntity();
  }

  drawEntity() {
    if (this.vertices.length >= 2) {
      let flat = []
      for(let v of this.vertices){
        flat.push(v.x*0.2)
        flat.push(v.y*0.2)
      }
      console.log(flat)
      this.pres.poly(flat);
      this.pres.stroke({color: 0x8080ff}); // Dark grey fill (adjust color as needed)
      this.pres.x = this.x
      this.pres.y = this.y
    }
  }

  update(delta) {
    if(this.pres.destroyed){
      console.log("Destroyed")
      return
    }
     if(this.e <= 0){
       console.log("To destroy")
      this.pres.destroy()
       console.log("Destroyed2")
      this.e = -1
      return
    }
    this.x += this.v.x * delta.deltaTime;
    this.y += this.v.y * delta.deltaTime;
    this.pres.rotation += this.spin * delta.deltaTime;
    this.pres.x = this.x;
    this.pres.y = this.y;
    console.log(this.e)
    this.e -= 0.2
  }
}

function explode(entity) {
  const segments = [];
  const vertices = entity.vertices;

  for (let i = 1; i < vertices.length; i += 2) {  // Increment by 2 to get x, y pairs
    const p = { x: vertices[i - 1], y: vertices[i] };
    const q = { x: vertices[i + 1], y: vertices[i + 2] }; // Get the next point
    const center = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };

    const segment = new Entity(
      center.x + entity.x,
      center.y + entity.y,
      [p, q], // Vertices for the segment
      { x: entity.v.x, y: entity.v.y }, // Use entity's velocity
      Math.random(), // Spin
      entity.r
    );
    segment.e = 12; // Set energy for the segment

    segments.push(segment);
  }
  console.log(segments)
  return segments;
}
