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

import { SpaceScene, computeEntryPosition } from "./scene.js";
import { SystemMap } from "./systemMap.js";
import { generateShipName } from "./comms.js";
import { universe } from "./tinker/universe.js";

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
    if (player.e < 10 || spaceScene.torusDrive) {
      return;
    }
    player.forwardThrust(1);
    player.vel.x *= 0.999;
    player.vel.y *= 0.999;
  },
  fastUp: () => {
    if (player.e < 10 || spaceScene.torusDrive) {
      return;
    }
    player.forwardThrust(5);
    player.vel.x *= 0.997;
    player.vel.y *= 0.997;
  },
  moveDown: (f = 1) => {
    if (player.e < 10 || spaceScene.torusDrive) {
      return;
    }
    player.backThrust(1, 100.5 * 100.5);
  },
  fastDown: () => {
    if (player.e < 10 || spaceScene.torusDrive) {
      return;
    }
    player.backThrust(5, 100.5 * 100.5);
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

const makeScene = (id, fromId = null) => {
  if (fromId !== null) {
    const entry = computeEntryPosition(id, fromId);
    player.pos.x = entry.x;
    player.pos.y = entry.y;
    // Tunnel absorbs all velocity — player arrives stationary
    player.vel.x = 0;
    player.vel.y = 0;
  }
  return new SpaceScene({ app, player, controller, id });
};

let spaceScene = makeScene(0);

// CRT transition — null when inactive
let crt = null;
const CRT_FOLD   = 30; // frames
const CRT_UNFOLD = 30;

const startCRT = (destId, fromId) => {
  const overlay = new Graphics();
  app.stage.addChild(overlay);
  crt = { phase: "fold", t: 0, overlay, destId, fromId };
};

const stepCRT = (delta) => {
  crt.t += delta.deltaTime;
  const W = app.screen.width;
  const H = app.screen.height;
  const ov = crt.overlay;
  ov.clear();

  if (crt.phase === "fold") {
    const p = Math.min(1, crt.t / CRT_FOLD);
    // Black bars close in from top and bottom
    const barH = (H / 2) * p;
    ov.rect(0, 0, W, barH).fill({ color: 0x000000 });
    ov.rect(0, H - barH, W, barH).fill({ color: 0x000000 });
    // White scanline appears as bars meet
    if (p > 0.75) {
      const sp = (p - 0.75) / 0.25;
      const lh = Math.max(2, 6 * (1 - sp));
      ov.rect(0, H / 2 - lh / 2, W, lh).fill({ color: 0xffffff });
    }
    if (p >= 1) {
      // Swap the scene while screen is blacked out
      spaceScene.destroy();
      spaceScene = makeScene(crt.destId, crt.fromId);
      app.stage.addChild(ov); // restore overlay on top
      crt = { ...crt, phase: "unfold", t: 0 };
    }

  } else {
    const p = Math.min(1, crt.t / CRT_UNFOLD);
    if (p < 0.25) {
      // Scanline expands from centre
      const sp = p / 0.25;
      const lh = 2 + (H / 2 - 2) * sp;
      ov.rect(0, 0, W, H / 2 - lh / 2).fill({ color: 0x000000 });
      ov.rect(0, H / 2 + lh / 2, W, H / 2 - lh / 2).fill({ color: 0x000000 });
      ov.rect(0, H / 2 - lh / 2, W, lh).fill({ color: 0xffffff });
    } else {
      // Black bars retreat to top and bottom
      const bp = (p - 0.25) / 0.75;
      const barH = (H / 2) * (1 - bp);
      ov.rect(0, 0, W, barH).fill({ color: 0x000000 });
      ov.rect(0, H - barH, W, barH).fill({ color: 0x000000 });
    }
    if (p >= 1) {
      ov.destroy();
      crt = null;
    }
  }
};

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
      spaceScene = makeScene(number);
    },
  },
];
metaP.bind(commands);

// System map (pause)
const systemMap = new SystemMap();

// Docked / crashed screens
let dockedScreen = null;
let crashScreen  = null;

