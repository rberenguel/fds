import { set, get } from "../libs/3rdparty/idb-keyval.js";

import { Application } from "../libs/3rdparty/pixi.mjs";

import {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
  getDeviceInput,
  VirtualPad,
} from "../libs/controlHandling.js";

import { Bobcat, Lynx } from "../stardust/ship.js";

import { SpaceScene } from "./scene.js";

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
    KeyQ: "menu",
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
    player.weapons[0].fire(player, player.bulletList);
    player.weapons[1].fire(player, player.bulletList);
  },
  menu: () => {
    metaP.metaP();
  },
};

const app = new Application();
await app.init({ width: window.innerWidth, height: window.innerHeight });

document.body.appendChild(app.canvas);

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

const player = new Lynx({
  pos: {
    x: (0.5 * app.renderer.width) / SpaceScene.MAXSCALE,
    y: (0.5 * app.renderer.height) / SpaceScene.MAXSCALE,
  },
});

player.generate();

player.lives = 3;

let spaceScene = new SpaceScene({
  app: app,
  player: player,
  controller: controller,
  id: 0, // TODO remove
});

const scoreDiv = document.getElementById("score");
const livesDiv = document.getElementById("lives");
const messagesDiv = document.getElementById("messages");

const commands = [
  {
    title: "Play",

    lambda: () => {
      player.lives = 3;
      player.pos = {
        x: (0.5 * app.renderer.width) / SpaceScene.MAXSCALE,
        y: (0.5 * app.renderer.height) / SpaceScene.MAXSCALE,
      };
      for (let a of spaceScene.asteroids) {
        a.e = -1;
      }
      for (let f of spaceScene.flameList) {
        f.e = -1;
      }
      spaceScene.score = 0;
      livesDiv.textContent = 3;
      scoreDiv.textContent = 0;
      messagesDiv.style.display = "none";
    },
  },
  {
    title: "Add PID controlled ship",
    lambda: () => {
      const other = new Bobcat({
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
    title: "Add asteroids",
    inputs: [{ title: "How many?", default: "1" }],
    lambda: (num) => {
      spaceScene.addRandomAsteroids(parseInt(num));
    },
  },
];
metaP.bind(commands);

document.getElementById("menu").addEventListener("click", (ev) => {
  metaP.metaP();
});

let countDown = 0;

app.ticker.add((delta) => {
  if (metaP.metaPGlass.style.display === "block") {
    return;
  }
  if (player.lives <= 0) {
    messagesDiv.textContent = `Game over! Select 'Start' in the upper-left menu to play again`;
    messagesDiv.style.display = "block";
    return;
  }
  if (spaceScene.asteroids.length === 0) {
    if (countDown === 0) {
      // Asteroids just became empty
      countDown = performance.now() + 3000; // Start the 3-second countdown
      messagesDiv.textContent = "";
      messagesDiv.style.display = "block";
    } else if (performance.now() >= countDown) {
      // 3 seconds have passed
      messagesDiv.style.display = "none";
      spaceScene.addRandomAsteroids(5);
      countDown = 0; // Reset the countdown
    } else {
      // Update the countdown display
      const remainingTime = Math.ceil((countDown - performance.now()) / 1000); // Calculate remaining seconds
      messagesDiv.textContent = `Next wave in: ${remainingTime} seconds`;
    }
  } else {
    // Asteroids are present, reset the countdown
    countDown = 0;
  }
  spaceScene.update(delta);
});
