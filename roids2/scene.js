export { Scene, SpaceScene };

import { Viewframe } from "../stardust/viewframe.js";
import { Starfield } from "../stardust/parallax.js";
//import { RenderedSystem } from "./tinker/renderedSystem.js";
import { sqnorm, wrapPos } from "../stardust/math.js";
//import { PlanetKinds } from "./tinker/system.js";
import { NebulaGenerator } from "../stardust/tinker/nebula.js";
import { Sprite } from "../libs/3rdparty/pixi.mjs";
import { otherControl } from "../stardust/pid.js";

import { Asteroid } from "./asteroid.js";
import { seededRnd } from "../stardust/rnd.js";

const rnd = seededRnd(performance.now());

class Scene {
  constructor() {}
}

const scoreDiv = document.getElementById("score");
const livesDiv = document.getElementById("lives");

// TODO: this will go with a separate "HUD"
const niceDistance = (dist) => {
  if (dist < 1000) {
    return String(Math.round(dist));
  }
  if (dist < 1000000) {
    return (dist / 1000).toFixed(2) + "k";
  }
  return (dist / 1000000).toFixed(2) + "M";
};

const linScale = (
  scale,
  props = { minScale: 1e-5, maxScale: 1, minOutput: 0.5, maxOutput: 1 },
) => {
  const { minScale, maxScale, minOutput, maxOutput } = props;

  // Clamp the scale factor to the valid range
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));

  // Perform linear interpolation
  const output =
    maxOutput +
    ((clampedScale - maxScale) * (minOutput - maxOutput)) /
      (minScale - maxScale);

  return output;
};

class SpaceScene extends Scene {
  static MAXSCALE = 0.2;
  constructor(props = {}) {
    super();
    this.controller = props.controller; // This is required
    this.player = props.player; // This is required
    this.app = props.app; // This is required, but likely I don't want it in super (non-pixi scenes)
    this.score = 0;

    // Ordering is important:
    // - Background:
    //     - Nebula
    //     - Starfield/dustfield
    // - Viewframe
    //     - Player
    //     - Planets / other stuff
    this.starfield = new Starfield({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
    });
    this.starfield.generate(this.app);
    this.starfield.attach(this.app);

    this.viewframe = new Viewframe();

    // TODO: nebula should own rendering itself
    const nebula = new NebulaGenerator({
      width: 2 * this.app.renderer.width,
      height: 2 * this.app.renderer.height,
      id: 20 * rnd(),
    });
    this.nebulaSprite = new Sprite(nebula.nebulaTexture);
    this.nebulaSprite.pivot.x = nebula.width / 2;
    this.nebulaSprite.pivot.y = nebula.height / 2;
    this.nebulaSprite.x = nebula.width / 4;
    this.nebulaSprite.y = nebula.height / 4;
    this.app.stage.addChild(this.nebulaSprite);

    this.viewframe.attach(this.app);
    this.viewframe.scale = SpaceScene.MAXSCALE;
    this.player.attach(this.viewframe);

    this.starfield.viewframe = this.viewframe; // TODO Trying to see if I can shift with this
    this.player.viewframe = this.viewframe; // Linking to have zoom
    this.viewframe.vel = this.player.vel;

    this.bulletList = [];
    this.flameList = [];
    this.otherShips = [];
    this.asteroids = [];

    this.viewframe.pos.x =
      this.player.pos.x -
      ((1 / this.viewframe.scale) * this.app.screen.width) / 2;
    this.viewframe.pos.y =
      this.player.pos.y -
      ((1 / this.viewframe.scale) * this.app.screen.height) / 2;

    this.starfield.starContainer.scale = linScale(SpaceScene.MAXSCALE);
    this.starfield.dustContainer.scale = linScale(SpaceScene.MAXSCALE);
    this.addRandomAsteroids(5);
  }

  addRandomAsteroids(n) {
    for (let i = 0; i < n; i++) {
      const x = (rnd() * this.app.renderer.width) / SpaceScene.MAXSCALE,
        y = (rnd() * this.app.renderer.height) / SpaceScene.MAXSCALE;
      const vx = 4 - 8 * rnd(),
        vy = 4 - 8 * rnd();
      const sides = Math.floor(5 + rnd() * 6);
      const size = (30 + rnd() * 30) / SpaceScene.MAXSCALE;
      const spin = 0.025 - rnd() * 0.05;
      const ast = new Asteroid({
        pos: { x: x, y: y },
        vel: { x: vx, y: vy },
        sides: sides,
        size: size,
        spin: spin,
      });
      this.asteroids.push(ast);
    }
  }

