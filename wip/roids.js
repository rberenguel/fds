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
import { Asteroid } from "./asteroid.js"
import { Flame } from "./flame.js"
import { Entity, explode } from "./entity.js"

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

let prevshot = -1
let ship

const gameActions = {
  moveUp: (f=1) => {
    console.log("AAAA")
    if(ship.e < 10){
      return
    }
    const [sx, sy] = rotate(15, 0, ship.r);
    const [vx, vy] = rotate(1, 0, ship.r)
    for (let i = 0; i < 4; i++) {
      //addFlames(ship.pos.x + sx, ship.pos.y + sy, vx, vy, 0);
    }
    ship.vel.x -= 0.05 * Math.cos(ship.r) * f;
    ship.vel.y -= 0.05 * Math.sin(ship.r) * f;
  },
  moveDown: (f=1) => {
    if(ship.e < 10){
      return
    }
    const [sx, sy] = rotate(-5, 0, ship.r);
    const [vx, vy] = rotate(-1, 0, ship.r)
    for (let i = 0; i < 4; i++) {
      //addFlames(ship.pos.x + sx, ship.pos.y + sy, vx, vy, 0);
    }
    ship.vel.x += 0.05 * Math.cos(ship.r) * f;
    ship.vel.y += 0.05 * Math.sin(ship.r) * f;
  },
  moveRight: (f=1) => {
    ship.r += 0.05*f;
  },
  moveLeft: (f=1) => {
    ship.r -= 0.05*f;
  },
  shoot: () => {
    if(ship.e < 10){
      return
    }
    const now = performance.now()
    if(now-prevshot < 100){
      return;
    }
    prevshot = now
    const [sx, sy] = rotate(15, 0, ship.r);
    const [vx, vy] = rotate(2, 0, ship.r);
    addBullets(ship.pos.x + sx, ship.pos.y + sy, ship.vel.x + vx, ship.vel.y + vy, ship.r)  
  }
};

let flameList = [];
let bulletList = [];
let asteroids = [];
let transients = []

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


const addRandomAsteroids = (n) => {
  for(let i =0; i< n; i++){
    const x = Math.random()*window.innerWidth, y = Math.random()*window.innerHeight
    const vx = Math.random(), vy = Math.random()
    const sides = Math.floor(5 + Math.random()*6)
    const size = 12 + Math.random()*40
    const spin = Math.random()*0.1
    const ast = new Asteroid({x: x, y: y}, {x: vx, y: vy}, sides, size, spin)
    asteroids.push(ast)
    app.stage.addChild(ast.pres);
  }
}

let gameOverCountdown = -1

ship = new Ship({
  pos: {
    x: 200,
    y: 200,
  }
})


ship.generate()
ship.attach(app)

/*const shipIt = () => {
  ship = new Ship({
  x: 200,
  y: 200,
})*/
//app.stage.addChild(ship.pres);
//}

//shipIt()

// Enable interactivity
app.stage.eventMode = 'static';
app.renderer.view.tabIndex = -1;
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
    virtualPad.touchMove(e.global, () => ship.r)
  });
app.stage.addEventListener('pointerup', (e) => {
  virtualPad.touchEnd(e.global); 
});


const focusTrap = document.getElementById('focus-trap');
focusTrap.focus(); // Set focus to the hidden input


const wrap = (thing) => {
  if(thing.pos.x > app.renderer.width){
    thing.pos.x = 0
  }
  if(thing.pos.y > app.renderer.height){
    thing.pos.y = 0
  } 
  if(thing.pos.x < 0){
    thing.pos.x = app.renderer.width
  }
  if(thing.pos.y < 0){
    thing.pos.y = app.renderer.height
  }

}

const controller = handleControls(gameActions, keyMap, buttonMap)

app.ticker.add((delta) => {
  /*if(ship.e <= 0){
    const now = performance.now()
    if(now - gameOverCountdown > 2000){
      console.log("Shipping it")
      shipIt()
    }
  }*/
  controller()
  ship.update(delta)
  wrap(ship)

});
