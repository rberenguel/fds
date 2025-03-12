import { metaP } from "./metap/metap.js";

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
} from "../libs/controller/controlHandling.js";

import { VirtualPad } from "../libs/controller/virtualPad.js";

import { Bobcat, Lynx } from "./ship.js";
import { Asteroid } from "./asteroid.js";

import { SpaceScene } from "./scene.js";

import { seededRnd } from "./rnd.js";

const rnd = seededRnd(performance.now());

bindGamepadHandlers();
bindKeyHandlers();

let keyMap = await get("keyMap");

if (keyMap === undefined) {
  keyMap = {
    ArrowUp: "moveUp",
    KeyD: "fastDown", // I don't like that this uses keycodes, this is technically S
    KeyW: "fastUp",
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
  fastUp: () => {
    if (player.e < 10) {
      return;
    }
    player.forwardThrust(5);
  },
  moveDown: (f = 1) => {
    if (player.e < 10) {
      return;
    }
    player.backThrust();
  },
  fastDown: () => {
    if (player.e < 10) {
      return;
    }
    player.backThrust(5);
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

let flameList = [];
let bulletList = [];

const player = new Bobcat({
  pos: {
    x: 150000,
    y: 0,
  },
});

player.generate();

let spaceScene = new SpaceScene({
  app: app,
  player: player,
  controller: controller,
  id: 0,
});

const commands = [
  {
    title: "Add PID controlled ship",
    lambda: () => {
      const other = new Lynx({
        pos: {
          x: player.pos.x + 1000,
          y: player.pos.y + 500,
        },
      });

      other.prevShot = -1;
      other.action = () => "kChase";
      other.generate();
      other.attach(spaceScene.viewframe);
      spaceScene.otherShips.push(other);
    },
  },
  {
    title: "Go to system",
    inputType: "number",
    lambda: (number) => {
      app.stage.removeChildren();
      spaceScene = new SpaceScene({
        app: app,
        player: player,
        controller: controller,
        id: number,
      });
    },
  },
];
metaP.bind(commands);

app.ticker.add((delta) => {
  spaceScene.update(delta);
});
