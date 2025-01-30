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

const gameActions = {
  moveUp: (f=1) => {
    if(ship.e < 10){
      return
    }
     const [sx, sy] = rotate(15, 0, ship.r);
    const [vx, vy] = rotate(1, 0, ship.r)
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, vx, vy, 0);
    }
    ship.v.x -= 0.05 * Math.cos(ship.r) * f;
    ship.v.y -= 0.05 * Math.sin(ship.r) * f;
  },
  moveDown: (f=1) => {
    if(ship.e < 10){
      return
    }
    const [sx, sy] = rotate(-5, 0, ship.r);
    const [vx, vy] = rotate(-1, 0, ship.r)
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, vx, vy, 0);
    }
    ship.v.x += 0.05 * Math.cos(ship.r) * f;
    ship.v.y += 0.05 * Math.sin(ship.r) * f;
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
    addBullets(ship.x + sx, ship.y + sy, ship.v.x + vx, ship.v.y + vy, ship.r)  
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

let ship

const shipIt = () => {
  ship = new Ship({
  x: 200,
  y: 200,
})
app.stage.addChild(ship.pres);
}

shipIt()

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

addRandomAsteroids(5)

const focusTrap = document.getElementById('focus-trap');
focusTrap.focus(); // Set focus to the hidden input


const wrap = (thing) => {
  if(thing.x > app.renderer.width){
    thing.x = 0
  }
  if(thing.y > app.renderer.height){
    thing.y = 0
  } 
  if(thing.x < 0){
    thing.x = app.renderer.width
  }
  if(thing.y < 0){
    thing.y = app.renderer.height
  }

}

app.ticker.add((delta) => {
  if(ship.e <= 0){
    const now = performance.now()
    if(now - gameOverCountdown > 2000){
      console.log("Shipping it")
      shipIt()
    }
  }
  if(asteroids.length == 0){
      addRandomAsteroids(5)
  }
  handleControls(gameActions, keyMap, buttonMap);
  ship.update(delta)
  wrap(ship)
  for(const a of asteroids){
    a.update(delta)
    wrap(a)
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
    wrap(fl)
  }
  flameList = flameList.filter((fl) => fl.e > 0);
  asteroids = asteroids.filter(a => a.e > 0);
  let brokens = []
  let collisionables = flameList.filter(f => f.kind() == "kBullet").concat([ship])
  for(let i=0;i< collisionables.length;i++){
    const fl = collisionables[i]
    if(fl.e < 0.1){
      fl.pres.destroy()
    }
    for(let a of asteroids){
      if(a.collision(fl)){
        const r = 0.15 - 0.3*Math.random()
        const e = 0.15*fl.e
        console.log(e)
        const [vx, vy] = rotate(-fl.v.x*e, -fl.v.y*e, r)
        addFlames(fl.x, fl.y, vx, vy, 0);
        console.log(fl.e)
        const breaks = a.addCrack(fl)
        if(breaks){
          transients = transients.concat(explode(a))
          const [a1, a2] = breaks
          app.stage.addChild(a1.pres);
          app.stage.addChild(a2.pres);
          brokens.push(a1)
          brokens.push(a2)
        }
        if(fl.kind() == "kShip" && fl.e > 0){
          for(let ff = 0; ff < 3; ff++){
            const zz = () => - 0.1 + 0.2*Math.random()
            addFlames(ship.x +zz(), ship.y + zz(), -ship.v.x, -ship.v.y, 0);
          }
          gameOverCountdown = performance.now()
          transients = transients.concat(explode(ship))
        }
        fl.e = 0
      }
    }
  }
  asteroids = brokens.concat(asteroids)
  transients = transients.filter(t => t.e >= 0 )
  for(let t of transients){
    t.update(delta)
    if(!t.drawn){
      app.stage.addChild(t.pres)
      t.drawn = true
    }
  }
});
