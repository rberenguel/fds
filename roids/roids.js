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
  VirtualPad
} from "../libs/controlHandling.js";

import { rotate } from "./math.js"

import { Ship } from "./ship.js"
import { Bullet } from "./bullet.js"
import { Flame } from "./flame.js"

bindGamepadHandlers();
bindKeyHandlers();

let keyMap = await get("keyMap");

if (keyMap === undefined) {
  keyMap = {
    ArrowUp: "moveUp",
    ArrowDown: "moveDown",
    ArrowLeft: "moveLeft",
    ArrowRight: "moveRight",
    Space: "shoot"
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

const gameActions = {
  moveUp: (f=1) => {
    const [sx, sy] = rotate(15, 0, ship.r);
    const [vx, vy] = rotate(1, 0, ship.r)
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, vx, vy, 0);
    }
    ship.vx -= 0.05 * Math.cos(ship.r) * f;
    ship.vy -= 0.05 * Math.sin(ship.r) * f;
  },
  moveDown: (f=1) => {
    const [sx, sy] = rotate(-5, 0, ship.r);
    const [vx, vy] = rotate(-1, 0, ship.r)
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, vx, vy, 0);
    }
    ship.vx += 0.05 * Math.cos(ship.r) * f;
    ship.vy += 0.05 * Math.sin(ship.r) * f;
  },
  moveRight: (f=1) => {
    ship.r += 0.05*f;
  },
  moveLeft: (f=1) => {
    ship.r -= 0.05*f;
  },
  shoot: () => {
    const [sx, sy] = rotate(15, 0, ship.r);
    const [vx, vy] = rotate(2, 0, ship.r);
    addBullets(ship.x + sx, ship.y + sy, vx, vy, ship.r)  
  }
};

let flameList = [];
let bulletList = [];

const addFlames = (x, y, vx, vy, d) => {
  const flame = new Flame({x: x, y: y, vx: vx, vy: vy, d: d})
  flameList.push(flame);
};

const addBullets = (x, y, vx, vy, d) => {
  const bullet = new Bullet({x: x, y: y, vx: vx, vy: vy, d: d})
  flameList.push(bullet);
};


const app = new Application();
await app.init({ width: window.innerWidth, height: window.innerHeight });

document.body.appendChild(app.canvas);

const ship = new Ship({
  x: 200,
  y: 200,
});

    // Enable interactivity
    app.stage.eventMode = 'static';

    // Make sure the whole canvas area is interactive, not just the circle.
    app.stage.hitArea = app.screen;


const vPadDisplacement = Math.min(app.renderer.width, app.renderer.height)/6

const virtualPad = new VirtualPad({
  gameActions: gameActions, 
  displacement: vPadDisplacement,
  padArea: {
    ul: [0, 0], lr: [app.renderer.width/2, app.renderer.height]
  },
  shootArea: {
    ul: [app.renderer.width/2, 0],
    lr: [app.renderer.width, app.renderer.height]
  }
})
// Prevent the default behavior of touch events
app.view.addEventListener('touchstart', (e) => {
  e.preventDefault();
}, { passive: false });

app.view.addEventListener('touchmove', (e) => {
  e.preventDefault();
}, { passive: false });

app.view.addEventListener('touchend', (e) => {
  e.preventDefault();
}, { passive: false });
    app.stage.addEventListener('pointerdown', (e) =>
    {
      virtualPad.touchStart(e.global, e)
    });
   app.stage.addEventListener('pointermove', (e) =>
    {
      virtualPad.touchMove(e.global, ship.r)
    });
app.stage.addEventListener('pointerup', (e) => {
  virtualPad.touchEnd(e.global); 
});
app.stage.addChild(ship.pres);

app.ticker.add((delta) => {
  handleControls(gameActions, keyMap, buttonMap);
  ship.update(delta)
  // TODO: wrap method
  if(ship.x > app.renderer.width){
    ship.x = 0
  }
  if(ship.y > app.renderer.height){
    ship.y = 0
  } 
  if(ship.x < 0){
    ship.x = app.renderer.width
  }
  if(ship.y < 0){
    ship.y = app.renderer.height
  }
  for (const fl of flameList) {
    if (fl.drawn) {
      continue;
    }
    app.stage.addChild(fl.pres);
    fl.drawn = true
  }
  for (const fl of flameList) {
    fl.update()    
  }
  flameList = flameList.filter((fl) => fl.e > 0.1);
});
