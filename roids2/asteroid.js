export { Asteroid };

import { Base1 } from "../stardust/base.js";
import { Mesh, Meshes } from "../stardust/mesh.js";
import { dist, sqnorm, rotate } from "../stardust/math.js";
import { Flame } from "../stardust/flame.js";
import { seededRnd } from "../stardust/rnd.js";

const rnd = seededRnd(performance.now());

class Asteroid extends Base1 {
  static ACCEL = 0.4;
  constructor(props) {
    const size = props.size;
    const sides = props.sides;
    const vertices = Asteroid.getVertices(size, sides);
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: vertices,
      color: 0xffffff,
      fill: 0x808080,
    });

    super({ ...props, meshes: [mesh] });
    this.vel = props.vel;
    this.vertices = vertices;
    this.size = props.size;
    this.sides = props.sides;
    this.spin = props.spin;
    this.e = Math.floor(0.1 * sides * size);
    this.mass = sides * size;
    this.flameList = []; // For explosions
    this.bulletList = []; // Dummy, but needed for the loops
  }

  static getVertices = (size, sides) => {
    let path = [];
    const a = (Math.PI * 2) / sides;
    for (let i = 0; i < sides; i++) {
      const wiggled = i * a + 0.3 * a + 0.6 * a * rnd();
      const radius = size + size * 0.1 * rnd();
      const x = radius * Math.cos(wiggled);
      const y = radius * Math.sin(wiggled);
      path.push([x, y]);
    }
    return path;
  };

  generate() {
    super.generate();
    //this.presentation.scale.set(this.scale)
  }

  collision(other) {
    // TODO: This could be in Base, somehow?
    if (dist(other.pos, this.pos) < 1.05 * this.size) {
      return true;
    }
    return false;
  }

  transferMomentum(other) {
    const otherMomentumX = other.vel.x * other.mass;
    const otherMomentumY = other.vel.y * other.mass;
    this.vel.x += otherMomentumX / this.mass;
    this.vel.y += otherMomentumY / this.mass;
  }

  split(vel) {
    // vel is the incoming vector (say, bullet)
    // We want them to separate fast, but not very fast
    console.log(vel);
    const nv = 0.1 * sqnorm(vel.x, vel.y) + 0.1;
    console.log(nv);
    if (this.size / 2 < 50) {
      for (let i = 0; i < 10; i++) {
        this.addFlame(this.pos, this.vel);
      }
      return [];
    }
    const a1 = new Asteroid({
      pos: {
        x: this.pos.x - this.size * (-vel.y / nv),
        y: this.pos.y + this.size * (+vel.x / nv),
      },
      vel: {
        x: -this.vel.x - vel.y / nv,
        y: this.vel.y + vel.x / nv,
      },

      sides: this.sides,
      size: this.size / 2,
      spin: this.spin,
    });
    const a2 = new Asteroid({
      pos: {
        x: this.pos.x + this.size * (-vel.y / nv),
        y: this.pos.y - this.size * (+vel.x / nv),
      },
      vel: {
        x: this.vel.x + vel.y / nv,
        y: this.vel.y - vel.x / nv,
      },
      sides: this.sides,
      size: this.size / 2,
      spin: this.spin,
    });
    for (let i = 0; i < 20 + rnd() * 10; i++) {
      this.addFlame(this.pos, this.vel, true);
    }
    return [a1, a2];
  }

  update(delta) {
    super.update(delta);
    super.move(delta.deltaTime);
    if (isNaN(this.vel.x) || isNaN(this.vel.y)) {
      this.presentation = { destroyed: true };
      return;
    }
    if (isNaN(this.pos.x) || isNaN(this.pos.y)) {
      this.presentation = { destroyed: true };
      return;
    }

    this.r += this.spin;
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
      //presentation.tint = hexColor;
    }
  }
  addCrack(from) {
    if (this.e <= 0) {
      return false;
    }
    /*if (rnd() > from.e) {
      return false;
    }*/
    let vx = this.pos.x - from.pos.x,
      vy = this.pos.y - from.pos.y;
    const nsq = Math.sqrt(sqnorm(vx, vy));
    if (nsq < 1e-3) {
      return false;
    }
    vx /= nsq;
    vy /= nsq;
    const s = 0.4 * this.size * rnd();
    const p0x = from.pos.x - this.pos.x,
      p0y = from.pos.y - this.pos.y;
    const q0x = from.pos.x - this.pos.x + s * vx,
      q0y = from.pos.y - this.pos.y + s * vy;
    const [p1x, p1y] = rotate(p0x, p0y, -this.presentations[0].rotation);
    const [q1x, q1y] = rotate(q0x, q0y, -this.presentations[0].rotation);
    const verts = [p1x, p1y, p1x + 5, p1y + 5, q1x, q1y];
    this.presentations[0].poly(verts);
    const red = Math.floor(10 + 80 * rnd());
    const hexColor = red << 16;
    this.presentations[0].stroke({ color: hexColor });
  }

  addFlame(pos, vel, wiggle = false) {
    const rf = rnd();
    let spread = 0.3 - 0.6 * rf;
    if (wiggle) {
      spread = rnd();
    }
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const wig = wiggle ? 15 : 1;
    const vx = Flame.ACCEL * ivx + vel.x * Math.sqrt(rnd() * wig);
    const vy = Flame.ACCEL * ivy + vel.y * Math.sqrt(rnd() * wig);
    const [rvx, rvy] = rotate(vx, vy, spread);
    const [rpx, rpy] = rotate(-60, 0, this.r);
    const fl = new Flame({
      pos: {
        x: pos.x + rpx,
        y: pos.y + rpy,
      },
      vel: {
        x: rvx,
        y: rvy,
      },
      r: this.r,
      e: 12,
      scale: 0.5,
    });

    this.flameList.push(fl);
  }
}
