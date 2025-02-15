export { Entity, explode };
import { Graphics } from "../libs/3rdparty/pixi.mjs";

import { dist, sqnorm, rotate } from "./math.js";

import { seededRnd } from "../stardust/rnd.js";

const rnd = seededRnd(performance.now());

// TODO: converted from C++ by Gemini, needs fixes
class Entity {
  constructor(
    x = 0,
    y = 0,
    vertices = [],
    velocity = { x: 0, y: 0 },
    spin = 0,
    r = 0,
  ) {
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
      let flat = [];
      for (let v of this.vertices) {
        flat.push(v.x * 0.2);
        flat.push(v.y * 0.2);
      }
      this.pres.poly(flat);
      // TODO: add colors to entities
      this.pres.stroke({ color: 0xff0000 });
      this.pres.x = this.x;
      this.pres.y = this.y;
    }
  }

  update(delta) {
    this.e -= 0.2;
    if (this.pres.destroyed) {
      return;
    }
    if (this.e <= 0) {
      this.pres.destroy();
      this.e = -1;
      return;
    }
    const ne = Math.max(0, Math.min(1, this.e / 20));

    const red = Math.floor(255 * ne); // Red decreases from 255 to 0
    const green = Math.floor(255 * ne * ne); // Green decreases faster
    const blue = 0;

    const hexColor = (red << 16) | (green << 8) | blue;
    this.pres.tint = hexColor;

    this.x += this.v.x; //* delta.deltaTime;
    this.y += this.v.y; //* delta.deltaTime;
    this.pres.rotation += this.spin * delta.deltaTime;
    this.pres.x = this.x;
    this.pres.y = this.y;
  }
}

function explode(entity) {
  const segments = [];
  const vertices = entity.vertices;

  for (let i = 1; i < vertices.length; i += 2) {
    // Increment by 2 to get x, y pairs
    const p = { x: vertices[i - 1], y: vertices[i] };
    const q = { x: vertices[i + 1], y: vertices[i + 2] }; // Get the next point
    const center = { x: (p.x + q.x) / 2, y: (p.y + q.y) / 2 };
    // Each segment needs to go in the direction e.c -> s.c (from the relative coordinates!)
    let vx = center.x,
      vy = center.y;
    const nv = Math.sqrt(sqnorm(vx, vy));
    vx /= nv;
    vy /= nv;
    const segment = new Entity(
      entity.x,
      entity.y,
      [p, q], // Vertices for the segment
      { x: entity.v.x + vx, y: entity.v.y + vy }, // Use entity's velocity
      0.02 * rnd(), // Spin
      entity.r,
    );
    segment.e = 20; // Set energy for the segment

    segments.push(segment);
  }
  return segments;
}
