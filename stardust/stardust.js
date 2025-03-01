import { set, get } from "../libs/3rdparty/idb-keyval.js";

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

import { PlanetKinds } from "./tinker/system.js";

import { PIDController } from "./pid.js";

import { rotate, sqnorm, easeInSq, sqdist } from "./math.js";

import { Viewframe } from "./viewframe.js";
import { Bobcat, Lynx } from "./ship.js";
import { Bullet } from "./bullet.js";
import { Asteroid } from "./asteroid.js";
import { Flame } from "./flame.js";

import { SpaceScene } from "./scene.js";

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
    player.viewframe.scale *= 0.9;
  },
  zoomIn: () => {
    player.viewframe.scale *= 1.1;
  },
  moveUp: (f = 1) => {
    if (player.e < 10) {
      return;
    }
    player.forwardThrust();
  },
  moveDown: (f = 1) => {
    if (player.e < 10) {
      return;
    }
    player.backThrust();
  },
  moveRight: (f = 1) => {
    player.yawRight();
  },
  moveLeft: (f = 1) => {
    player.yawLeft();
  },
  shoot: () => {
    if (player.e < 10) {
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
    player.weapons[0].fire(player, player.bulletList);
    player.weapons[1].fire(player, player.bulletList);
  },
};

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

const player = new Bobcat({
  pos: {
    x: 150000,
    y: 0,
  },
  flameList: [],
  bulletList: [], // This is a bit wonky, the scene will re-reference these
});

player.generate();

const spaceScene = new SpaceScene({
  app: app,
  player: player,
  controller: controller,
  id: 0,
});

/*const other = new Lynx({
  pos: {
    x: 150200,
    y: 200,
  },
});

other.prevShot = -1
other.generate();
other.attach(viewframe);*/

app.ticker.add((delta) => {
  spaceScene.update(delta);
});
