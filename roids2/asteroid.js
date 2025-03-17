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
    const energy = Math.floor(0.5 * sides * sides);
    const ne = Math.max(0, Math.min(1, energy / 1000));
    const g = Math.floor(Math.max(100, Math.min(200, ne)));
    const hexColor = (g << 16) | (g << 8) | g;
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: vertices,
      color: 0xffffff,
      width: 3,
      fill: 0x111111,
    });

    super({ ...props, meshes: [mesh] });
    this.vel = props.vel;
    this.vertices = vertices;
    this.size = props.size;
    this.sides = props.sides;
    this.spin = props.spin;
    this.mass = sides * size;
    this.e = energy;
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
    if (dist(other.pos, this.pos) < 1.2 * this.size) {
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
    const nv = sqnorm(vel.x, vel.y) + 0.1;
    if (this.size / 2 < 40) {
      for (let i = 0; i < 20; i++) {
        this.addFlame(this.pos, this.vel, true);
      }
      return [];
    }
    const a1 = new Asteroid({
      pos: {
        x: this.pos.x - 25 * this.size * (-vel.y / nv),
        y: this.pos.y + 25 * this.size * (+vel.x / nv),
      },
      vel: {
        x: -this.vel.x - (25 * vel.y) / nv,
        y: this.vel.y + (25 * vel.x) / nv,
      },

      sides: this.sides,
      size: this.size / 2,
      spin: this.spin,
    });
    const a2 = new Asteroid({
      pos: {
        x: this.pos.x + 25 * this.size * (-vel.y / nv),
        y: this.pos.y - 25 * this.size * (+vel.x / nv),
      },
      vel: {
        x: this.vel.x + (25 * vel.y) / nv,
        y: this.vel.y - (25 * vel.x) / nv,
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
    }
  }

  explode() {
    for (let i = 0; i < 30; i++) {
      const m = 4 * Math.random();
      const a = Math.random() * 2 * Math.PI;
      const fl = new Flame({
        pos: {
          x: this.pos.x,
          y: this.pos.y,
        },
        vel: {
          x: m * Math.cos(a),
          y: m * Math.sin(a),
        },
        r: 0,
        e: 12 + Math.random() * 8,
        scale: 0.8,
      });
      this.flameList.push(fl);
    }
  }

  addCrack(from) {
    if (this.e <= 0.1) {
      this.e = -1;
      this.explode();
      return false;
    }
    if (!this.presentations || this.presentations?.length == 0) {
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
    const [p1x, p1y] = rotate(p0x, p0y, -this.presentations[0].rotation ?? 0);
    const [q1x, q1y] = rotate(q0x, q0y, -this.presentations[0].rotation ?? 0);
    const verts = [p1x, p1y, p1x + 8, p1y + 8, q1x, q1y];
    this.presentations[0].poly(verts);
    const red = Math.floor(10 + 80 * rnd());
    const hexColor = red << 16;
    this.presentations[0].stroke({ color: hexColor });
  }

  addFlame(pos, vel, wiggle = false) {
    const rf = rnd();
    let spread = 0.3 - 0.6 * rf;
    if (wiggle) {
      spread = 2 * Math.PI * rnd();
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
