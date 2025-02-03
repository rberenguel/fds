import { set, get } from "../libs/3rdparty/idb-keyval.js";

import { planet } from "./planet.js"
import { Starfield } from "./parallax.js"

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
  VirtualPad
} from "../libs/controlHandling.js";

import { rotate, sqnorm, easeInSq } from "./math.js"

import { Viewframe } from "./viewframe.js"
import { Bobcat, Lynx } from "./ship.js"
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
    if(ship.e < 10){
      return
    }
    const nv = sqnorm(ship.vel.x, ship.vel.y)
    ship.forwardThrust(flameList)
    const _vx = ship.vel.x - 0.1 * Math.cos(ship.r) * f
    const _vy = ship.vel.y - 0.1 * Math.sin(ship.r) * f
    const _nv = sqnorm(_vx, _vy)
    if(_nv < 1500) {
      ship.vel.x = _vx 
      ship.vel.y = _vy
    }
  },
  moveDown: (f=1) => {
    if(ship.e < 10){
      return
    }
    const nv = sqnorm(ship.vel.x, ship.vel.y)
    ship.backThrust(flameList)
    const _vx = ship.vel.x + 0.1 * Math.cos(ship.r) * f
    const _vy = ship.vel.y + 0.1 * Math.sin(ship.r) * f
    const _nv = sqnorm(_vx, _vy)
    if(_nv < 1500) {
      ship.vel.x = _vx 
      ship.vel.y = _vy
    }
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
    //const [sx, sy] = rotate(15, 0, ship.r);
    //const [vx, vy] = rotate(2, 0, ship.r);
    //addBullets(ship.pos.x + sx, ship.pos.y + sy, ship.vel.x + vx, ship.vel.y + vy, ship.r)  
    ship.weapons[0].fire(ship, bulletList)
    ship.weapons[1].fire(ship, bulletList)
  }
};

let flameList = [];
let bulletList = [];
let asteroids = [];
let transients = []

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
const logg = document.getElementById("logg")
const log = (f) => {
  logg.innerHTML = f
}
const viewframe = new Viewframe() //Container();

ship = new Bobcat({
  pos: {
    x: 0,
    y: 0,
  },
})

ship.generate()

const other = new Lynx({
  pos: {
    x: 500,
    y: 200
  }
})

other.generate()

const starfield = new Starfield({width: app.renderer.width, height: app.renderer.height})
starfield.generate()
starfield.attach(app)

viewframe.attach(app)
viewframe.scale = 1;

viewframe.pos.x = -1/viewframe.scale*app.screen.width / 2
viewframe.pos.y = -1/viewframe.scale*app.screen.height / 2
ship.attach(viewframe)
other.attach(viewframe)

viewframe.vel = ship.vel

planet.generate()
planet.attach(viewframe)



app.ticker.add((delta) => {
  const nv = sqnorm(ship.vel.x, ship.vel.y)
  log(nv)
  viewframe.move(delta.deltaTime)
  viewframe.update() 
  if(nv > 200){
    let scale = 0.2*200/nv
    if(scale < 1e-5){
      scale = 1e-5
      // This should have a faster option at some point?
    }
    viewframe.scale = scale
    viewframe.pos.x = ship.pos.x-1/scale*app.screen.width / 2
    viewframe.pos.y = ship.pos.y-1/scale*app.screen.height / 2
   } else {
    //viewframe.scale = 0.2
  }
  if(ship.pos.x > 14500){
    console.log("past")
  }
 //viewframe.scale = nv > 0.2 ? 0.2 * 10000 /nv : 0.2
  controller()
  planet.update(delta)
  ship.update(delta)
  other.update(delta)
  flameList = flameList.filter(f => !f.presentation?.destroyed)
  bulletList = bulletList.filter(b => !b.presentation?.destroyed)
  for(let b of bulletList){
    if(!b.drawn){
      b.generate()
      b.attach(viewframe)
    }
    b.update(delta)
  }
  for(let f of flameList){
    if(!f.drawn){
      f.generate()
      f.attach(viewframe)
    }
    f.update(delta)
  }
});
