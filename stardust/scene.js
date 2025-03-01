export { Scene, SpaceScene };

import { Viewframe } from "./viewframe.js";
import { Starfield } from "./parallax.js";
import { RenderedSystem } from "./tinker/renderedSystem.js";
import { sqnorm } from "./math.js";
import { PlanetKinds } from "./tinker/system.js";
import { otherControl } from "./pid.js";
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

const planetTarget = document.getElementById("planet-target");
const planetDistance = document.getElementById("planet-distance");
const planetIdx = document.getElementById("planet-idx");

const logg = document.getElementById("logg");
const log = (f) => {
  logg.innerHTML = f;
};

const linScale = (scale) => {
  const minScale = 1e-5;
  const maxScale = 1;
  const minOutput = 0.5;
  const maxOutput = 1;

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
  constructor(props = {}) {
    super();
    this.controller = props.controller; // This is required
    this.player = props.player; // This is required
    this.app = props.app; // This is required, but likely I don't want it in super (non-pixi scenes)
    this.systemId = props.id; // This will very likely be required
    this.viewframe = new Viewframe();
    this.starfield = new Starfield({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
    });
    this.starfield.generate(this.app);
    this.starfield.attach(this.app);

    this.viewframe.attach(this.app);
    this.viewframe.scale = 1;

    this.viewframe.pos.x =
      ((-1 / this.viewframe.scale) * this.app.screen.width) / 2;
    this.viewframe.pos.y =
      ((-1 / this.viewframe.scale) * this.app.screen.height) / 2;

    this.player.attach(this.viewframe);
    this.player.viewframe = this.viewframe; // Linking to have zoom
    this.viewframe.vel = this.player.vel;
    this.renderedSystem = new RenderedSystem({
      id: this.systemId,
      app: this.app,
      viewframe: this.viewframe,
    });
    this.objectList = this.renderedSystem.planetObjects; // This has to have more stuff
    this.waypoints = this.renderedSystem.planetObjects; // TODO this will have more stuff
    this.bulletList = props.bulletList;
    this.flameList = props.flameList;
    this.otherShips = [];
  }
  // TODO: will need a destructor for all the created objects
  update(delta) {
    const nv = sqnorm(this.player.vel.x, this.player.vel.y);
    this.starfield.update(this.player.vel);

    this.viewframe.move(delta.deltaTime);
    this.viewframe.update();
    let scale = Math.min(this.viewframe.scale, 100 / (nv + 1)); // TODO This prevents/screws with manual zooming
    this.starfield.starContainer.scale = linScale(scale);
    if (this.renderedSystem.nebulaSprite) {
      this.renderedSystem.nebulaSprite.scale = linScale(scale);
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
    this.viewframe.scale = scale;
    this.viewframe.pos.x =
      this.player.pos.x - ((1 / scale) * this.app.screen.width) / 2;
    this.viewframe.pos.y =
      this.player.pos.y - ((1 / scale) * this.app.screen.height) / 2;
    /*} else {
          viewframe.scale = scale
        }*/
    let targetted = false;
    for (let pl of this.waypoints) {
      const dx = pl.pos.x - this.player.pos.x;
      const dy = pl.pos.y - this.player.pos.y;
      const angle = -Math.atan2(dy, dx);
      const diff = Math.cos(angle + this.player.r) - 1;

      if (diff * diff < 1e-4) {
        targetted = true;
        //log(`${pl.kind} ${pl.p.idx}`)
        planetIdx.innerHTML = pl.p.idx;
        planetTarget.innerHTML = pl.kind.slice(1);
        if (pl.kind === PlanetKinds.Sun) {
          planetTarget.innerHTML = pl.name;
        }
        planetTarget.style.color = `rgb(${pl.averagedColor[0] * 255},${
          pl.averagedColor[1] * 255
        },${pl.averagedColor[2] * 255})`;
        const dist = Math.sqrt(dx * dx + dy * dy);
        planetDistance.innerHTML = niceDistance(dist);
        break;
      }
    }
    if (!targetted) {
      planetIdx.innerHTML = "";
      planetTarget.innerHTML = "";
      planetDistance.innerHTML = "";
    }

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

      // Render and update bullets
      for (let b of flammable.bulletList) {
        if (!b.drawn) {
          b.generate();
          b.attach(this.viewframe);
        }
        b.update(delta);
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

    this.renderedSystem.update(delta);
  }
}
