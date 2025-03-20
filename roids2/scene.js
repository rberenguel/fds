export { Scene, SpaceScene };

import { Viewframe } from "../stardust/viewframe.js";
import { Starfield } from "../stardust/parallax.js";
//import { RenderedSystem } from "./tinker/renderedSystem.js";
import { sqnorm, wrapPos, dist } from "../stardust/math.js";
import { Flame } from "../stardust/flame.js";
//import { PlanetKinds } from "./tinker/system.js";
import { NebulaGenerator } from "../stardust/tinker/nebula.js";
import { Sprite } from "../libs/3rdparty/pixi.mjs";
import { otherControl } from "../stardust/pid.js";
import { Bobcat, Lynx } from "../stardust/ship.js";
import { Asteroid } from "./asteroid.js";
import { seededRnd } from "../stardust/rnd.js";
import {
  MassDriverGun,
  LaserGun,
  PhotonTorpedoLauncher,
  GaussCannon,
} from "../stardust/weapons/weapons.js";
const rnd = seededRnd(performance.now());

class Scene {
  constructor() {}
}

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
    this.scale = props.scale ?? SpaceScene.MAXSCALE;

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
    console.info("Generating nebula");
    const nebula = new NebulaGenerator({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
      id: 20 * rnd(),
    });
    console.info("Nebula generated");
    try {
      this.nebulaSprite = new Sprite(nebula.nebulaTexture);
      this.nebulaSprite.pivot.x = nebula.width / 2;
      this.nebulaSprite.pivot.y = nebula.height / 2;
      this.nebulaSprite.x = nebula.width / 2;
      this.nebulaSprite.y = nebula.height / 2;
      this.app.stage.addChild(this.nebulaSprite);
      console.info("Nebula sprite added");
    } catch (err) {
      console.info("Nebula failed");
      console.error(err);
    }

    this.viewframe.attach(this.app);
    this.viewframe.scale = this.scale;

    this.starfield.viewframe = this.viewframe; // TODO Trying to see if I can shift with this

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

    this.starfield.starContainer.scale = linScale(this.scale);
    this.starfield.dustContainer.scale = linScale(this.scale);
    this.bindPlayer();
  }

  bindPlayer() {
    this.player.attach(this.viewframe);
    this.player.viewframe = this.viewframe; // Linking to have zoom
  }

  addEnemies(n, loadouts = []) {
    console.log(loadouts);
    let localLoadouts = [...loadouts];
    const otherLaser = (other) => {
      other.ammo[LaserGun.kind] = {};
      other.ammo[LaserGun.kind].count = 10;
      other.ammo[LaserGun.kind].max = 30;
      const laserGun1 = new LaserGun({
        pos: {
          x: -30,
          y: 50,
        },
        color: 0xff2200,
      });
      const laserGun2 = new LaserGun({
        pos: {
          x: -30,
          y: -50,
        },
        color: 0xff2200,
      });
      laserGun1.stats.baseE = LaserGun.baseStats.baseE * 1.7;
      laserGun2.stats.baseE = LaserGun.baseStats.baseE * 1.7; // 2 was way too much, 1.2 too little
      other.weapons = [laserGun1, laserGun2];
    };
    const otherPhoton = (other) => {
      const photonTorpedo = new PhotonTorpedoLauncher({
        pos: {
          x: 0,
          y: 0,
        },
        source: this._id,
      });
      photonTorpedo.stats.ammoRefreshRate =
        PhotonTorpedoLauncher.baseStats.ammoRefreshRate * 2;
      other.secondaryWeapons = [photonTorpedo];
      other.ammo[PhotonTorpedoLauncher.kind] = {};
      other.ammo[PhotonTorpedoLauncher.kind].count = 2;
      other.ammo[PhotonTorpedoLauncher.kind].max = 2;
    };
    const otherMassDriver = (other) => {
      // By default a Bobcat comes with mass drivers
      other.ammo[MassDriverGun.kind] = {};
      other.ammo[MassDriverGun.kind].count = 300000000000000;
      other.ammo[MassDriverGun.kind].max = 300000000000000;
    };
    const otherGaussCannon = (other) => {
      const railGun = new GaussCannon({
        pos: {
          x: 0,
          y: 0,
        },
        source: this._id,
      });
      railGun.stats.ammoRefreshRate = GaussCannon.baseStats.ammoRefreshRate * 2;
      other.secondaryWeapons = [railGun];
      other.ammo[GaussCannon.kind] = {};
      other.ammo[GaussCannon.kind].count = 2;
      other.ammo[GaussCannon.kind].max = 2;
    };
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const m = 2500 + Math.random() * 2000;
      const x = this.player.pos.x + Math.cos(a) * m;
      const y = this.player.pos.y + Math.sin(a) * m;
      let retry = false;
      for (let a of this.asteroids) {
        if (dist({ x, y }, a.pos) < a.size + 300) {
          retry = true;
          break;
        }
      }
      if (retry) {
        --i;
        continue;
      }
      const other = new Bobcat({
        pos: {
          x: x,
          y: y,
        },
        r: -a,
      });

      other.prevShot = -1;
      other.disabled = performance.now() + 500;
      // They start 500ms later

      if (localLoadouts.length > 0) {
        const loadout = localLoadouts[0];
        console.log(loadout);
        if (loadout?.weapon === "kLaserGun") {
          otherLaser(other);
        }
        if (loadout?.secondary === "kPhotonTorpedoLauncher") {
          otherPhoton(other);
        }
        if (loadout?.weapon === "kMassDriverGun") {
          otherMassDriver(other);
        }
        if (loadout?.secondary === "kGaussCannon") {
          otherGaussCannon(other);
        }
        localLoadouts = localLoadouts.slice(1);
      } else {
        if (Math.random() < 0.8) {
          // Most have laser guns
          otherLaser(other);
          if (Math.random() < 0.5) {
            otherPhoton(other);
          }
        } else {
          otherMassDriver(other);
          if (Math.random() < 0.5) {
            otherGaussCannon(other);
          }
        }
      }
      for (let w of other.weapons) {
        w.source = other._id;
      }
      for (let w of other.secondaryWeapons) {
        w.source = other._id;
      }
      other.action = () => "kChase";
      other.generate();
      other.attach(this.viewframe);
      this.otherShips.push(other);
    }
  }

  addAsteroids(n) {
    for (let i = 0; i < n; i++) {
      const x = (rnd() * this.app.renderer.width) / this.scale,
        y = (rnd() * this.app.renderer.height) / this.scale;
      const vx = 4 - 8 * rnd(),
        vy = 4 - 8 * rnd();
      const sides = Math.floor(15 + rnd() * 6);
      const factor = Math.sqrt(
        Math.min(this.app.renderer.width, this.app.renderer.height),
      );
      const size = (0.5 * factor + rnd() * factor) / this.scale;
      if (dist(this.player.pos, { x: x, y: y }) < 500 + size) {
        // Avoid the player
        --i;
        continue;
      }
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
    this.app.canvas.style.translate = `0px 0px`;
    document.body.style.backgroundColor = "black";
    this.starfield.update(this.player.vel);
    this.viewframe.update();

    let target = {
      pos: {
        x: this.player.pos.x - 10,
        y: this.player.pos.y,
      },
      vel: {
        x: this.player.vel.x,
        y: this.player.vel.y,
      },
    };
    for (let otherShip of this.otherShips) {
      if (otherShip.e < 0) {
        continue;
      }
      if (otherShip.action() === "kChase") {
        otherControl({
          other: otherShip,
          ship: this.player,
          target: target,
          deltaTime: delta.deltaTime,
          bulletList: this.player.bulletList,
          asteroids: this.asteroids,
          gameWidth: this.app.renderer.width / this.viewframe.scale,
          gameHeight: this.app.renderer.height / this.viewframe.scale,
        }); // TODO: Too many arguments, and the last one…
      }
      if (otherShip.action() === "kIdle") {
        const validAsteroids = this.asteroids.filter((a) => a.e > 1);
        let closestAsteroid = null;
        let minDistance = Infinity;

        if (validAsteroids.length > 0) {
          for (const asteroid of validAsteroids) {
            // Calculate the distance between the otherShip and the asteroid
            const dx = asteroid.pos.x - otherShip.pos.x;
            const dy = asteroid.pos.y - otherShip.pos.y;
            const distSq = dx * dx + dy * dy; // Using squared distance for efficiency

            if (distSq < minDistance) {
              minDistance = distSq;
              closestAsteroid = asteroid;
            }
          }
        }

        let target = closestAsteroid;
        let ship = undefined;
        if (!closestAsteroid) {
          target = this.otherShips.filter((o) => o != otherShip).at(0);
          if (target) {
            target.kind = "kOtherShip";
            ship = target;
          } else {
            otherShip.explode();
            otherShip.e = -1;
            continue;
          }
        } else {
          target.kind = "kAsteroid";
        }

        otherControl({
          other: otherShip,
          target: target,
          ship: ship,
          deltaTime: delta.deltaTime,
          bulletList: this.player.bulletList,
          asteroids: this.asteroids,
          gameWidth: this.app.renderer.width / this.viewframe.scale,
          gameHeight: this.app.renderer.height / this.viewframe.scale,
        });
      }
      /*wrapPos(otherShip, {
        wmin: 0,
        wmax: this.app.renderer.width / this.viewframe.scale,
        hmin: 0,
        hmax: this.app.renderer.height / this.viewframe.scale,
      });
      otherShip.update(delta);*/
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
    let newAsteroids = [];
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

      for (let b of flammable.bulletList) {
        // Handle bullet collisions with asteroids now
        if (b.e <= 0.01) {
          b.e = -1;
          continue;
        }
        for (let a of this.asteroids) {
          if (a.e < 0) {
            continue;
          }
          if (a.collision(b)) {
            const ae = a.e;
            a.e = b.e > 0 ? a.e - b.e : a.e; // Strange situations
            b.e -= ae;
            if (b.shooter?.human) {
              b.shooter.stats.shots[b.firedBy].hitsAsteroid++;
            }
            a.transferMomentum(b);
            a.addFlame(b.pos, b.vel);
            if (a.e < 0 && b.source === this.player._id) {
              this.score += Math.round(a.size);
              newAsteroids.push(...a.split(b.vel));
            } else {
              a.addCrack(b);
            }
          }
        }

        if (this.player.e > 0 && this.player.collision(b)) {
          if (b.source === this.player._id) {
            continue;
          }
          // AAAA
          const rx = -2 + Math.floor(Math.random() * 4);
          const ry = -2 + Math.floor(Math.random() * 4);
          this.app.canvas.style.translate = `${rx}px ${ry}px`;
          document.body.style.backgroundColor = "#211";

          if (window.drumSampler) {
            window.drumSampler.triggerAttackRelease("a4", 0.5); // Cowbell
          }
          const pe = this.player.e;
          this.player.e -= b.e;
          b.e -= pe;
          const fl = new Flame({
            pos: {
              x: b.pos.x,
              y: b.pos.y,
            },
            vel: {
              x: b.vel.x - this.player.vel.x * this.player.mass,
              y: b.vel.y - this.player.vel.y * this.player.mass,
            },
            r: 0,
            e: 12,
            scale: 0.7,
          });
          this.flameList.push(fl);
          if (this.player.e < 0) {
            this.player.lives -= 1;
            this.player.explode({ e: -this.player.e });
            if (window.drumSampler) {
              window.drumSampler.triggerAttackRelease("f0", 0.5); // Crash
            }
            this.player.e = -1;
            this.flameList.push(...this.player.flameList);
            //this.player.invulnerable = performance.now();
            //this.player.e = 1000;
            //livesDiv.textContent = this.player.lives;
          }
        }

        for (let o of this.otherShips) {
          if (o.e < 0) {
            o.e = -1;
            continue;
          }
          if (b.source === o._id) {
            continue;
          }

          if (o.collision(b)) {
            const oe = o.e;
            if (b.shooter?.human) {
              b.shooter.stats.shots[b.firedBy].hitsShip++;
            }
            if (b.kind === "kEmpBlast") {
              // Note that this can be used for mine/bomb too
              // This could be temporary at some point
              o.disabled = performance.now() + 3000;
              console.log(`${o} is disabled`);
            } else {
              o.e -= b.e;
              b.e -= oe;
            }
            const fl = new Flame({
              pos: {
                x: b.pos.x,
                y: b.pos.y,
              },
              vel: {
                x: b.vel.x - o.vel.x * o.mass,
                y: b.vel.y - o.vel.y * o.mass,
              },
              r: 0,
              e: 12,
              scale: 0.7,
            });
            this.flameList.push(fl); // TODO this should be handled internally
            //o.transferMomentum(b); TODO momentum
            if (o.e < 0) {
              o.explode({ e: -o.e }); // TODO this should be handled internally
              o.e = -1;
            }
          }
        }
      }
    }
    for (let a of this.asteroids) {
      if (a.e < 0) {
        continue;
      }
      if (this.player.e > 0 && this.player.collision(a)) {
        a.e = -1;
        //this.player.invulnerable = performance.now();
        this.player.lives -= 1;
        //livesDiv.textContent = this.player.lives;
        this.player.explode({ e: -this.player.e });
        this.player.e = -1;
        this.flameList.push(...this.player.flameList);
        newAsteroids.push(...a.split(this.player.vel));
      }
      for (let o of this.otherShips) {
        if (o.e < 0) {
          o.e = -1;
          continue;
        }
        if (a.collision(o)) {
          a.e = -1;
          o.explode({ e: -o.e });
          o.e = -1;
          newAsteroids.push(...a.split(o.vel));
        }
      }
    }

    this.asteroids.push(...newAsteroids);

    // Elastic collision across asteroids
    for (let i = 0; i < this.asteroids.length; i++) {
      // TODO: fix the break up of asteroids so elastic collision works
      for (let j = i + 1; j < this.asteroids.length; j++) {
        const zis = this.asteroids[i];
        const other = this.asteroids[j];
        if (zis.e < 0 || other.e < 0) {
          continue;
        }
        if (zis.collision(other) || other.collision(zis)) {
          const dx = other.pos.x - zis.pos.x;
          const dy = other.pos.y - zis.pos.y;
          let dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 1e-4) {
            dist = 0.001;
          }
          const nx = dx / dist; // Normalized normal x
          const ny = dy / dist; // Normalized normal y

          const v1n = zis.vel.x * nx + zis.vel.y * ny;
          const v2n = other.vel.x * nx + other.vel.y * ny;

          const m1 = zis.mass + 0.1;
          const m2 = other.mass + 0.1;

          const restitution = 0.7;
          const newV1n =
            (v1n * (m1 - m2 * restitution) + v2n * m2 * (1 + restitution)) /
            (m1 + m2);
          const newV2n =
            (v2n * (m2 - m1 * restitution) + v1n * m1 * (1 + restitution)) /
            (m1 + m2);

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
          this.flameList.push(...dis.flameList); // Save the flames
        }
        this.asteroids.splice(i, 1);
      }
    }

    for (let i = this.otherShips.length - 1; i >= 0; i--) {
      const dis = this.otherShips[i];
      if (dis.presentation?.destroyed) {
        if (dis.flameList.length > 0) {
          this.flameList.push(...dis.flameList); // Save the flames
        }
        this.otherShips.splice(i, 1);
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
    for (let o of this.otherShips) {
      wrapPos(o, {
        wmin: 0,
        wmax: this.app.renderer.width / this.viewframe.scale,
        hmin: 0,
        hmax: this.app.renderer.height / this.viewframe.scale,
      });
      o.update(delta);
    }
  }
}