  // TODO: will need a destructor for all the created objects
  update(delta) {
    const nv = sqnorm(this.player.vel.x, this.player.vel.y);
    // TODO: speed limit
    this.starfield.update(this.player.vel);
    this.viewframe.update();

    const target = {
      pos: {
        x: this.player.pos.x - 800,
        y: this.player.pos.y,
      },
      vel: {
        x: this.player.vel.x,
        y: this.player.vel.y,
      },
    };
    for (let otherShip of this.otherShips) {
      if (otherShip.action() === "kChase") {
        otherControl(
          otherShip,
          this.player,
          target,
          delta.deltaTime,
          this.player.bulletList,
        ); // TODO: Too many arguments, and the last one…
      }
      otherShip.update(delta);
    }

    this.controller();

    wrapPos(this.player, {
      wmin: 0,
      wmax: this.app.renderer.width / this.viewframe.scale,
      hmin: 0,
      hmax: this.app.renderer.height / this.viewframe.scale,
    });
    if (
      this.player.invulnerable &&
      this.player.invulnerable > performance.now() - 1000
    ) {
      this.player.presentations[0].tint = 0x00ff00;
    } else {
      this.player.invulnerable = null;
      this.player.presentations[0].tint = null;
    }
    this.player.update(delta);
    // Remove destroyed asteroids (in-place)

    for (let flammable of [
      this,
      this.player,
      ...this.otherShips,
      ...this.asteroids,
    ]) {
      // Remove destroyed flames (in-place)
      for (let i = flammable.flameList.length - 1; i >= 0; i--) {
        if (flammable.flameList[i]?.presentation?.destroyed) {
          flammable.flameList.splice(i, 1);
        }
      }

      // Remove destroyed bullets (in-place)
      for (let i = flammable.bulletList.length - 1; i >= 0; i--) {
        if (flammable.bulletList[i]?.presentation?.destroyed) {
          flammable.bulletList.splice(i, 1);
        }
      }

      // Render and update bullets
      for (let b of flammable.bulletList) {
        if (!b.drawn) {
          b.generate();
          b.attach(this.viewframe);
        }
        wrapPos(b, {
          wmin: 0,
          wmax: this.app.renderer.width / this.viewframe.scale,
          hmin: 0,
          hmax: this.app.renderer.height / this.viewframe.scale,
        });
        b.update(delta);
      }

      // Render and update flames
      for (let f of flammable.flameList) {
        if (!f.drawn) {
          f.generate();
          f.attach(this.viewframe);
        }
        wrapPos(f, {
          wmin: 0,
          wmax: this.app.renderer.width / this.viewframe.scale,
          hmin: 0,
          hmax: this.app.renderer.height / this.viewframe.scale,
        });
        f.update(delta);
      }
      let newAsteroids = [];
      for (let b of flammable.bulletList) {
        // Handle bullet collisions with asteroids now
        if (b.e <= 0.01) {
          continue;
        }
        for (let a of this.asteroids) {
          if (a.e < 0) {
            continue;
          }
          if (a.collision(b)) {
            a.e -= b.e;
            b.e = 0;
            a.transferMomentum(b);
            a.addFlame(b.pos, b.vel);
            if (a.e < 0) {
              this.score += Math.round(a.size);
              scoreDiv.textContent = this.score.toFixed(0);
              newAsteroids.push(...a.split(b.vel));
            } else {
              a.addCrack(b);
            }
          }
        }
      }

      for (let a of this.asteroids) {
        if (this.player.invulnerable) {
          continue;
        }
        // player collision now
        if (a.e < 0) {
          continue;
        }
        if (a.collision(this.player)) {
          a.e = -1;
          this.player.invulnerable = performance.now();
          this.player.lives -= 1;
          livesDiv.textContent = this.player.lives;
          a.transferMomentum(this.player);
          if (a.e < 0) {
            newAsteroids.push(...a.split(this.player.vel));
            console.log(newAsteroids);
          } else {
            a.addCrack(this.player);
          }
        }
      }
      this.asteroids = this.asteroids.concat(newAsteroids);
    }

    // Elastic collision across asteroids
    for (let i = 0; i < this.asteroids.length; i++) {
      for (let j = i + 1; j < this.asteroids.length; j++) {
        const zis = this.asteroids[i];
        const other = this.asteroids[j];
        if (zis.e < 0 || other.e < 0) {
          continue;
        }
        if (zis.collision(other) || other.collision(zis)) {
          // 1. Calculate the collision normal vector (direction of impact)
          const dx = other.pos.x - zis.pos.x;
          const dy = other.pos.y - zis.pos.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const nx = dx / dist; // Normalized normal x
          const ny = dy / dist; // Normalized normal y

          // 2. Calculate relative velocity along the normal
          const v1n = zis.vel.x * nx + zis.vel.y * ny;
          const v2n = other.vel.x * nx + other.vel.y * ny;

          // 3. Calculate new velocities along the normal (1D elastic collision)
          const m1 = zis.mass;
          const m2 = other.mass;

          // Elastic collision formula with energy loss (coefficient of restitution)
          const restitution = 0.8; // Adjust this value (0 to 1) for energy loss
          const newV1n =
            (v1n * (m1 - m2 * restitution) + v2n * m2 * (1 + restitution)) /
            (m1 + m2);
          const newV2n =
            (v2n * (m2 - m1 * restitution) + v1n * m1 * (1 + restitution)) /
            (m1 + m2);

          // 4. Update asteroid velocities
          zis.vel.x += (newV1n - v1n) * nx;
          zis.vel.y += (newV1n - v1n) * ny;
          other.vel.x += (newV2n - v2n) * nx;
          other.vel.y += (newV2n - v2n) * ny;
        }
      }
    }

    // Removing asteroids is best at the end, to make sure flames are removed first.
    // TODO Even with saving some flames, we still seem to have some unnacounted for when
    // asteroids explode. Likely ordering issue
    for (let i = this.asteroids.length - 1; i >= 0; i--) {
      const dis = this.asteroids[i];
      if (dis.presentation?.destroyed) {
        if (dis.flameList.length > 0) {
          this.flameList = [...dis.flameList]; // Save the flames
        }
        this.asteroids.splice(i, 1);
      }
    }

    for (let a of this.asteroids) {
      if (!a.drawn) {
        a.generate();
        a.attach(this.viewframe);
      }
      wrapPos(a, {
        wmin: 0,
        wmax: this.app.renderer.width / this.viewframe.scale,
        hmin: 0,
        hmax: this.app.renderer.height / this.viewframe.scale,
      });
      a.update(delta);
    }
  }
}
