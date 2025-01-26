import { set, get } from "../libs/3rdparty/idb-keyval.js";

import {
  Application,
  Graphics,
  GraphicsPath,
  Matrix,
} from "../libs/3rdparty/pixi.mjs";

import {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
  getDeviceInput,
} from "../libs/controlHandling.js";

bindGamepadHandlers();
bindKeyHandlers();

let keyMap = await get("keyMap");

if (keyMap === undefined) {
  keyMap = {
    ArrowUp: "moveUp",
    ArrowDown: "moveDown",
    ArrowLeft: "moveLeft",
    ArrowRight: "moveRight",
  };
}

let buttonMap = await get("buttonMap");

if (buttonMap === undefined) {
  buttonMap = {
    b15: "moveRight",
    b14: "moveLeft",
    b13: "moveDown",
    b12: "moveUp",
  };
}

const gameActions = {
  moveUp: () => {},
  moveDown: () => {
    const [sx, sy] = rotate(-5, 0, ship.r);
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, -2, 0, 10, 0);
    }
    ship.vx += 0.1 * Math.cos(ship.r);
    ship.vy += 0.1 * Math.sin(ship.r);
  },
  moveRight: () => {
    ship.r += 0.1;
  },
  moveLeft: () => {
    ship.r -= 0.1;
  },
};

let flameList = [];

const rotate = (x1, x2, ang) => {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const x = x1 * cos - x2 * sin;
  const y = x1 * sin + x2 * cos;
  return [x, y];
};

const addFlames = (x, y, vx, vy, e, d) => {
  const accel = 0.3;
  const rf = Math.random();
  const r = 0.3 - 0.6 * rf;
  let flame = {
    x: x,
    y: y,
    vx: vx + accel * Math.cos(d) * rf,
    vy: vy + accel * Math.sin(d) * rf,
    e: e,
  };
  const [nvx, nvy] = rotate(flame.vx, flame.vy, r);
  flame.vx = nvx;
  flame.vy = nvy;
  flameList.push(flame);
};

const app = new Application();
await app.init({ width: 1040, height: 1040 });

document.body.appendChild(app.canvas);

// Polygon (Ship)
const ship = {
  x: 200,
  y: 200,
  vx: 0,
  vy: 0,
  r: 0,
};
ship.pres = new Graphics();

const path = [-70, 50, 70, 0, -70, -50, -30, 0, -70, 50];
ship.pres.poly(path); // Draw the polygon at its initial position (relative to itself)

ship.pres.scale.set(0.2);
//ship.fill(0x3500fa);
ship.pres.stroke({ color: 0xffffff, width: 10 });
app.stage.addChild(ship.pres);

app.ticker.add((delta) => {
  handleControls(gameActions, keyMap, buttonMap);
  //ship.x += delta.deltaTime;
  ship.x += ship.vx * delta.deltaTime;
  ship.y += ship.vy * delta.deltaTime;
  ship.pres.x = ship.x;
  ship.pres.y = ship.y;
  ship.pres.angle = ship.r * (180 / Math.PI);
  for (const fl of flameList) {
    if (fl.drawn) {
      continue;
    }
    const flame = new Graphics();
    flame.moveTo(fl.x, fl.y);
    flame.circle(0, 0, 1, 1);
    flame.fill(0xffff00);
    app.stage.addChild(flame);
    flame.x = fl.x;
    flame.y = fl.y;
    fl.drawn = true;
    fl.pres = flame;
  }
  for (const fl of flameList) {
    fl.pres.x += fl.vx;
    fl.pres.y += fl.vy;
    fl.e -= 0.1;
    const ne = Math.max(0, Math.min(1, fl.e / 10));

    const red = Math.floor(255 * ne); // Red decreases from 255 to 0
    const green = Math.floor(255 * Math.pow(ne, 2)); // Green decreases faster
    const blue = 0;

    const hexColor = (red << 16) | (green << 8) | blue;
    fl.pres.tint = hexColor;
  }
  flameList = flameList.filter((fl) => fl.e > 0.1);
});
