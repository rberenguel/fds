import { set, get } from "../libs/3rdparty/idb-keyval.js";

import { planets } from "./planet.js";
import { Starfield } from "./parallax.js";

import {
  Application,
  Graphics,
  Container,
  GraphicsPath,
  Matrix,
} from "../libs/3rdparty/pixi.mjs";

import {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
  getDeviceInput,
  VirtualPad,
} from "../libs/controlHandling.js";

import { rotate, sqnorm, easeInSq } from "./math.js";

import { Viewframe } from "./viewframe.js";
import { Bobcat, Lynx } from "./ship.js";
import { Bullet } from "./bullet.js";
import { Asteroid } from "./asteroid.js";
import { Flame } from "./flame.js";

import { seededRnd } from "./rnd.js";

const rnd = seededRnd(performance.now());

bindGamepadHandlers();
bindKeyHandlers();

let keyMap = await get("keyMap");

if (keyMap === undefined) {
  keyMap = {
    ArrowUp: "moveUp",
    ArrowDown: "moveDown",
    ArrowLeft: "moveLeft",
    ArrowRight: "moveRight",
    Space: "shoot",
    Comma: "zoomOut",
    Period: "zoomIn",
  };
}

let buttonMap = await get("buttonMap");

if (buttonMap === undefined) {
  buttonMap = {
    b15: "moveRight",
    b14: "moveLeft",
    b13: "moveDown",
    b12: "moveUp",
    b1: "shoot",
    //b2: "reload",
  };
}

let prevshot = -1;
let ship;
let viewframe;

const gameActions = {
  zoomOut: () => {
    viewframe.scale *= 0.9;
  },
  zoomIn: () => {
    viewframe.scale *= 1.1;
  },
  moveUp: (f = 1) => {
    if (ship.e < 10) {
      return;
    }
    const nv = sqnorm(ship.vel.x, ship.vel.y);
    ship.forwardThrust(flameList);
    const _vx = ship.vel.x - 0.1 * Math.cos(ship.r) * f;
    const _vy = ship.vel.y - 0.1 * Math.sin(ship.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < 1e6) {
      ship.vel.x = _vx;
      ship.vel.y = _vy;
    }
  },
  moveDown: (f = 1) => {
    if (ship.e < 10) {
      return;
    }
    const nv = sqnorm(ship.vel.x, ship.vel.y);
    ship.backThrust(flameList);
    const _vx = ship.vel.x + 0.1 * Math.cos(ship.r) * f;
    const _vy = ship.vel.y + 0.1 * Math.sin(ship.r) * f;
    const _nv = sqnorm(_vx, _vy);
    if (_nv < 1e6) {
      ship.vel.x = _vx;
      ship.vel.y = _vy;
    }
  },
  moveRight: (f = 1) => {
    ship.r += 0.03 * f;
  },
  moveLeft: (f = 1) => {
    ship.r -= 0.03 * f;
  },
  shoot: () => {
    if (ship.e < 10) {
      return;
    }
    const now = performance.now();
    if (now - prevshot < 100) {
      return;
    }
    prevshot = now;
    //const [sx, sy] = rotate(15, 0, ship.r);
    //const [vx, vy] = rotate(2, 0, ship.r);
    //addBullets(ship.pos.x + sx, ship.pos.y + sy, ship.vel.x + vx, ship.vel.y + vy, ship.r)
    ship.weapons[0].fire(ship, bulletList);
    ship.weapons[1].fire(ship, bulletList);
  },
};

let flameList = [];
let bulletList = [];
let asteroids = [];
let transients = [];

const app = new Application();
await app.init({ width: window.innerWidth, height: window.innerHeight });

document.body.appendChild(app.canvas);

const addRandomAsteroids = (n) => {
  for (let i = 0; i < n; i++) {
    const x = rnd() * window.innerWidth,
      y = rnd() * window.innerHeight;
    const vx = rnd(),
      vy = rnd();
    const sides = Math.floor(5 + rnd() * 6);
    const size = 12 + rnd() * 40;
    const spin = rnd() * 0.1;
    const ast = new Asteroid(
      { x: x, y: y },
      { x: vx, y: vy },
      sides,
      size,
      spin,
    );
    asteroids.push(ast);
    app.stage.addChild(ast.pres);
  }
};

// Enable interactivity
app.stage.eventMode = "static";
app.renderer.view.tabIndex = -1;
// Make sure the whole canvas area is interactive, not just the circle.
app.stage.hitArea = app.screen;

const vPadDisplacement = Math.min(app.renderer.width, app.renderer.height) / 6;