const _traderChatter = () => {
  const comms  = spaceScene.comms;
  const sysId  = spaceScene.systemId;
  const sys    = universe[sysId];
  const neighborNames = Object.keys(sys?.neighbors ?? {})
    .map(id => universe[id]?.name)
    .filter(Boolean);

  const arriving = [
    (n) => `inbound from ${n}, requesting docking clearance`,
    (n) => `arriving from ${n}, cargo secure`,
    (n) => `on final approach from ${n}`,
  ];
  const departing = [
    (n) => `departing for ${n}`,
    (n) => `cargo loaded, heading for ${n}`,
    (n) => `clearance confirmed, outbound to ${n}`,
  ];
  const idle = [
    () => `standing by`,
    () => `awaiting cargo manifest`,
    () => `docked, maintenance in progress`,
  ];

  const count = 1 + Math.floor(Math.random() * 2);
  for (let i = 0; i < count; i++) {
    const name = generateShipName();
    const roll = Math.random();
    let text;
    if (neighborNames.length > 0 && roll < 0.4) {
      const n = neighborNames[Math.floor(Math.random() * neighborNames.length)];
      text = arriving[Math.floor(Math.random() * arriving.length)](n);
    } else if (neighborNames.length > 0 && roll < 0.75) {
      const n = neighborNames[Math.floor(Math.random() * neighborNames.length)];
      text = departing[Math.floor(Math.random() * departing.length)](n);
    } else {
      text = idle[Math.floor(Math.random() * idle.length)]();
    }
    const delay = i * 1800 + Math.random() * 800;
    setTimeout(() => comms.trader(name, text), delay);
  }
};

const showDockedScreen = () => {
  const stationName = spaceScene.station?.name ?? "Station";
  spaceScene.comms.station(stationName, "docking confirmed. welcome aboard.");
  setTimeout(() => _traderChatter(), 2200);

  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed", inset: "0", background: "rgba(0,0,0,0.82)",
    color: "#00ff88", fontFamily: "monospace",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    zIndex: "9999", gap: "1em",
  });
  el.innerHTML = `
    <div style="font-size:2.2em;font-weight:bold;letter-spacing:0.15em">DOCKED</div>
    <div style="font-size:1em;color:#aaffcc">${stationName}</div>
    <div style="margin-top:1.5em;font-size:0.8em;color:#558866">[ SPACE ] to undock</div>
  `;
  document.body.appendChild(el);
  dockedScreen = el;
};

const dismissDockedScreen = () => {
  const stationName = spaceScene.station?.name ?? "Station";
  spaceScene.comms.station(stationName, "clearance granted. safe travels.");
  dockedScreen?.remove();
  dockedScreen = null;
};

const showCrashScreen = () => {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed", inset: "0", background: "rgba(40,0,0,0.88)",
    color: "#ff4444", fontFamily: "monospace",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    zIndex: "9999", gap: "1em",
  });
  el.innerHTML = `
    <div style="font-size:2.2em;font-weight:bold;letter-spacing:0.15em">SHIP DESTROYED</div>
    <div style="font-size:0.9em;color:#ff8888">hull breach on station collision</div>
    <div style="margin-top:1.5em;font-size:0.8em;color:#884444">[ SPACE ] respawn</div>
  `;
  document.body.appendChild(el);
  crashScreen = el;
};

const dismissCrashScreen = () => {
  crashScreen?.remove();
  crashScreen = null;
  // Respawn outside the station
  if (spaceScene.station) {
    const angle = Math.random() * Math.PI * 2;
    const dist  = spaceScene.station.radius * 4;
    player.pos.x = spaceScene.station.pos.x + Math.cos(angle) * dist;
    player.pos.y = spaceScene.station.pos.y + Math.sin(angle) * dist;
  }
  player.vel.x = 0;
  player.vel.y = 0;
  player.e     = 100;
  spaceScene._wasColliding = false;
  spaceScene.pendingCrash  = false;
};

document.addEventListener("keydown", (e) => {
  if (e.code === "Escape") {
    e.preventDefault();
    if (dockedScreen) { dismissDockedScreen(); return; }
    systemMap.visible ? systemMap.hide() : systemMap.show(spaceScene);
    return;
  }
  if (e.code === "Space" && (dockedScreen || crashScreen)) {
    e.preventDefault();
    if (dockedScreen) dismissDockedScreen();
    if (crashScreen)  dismissCrashScreen();
  }
});

app.ticker.add((delta) => {
  if (crt) {
    stepCRT(delta);
    return;
  }
  if (dockedScreen || crashScreen || systemMap.visible) return;
  spaceScene.update(delta);
  if (spaceScene.pendingJump) {
    const { destId, fromId } = spaceScene.pendingJump;
    spaceScene.pendingJump = null;
    startCRT(destId, fromId);
  }
  if (spaceScene.pendingDock) {
    spaceScene.pendingDock = false;
    showDockedScreen();
  }
  if (spaceScene.pendingCrash) {
    spaceScene.pendingCrash = false;
    showCrashScreen();
  }
});
