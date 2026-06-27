export { Scene, SpaceScene };

import { Viewframe } from "./viewframe.js";
import { Starfield } from "./parallax.js";
import { RenderedSystem } from "./tinker/renderedSystem.js";
import { sqnorm } from "./math.js";
import { PlanetKinds } from "./tinker/system.js";
import { otherControl } from "./pid.js";
import { Flame } from "./flame.js";
import { settings } from "../roids2/settings.js";
import { Debris } from "./base/debris.js";
import { Minimap } from "./minimap.js";
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

const logg = document.getElementById("logg");
const log = (f) => {
  logg.innerHTML = f;
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

const MAXSCALE = 0.2;

class SpaceScene extends Scene {
  constructor(props = {}) {
    super();
    this.controller = props.controller; // This is required
    this.player = props.player; // This is required
    this.app = props.app; // This is required, but likely I don't want it in super (non-pixi scenes)
    this.systemId = props.id; // This will very likely be required

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

    this.renderedSystem = new RenderedSystem({
      id: this.systemId,
      app: this.app,
      viewframe: this.viewframe,
    });
    this.renderedSystem.attachNebula();

    this.viewframe.attach(this.app);
    this.viewframe.scale = MAXSCALE;
    this.renderedSystem.attachPlanets();
    this.player.attach(this.viewframe);

    this.starfield.viewframe = this.viewframe; // TODO Trying to see if I can shift with this

    this.viewframe.pos.x =
      ((-1 / this.viewframe.scale) * this.app.screen.width) / 2;
    this.viewframe.pos.y =
      ((-1 / this.viewframe.scale) * this.app.screen.height) / 2;

    this.player.viewframe = this.viewframe; // Linking to have zoom
    this.viewframe.vel = this.player.vel;

    this.objectList = this.renderedSystem.planetObjects; // This has to have more stuff
    this.waypoints = this.renderedSystem.planetObjects; // TODO this will have more stuff
    this.bulletList = props.bulletList;
    this.flameList = props.flameList;
    this.otherShips = [];
    this.debrisList = [];
    this._planetNames = this._buildPlanetNames();
    this.cameraPos = { x: this.player.pos.x, y: this.player.pos.y };
    this.minimap = new Minimap({
      player: this.player,
      renderedSystem: this.renderedSystem,
    });
  }
  _buildPlanetNames() {
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    const sysName = this.renderedSystem.name;
    const earthLikes = this.renderedSystem.planets
      .filter((p) => p.kind === PlanetKinds.EarthLike)
      .sort((a, b) => a.idx - b.idx);
    const names = new Map();
    earthLikes.forEach((p, rank) => {
      names.set(p.idx, earthLikes.length === 1
        ? `${sysName} Prime`
        : `${sysName} ${roman[rank]}`);
    });
    return names;
  }

  // TODO: will need a destructor for all the created objects
  update(delta) {
    const nv = sqnorm(this.player.vel.x, this.player.vel.y);
    this.starfield.update(this.player.vel);

    this.viewframe.move(delta.deltaTime);
    this.viewframe.update();
    const rawSpeedScale = Math.min(MAXSCALE, 100 / (nv + 1));
    this.starfield.starContainer.scale = linScale(rawSpeedScale);
    this.starfield.dustContainer.scale = linScale(rawSpeedScale);
    if (this.renderedSystem.nebulaSprite) {
      this.renderedSystem.nebulaSprite.scale = linScale(rawSpeedScale);
    }
    //if(nv > 1){
    //if (scale < 1e-10) {
    //  scale = 1e-10;
    // This should have a faster option at some point?
    //}
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
    // Elastic dead-zone camera: player moves freely in the inner 3/5 of screen;
    // the 1/5 border region pulls the camera and triggers zoom-out.
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const MARGIN = 0.2;

    const speedScale = linScale(rawSpeedScale, {
      minScale: 1e-15,
      maxScale: MAXSCALE,
      minOutput: 1e-2,
      maxOutput: MAXSCALE,
    });

    // Where would the player appear at max scale given current camera?
    const screenX = (this.player.pos.x - this.cameraPos.x) * MAXSCALE + W / 2;
    const screenY = (this.player.pos.y - this.cameraPos.y) * MAXSCALE + H / 2;

    // How far into the border zone (0 = safe, 1 = at screen edge)?
    const excessX = Math.max(0, (Math.abs(screenX - W / 2) - (0.5 - MARGIN) * W) / (MARGIN * W));
    const excessY = Math.max(0, (Math.abs(screenY - H / 2) - (0.5 - MARGIN) * H) / (MARGIN * H));
    const excess = Math.min(1, Math.max(excessX, excessY));

    // At warp speed the dead-zone melts away and camera locks to player;
    // at low speed it's elastic (0.12 at border, 0 at centre).
    const warpFactor = 1 - speedScale / MAXSCALE; // 0 = stationary, 1 = max speed
    const followRate = warpFactor + (1 - warpFactor) * excess * 0.12;
    this.cameraPos.x += (this.player.pos.x - this.cameraPos.x) * followRate;
    this.cameraPos.y += (this.player.pos.y - this.cameraPos.y) * followRate;

    // Scale: full zoom at centre, speed-driven zoom-out at border
    const scale = MAXSCALE + (speedScale - MAXSCALE) * Math.max(excess, warpFactor);

    this.viewframe.scale = scale;
    this.viewframe.pos.x = this.cameraPos.x - (W / 2) / scale;
    this.viewframe.pos.y = this.cameraPos.y - (H / 2) / scale;
    let hudTarget = { targetName: null, targetColor: null, targetDist: null, targetPos: null };
    for (let pl of this.waypoints) {
      const dx = pl.pos.x - this.player.pos.x;
      const dy = pl.pos.y - this.player.pos.y;
      const angle = -Math.atan2(dy, dx);
      const diff = Math.cos(angle + this.player.r) - 1;

      if (diff * diff < 1e-4) {
        const name = pl.kind === PlanetKinds.Sun
          ? pl.name
          : (pl.kind === PlanetKinds.EarthLike
            ? (this._planetNames.get(pl.p.idx) ?? pl.kind.slice(1))
            : pl.kind.slice(1));
        const dist = Math.sqrt(dx * dx + dy * dy);
        hudTarget = {
          targetName: name,
          targetColor: pl.averagedColor,
          targetDist: niceDistance(dist),
          targetPos: { x: pl.pos.x, y: pl.pos.y },
        };
        break;
      }
    }
    this.minimap.setHUD({
      ...hudTarget,
      speed: Math.sqrt(nv).toFixed(1),
    });

    //viewframe.scale = nv > 0.2 ? 0.2 * 10000 /nv : 0.2
    this.objectList.map((p) => p.update(delta));
    this.controller();

    this.player.update(delta);
    //
    for (let flammable of [this.player, ...this.otherShips]) {
      // Remove destroyed flames (in-place)
      for (let i = flammable.flameList.length - 1; i >= 0; i--) {
        if (flammable.flameList[i].presentation?.destroyed) {
          flammable.flameList.splice(i, 1);
        }
      }

      // Remove destroyed bullets (in-place)
      for (let i = flammable.bulletList.length - 1; i >= 0; i--) {
        if (flammable.bulletList[i].presentation?.destroyed) {
          flammable.bulletList.splice(i, 1);
        }
      }

      // Render and update bullets; run collision checks
      for (let b of flammable.bulletList) {
        if (!b.drawn) {
          b.generate();
          b.attach(this.viewframe);
        }
        b.update(delta);

        if (b.e <= 0.01) {
          b.e = -1;
          continue;
        }

        // Player hit by enemy bullets
        if (this.player.e > 0 && b.source !== this.player._id) {
          if (this.player.collision(b) === 1) {
            settings.shake?.onHit(this.app);
            const pe = this.player.e;
            this.player.e -= b.e;
            b.e -= pe;
            const bnv = sqnorm(b.vel.x, b.vel.y) + 0.01;
            const pnv = sqnorm(this.player.vel.x, this.player.vel.y) + 0.01;
            for (let i = 0; i < settings.explosions.player.hitFlame.count; i++) {
              const fl = new Flame({
                pos: { x: b.pos.x, y: b.pos.y },
                vel: {
                  x: (250 * b.vel.x) / bnv - (0.4 * this.player.vel.x) / pnv,
                  y: (250 * b.vel.y) / bnv - (0.4 * this.player.vel.y) / pnv,
                },
                r: 0,
                e: 12,
                scale: settings.explosions.player.flame.scale?.() ?? 1,
              });
              this.player.flameList.push(fl);
            }
            if (this.player.e < 0) {
              this.player.e = -1;
              const debris = this.player.explode({
                e: Math.abs(this.player.e) + 1,
                vel: {
                  x: (2 * b.vel.x) / bnv - (0.4 * this.player.vel.x) / pnv,
                  y: (2 * b.vel.y) / bnv - (0.4 * this.player.vel.y) / pnv,
                },
              });
              if (debris) this.debrisList.push(debris);
            }
          }
        }

        // Other ships hit by any bullet not from themselves
        for (let o of this.otherShips) {
          if (o.e < 0) continue;
          if (b.source === o._id) continue;
          const collisioning = o.collision(b);
          if (collisioning === 1) {
            o.showHit = performance.now() + settings.showHitMs;
            const oe = o.e;
            if (b.kind === "kMissile") {
              o.e -= b.e;
              b.e = -1;
              b.explode?.();
            } else {
              o.e -= b.e;
              b.e -= oe;
            }
            const bnv = sqnorm(b.vel.x, b.vel.y) + 0.01;
            const onv = sqnorm(o.vel.x, o.vel.y) + 0.01;
            for (let i = 0; i < settings.explosions.ships.hitFlame.count; i++) {
              const fl = new Flame({
                pos: { x: b.pos.x, y: b.pos.y },
                vel: {
                  x: (290 * b.vel.x) / bnv - (0.3 * o.vel.x) / onv,
                  y: (290 * b.vel.y) / bnv - (0.3 * o.vel.y) / onv,
                },
                fill: 0xff0000,
                r: 0,
                e: 12,
                scale: settings.explosions.ships.flame.scale?.() ?? 1,
              });
              this.player.flameList.push(fl);
            }
            if (o.e < 0) {
              const debris = o.explode({
                e: Math.abs(o.e) + 1,
                vel: {
                  x: (2 * b.vel.x) / bnv - (0.4 * o.vel.x) / onv,
                  y: (2 * b.vel.y) / bnv - (0.4 * o.vel.y) / onv,
                },
              });
              if (debris) this.debrisList.push(debris);
              o.e = -1;
            }
          }
        }
      }

      // Render and update flames
      for (let f of flammable.flameList) {
        if (!f.drawn) {
          f.generate();
          f.attach(this.viewframe);
        }
        f.update(delta);
      }
    }

    // Remove dead other ships
    for (let i = this.otherShips.length - 1; i >= 0; i--) {
      if (this.otherShips[i].e < 0) {
        this.otherShips.splice(i, 1);
      }
    }

    // Render and update debris
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      if (d.destroyed) {
        this.debrisList.splice(i, 1);
        continue;
      }
      if (!d.generated) {
        d.generate();
        d.viewframe = this.viewframe;
        for (let p of d.presentations) {
          this.viewframe.presentation.addChild(p);
        }
      }
      d.update(delta);
    }

    this.renderedSystem.update(delta);
    this.minimap.setOtherShips(this.otherShips);
    this.minimap.update();
  }
}