const virtualPad = new VirtualPad({
  gameActions: gameActions,
  displacement: vPadDisplacement,
  padArea: {
    ul: [0, 0],
    lr: [app.renderer.width / 2, app.renderer.height],
  },
  shootArea: {
    ul: [app.renderer.width / 2, 0],
    lr: [app.renderer.width, app.renderer.height],
  },
});
// Prevent the default behavior of touch events
app.view.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

app.view.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

app.view.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);
app.stage.addEventListener("pointerdown", (e) => {
  virtualPad.touchStart(e.global, e);
});
app.stage.addEventListener("pointermove", (e) => {
  virtualPad.touchMove(e.global, () => ship.r);
});
app.stage.addEventListener("pointerup", (e) => {
  virtualPad.touchEnd(e.global);
});

const focusTrap = document.getElementById("focus-trap");
focusTrap.focus(); // Set focus to the hidden input

const controller = handleControls(gameActions, keyMap, buttonMap);
const logg = document.getElementById("logg");
const planetTarget = document.getElementById("planet-target");
const planetDistance = document.getElementById("planet-distance");
const planetIdx = document.getElementById("planet-idx");
const log = (f) => {
  logg.innerHTML = f;
};
viewframe = new Viewframe(); //Container();

ship = new Bobcat({
  pos: {
    x: 150000,
    y: 0,
  },
});

ship.generate();

const other = new Lynx({
  pos: {
    x: 150200,
    y: 200,
  },
});

other.generate();

//const texture = giantTexture(app)
//const quad = await renderGiant(app);

const starfield = new Starfield({
  width: app.renderer.width,
  height: app.renderer.height,
});
starfield.generate(app);
starfield.attach(app);

viewframe.attach(app);
viewframe.scale = 1;

viewframe.pos.x = ((-1 / viewframe.scale) * app.screen.width) / 2;
viewframe.pos.y = ((-1 / viewframe.scale) * app.screen.height) / 2;
ship.attach(viewframe);
other.attach(viewframe);

viewframe.vel = ship.vel;

const pln = planets();

console.log(pln);

pln.map((p) => p.generate(app));
pln.map((p) => p.attach(viewframe));

const niceDistance = (dist) => {
  if (dist < 1000) {
    return String(Math.round(dist));
  }
  if (dist < 1000000) {
    return (dist / 1000).toFixed(2) + "k";
  }
  return (dist / 1000000).toFixed(2) + "M";
};

app.ticker.add((delta) => {
  const nv = sqnorm(ship.vel.x, ship.vel.y);
  starfield.update(ship.vel);
  viewframe.move(delta.deltaTime);
  viewframe.update();
  let scale = Math.min(viewframe.scale, 100 / (nv + 1)); // This prevents manual zooming
  //if(nv > 1){
  //if (scale < 1e-10) {
  //  scale = 1e-10;
  // This should have a faster option at some point?
  //}
  viewframe.scale = scale;
  viewframe.pos.x = ship.pos.x - ((1 / scale) * app.screen.width) / 2;
  viewframe.pos.y = ship.pos.y - ((1 / scale) * app.screen.height) / 2;
  /*} else {
    viewframe.scale = scale
  }*/
  let targetted = false;
  for (let pl of pln) {
    const dx = pl.pos.x - ship.pos.x;
    const dy = pl.pos.y - ship.pos.y;
    const angle = -Math.atan2(dy, dx);
    const diff = Math.cos(angle + ship.r) - 1;

    if (diff * diff < 1e-4) {
      targetted = true;
      //log(`${pl.kind} ${pl.p.idx}`)
      planetIdx.innerHTML = pl.p.idx;
      planetTarget.innerHTML = pl.kind;
      planetTarget.style.color = `rgb(${pl.averagedColor[0] * 255},${pl.averagedColor[1] * 255},${pl.averagedColor[2] * 255})`;
      const dist = Math.sqrt(dx * dx + dy * dy);
      planetDistance.innerHTML = niceDistance(dist);
      break;
      //console.log(pl.averagedColor)
      //console.log(diff)
      //console.log()
      //console.log(pl.kind)
      //console.log(pl.p.idx)
    }
  }
  if (!targetted) {
    planetIdx.innerHTML = "";
    planetTarget.innerHTML = "";
    planetDistance.innerHTML = "";
  }

  //viewframe.scale = nv > 0.2 ? 0.2 * 10000 /nv : 0.2
  pln.map((p) => p.update(delta));
  controller();

  ship.update(delta);
  other.update(delta);
  flameList = flameList.filter((f) => !f.presentation?.destroyed);
  bulletList = bulletList.filter((b) => !b.presentation?.destroyed);
  for (let b of bulletList) {
    if (!b.drawn) {
      b.generate();
      b.attach(viewframe);
    }
    b.update(delta);
  }
  for (let f of flameList) {
    if (!f.drawn) {
      f.generate();
      f.attach(viewframe);
    }
    f.update(delta);
  }
});
