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

import { Ship } from "./ship.js"

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
  moveUp: () => {
    const [sx, sy] = rotate(15, 0, ship.r);
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, 1, 0, 0);
    }
    ship.vx -= 0.1 * Math.cos(ship.r);
    ship.vy -= 0.1 * Math.sin(ship.r);
  },
  moveDown: () => {
    const [sx, sy] = rotate(-5, 0, ship.r);
    for (let i = 0; i < 4; i++) {
      addFlames(ship.x + sx, ship.y + sy, -1, 0, 0);
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
  shoot: () => {
    const [sx, sy] = rotate(15, 0, ship.r);
    addBullets(ship.x + sx, ship.y + sy, 2, 0, ship.r)  
  }
};

let flameList = [];
let bulletList = [];

const rotate = (x1, x2, ang) => {
  const cos = Math.cos(ang);
  const sin = Math.sin(ang);
  const x = x1 * cos - x2 * sin;
  const y = x1 * sin + x2 * cos;
  return [x, y];
};

const addFlames = (x, y, vx, vy, d) => {
  const flame = new Flame({x: x, y: y, vx: vx, vy: vy, d: d})
  flameList.push(flame);
};

const addBullets = (x, y, vx, vy, d) => {
  const bullet = new Bullet({x: x, y: y, vx: vx, vy: vy, d: d})
  flameList.push(bullet);
};


class Flame{
  constructor(props={}){
    const accel = 0.3;
    const rf = Math.random();
    const r = 0.3 - 0.6 * rf;
    this.x = props.x
    this.y = props.y
    this.vx = props.vx + accel * Math.cos(props.d) * rf
    this.vy = props.vy + accel * Math.sin(props.d) * rf
    this.e = props.e ?? 10
    const [nvx, nvy] = rotate(this.vx, this.vy, r);
    this.vx = nvx;
    this.vy = nvy;
    const flame = new Graphics();
    flame.moveTo(this.x, this.y);
    flame.circle(0, 0, 1, 1);
    flame.fill(0xffff00);
    flame.x = this.x;
    flame.y = this.y;
    this.pres = flame;
  }

  update(){
    this.pres.x += this.vx;
    this.pres.y += this.vy;
    this.e -= 0.1;
    const ne = Math.max(0, Math.min(1, this.e / 10));

    const red = Math.floor(255 * ne); // Red decreases from 255 to 0
    const green = Math.floor(255 * Math.pow(ne, 2)); // Green decreases faster
    const blue = 0;

    const hexColor = (red << 16) | (green << 8) | blue;
    this.pres.tint = hexColor;
  }
}


class Bullet{
  constructor(props={}){
    const accel = 5;
    const rf = Math.random();
    const r = 0.01 - 0.02 * rf;
    this.x = props.x
    this.y = props.y
    console.log(props.d)
    this.vx = accel * Math.cos(props.d) * rf
    this.vy = accel * Math.sin(props.d) * rf
    this.e = props.e ?? 10
    const [nvx, nvy] = rotate(this.vx, this.vy, r);
    this.vx = nvx;
    this.vy = nvy;
    const bullet = new Graphics();
    const path = [0, 0, 2, -1, 2, 1];
    bullet.poly(path);
    bullet.fill(0xffff);
    bullet.x = this.x;
    bullet.y = this.y;
    this.pres = bullet;
  }

  update(){
    this.pres.x += this.vx;
    this.pres.y += this.vy;
    this.e -= 0.3;
    const ne = Math.max(0, Math.min(1, this.e / 10));
    const red = 0;
    const green = Math.floor(255 * ne);
    const blue = Math.floor(255 * ne);
    const hexColor = (red << 16) | (green << 8) | blue;
    this.pres.tint = hexColor;
  }
}

/*
void Scene::addPlasmaBullet() {
  Entity bu = Entity();
  float rf = static_cast<float>(rand())  // NOLINT(runtime/threadsafe_fn)
             / (RAND_MAX + 1.0);
  bu.kind = EntityKind::kPlasmaBullet;
  bu.center = player.center;
  bu.velocity = player.velocity;
  bu.energy = static_cast<int>(30 + (rand()  // NOLINT(runtime/threadsafe_fn)
                                     % 7));
  int numPoints = 4;
  Mesh mesh = Mesh{};
  bu.meshes = std::vector<Mesh>(1);
  mesh.points = std::vector<Point>(numPoints);
  mesh.presentation = std::vector<Point>(numPoints);
  mesh.points[0] = Point{0, 0};
  mesh.points[1] = Point{2, 1};
  mesh.points[2] = Point{2, -1};
  mesh.points[3] = Point{0, 0};
  mesh.presentation[0] = Point{0, 0};
  mesh.presentation[1] = Point{2, 1};
  mesh.presentation[2] = Point{2, -1};
  mesh.presentation[3] = Point{0, 0};
  for (int i = 0; i < numPoints; i++) {
    rotateTo(&mesh.points[i], &mesh.presentation[i], player.r);
  }

  bu.velocity.x += PLASMA_BULLET_ACCEL * cos(player.r);
  bu.velocity.y += PLASMA_BULLET_ACCEL * sin(player.r);
  rotateTo(&bu.velocity, &bu.velocity, 0.03 - 0.06 * rf);
  mesh.color = CYAN;
  mesh.kind = MeshKind::kPolygon;
  bu.meshes[0] = mesh;
  addToList(bu, &shotList, &availableShot);
}
*/

const app = new Application();
await app.init({ width: 600, height: 600 });

document.body.appendChild(app.canvas);

const ship = new Ship({
  x: 200,
  y: 200,
});

app.stage.addChild(ship.pres);

app.ticker.add((delta) => {
  handleControls(gameActions, keyMap, buttonMap);
  ship.update(delta)
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
