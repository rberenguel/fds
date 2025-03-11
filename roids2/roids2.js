import { set, get } from "../libs/3rdparty/idb-keyval.js";

import { Msgs } from "../libs/msgs/msgs.js";
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
import { sqnorm } from "../stardust/math.js";

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

    player.forwardThrust(1, 500);
  },
  moveDown: (f = 1) => {
    if (player.e < 10) {
      return;
    }

    player.backThrust(1, 500);
  },
  moveRight: (f = 1) => {
    player.yawRight(f);
  },
  moveLeft: (f = 1) => {
    player.yawLeft(f);
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

const msgs = new Msgs();

const isLandscape = () =>
  window.screen.orientation.angle === 90 ||
  window.screen.orientation.angle === -90 ||
  window.screen.orientation.type.startsWith("landscape");

const isMobile = () => {
  const userAgent = navigator.userAgent.toLowerCase();
  return /android|iphone|ipad|ipod|mobi/i.test(userAgent);
};

const needsStandalone = () => {
  const standalone = window.navigator.standalone === true;
  const devel =
    window.location.hostname.startsWith("192") ||
    window.location.hostname.startsWith("127");
  return isMobile() && !standalone && !devel;
};

const landscapeDimensions = getLandscapeDimensions(); // Renamed variable
console.log(landscapeDimensions);
const app = new Application({
  autoResize: true,
  resolution: 1,
  width: landscapeDimensions.width,
  height: landscapeDimensions.height,
});

//const app = new Application({ autoResize: true, resolution: devicePixelRatio });
await app.init({
  id: "roids2",
  width: landscapeDimensions.width,
  height: landscapeDimensions.height,
}); // Ugh?

document.body.appendChild(app.canvas);

// Enable interactivity
app.stage.eventMode = "static";
app.renderer.view.tabIndex = -1;
// Make sure the whole canvas area is interactive, not just the circle.
app.stage.hitArea = app.screen;

const vPadDisplacement = Math.min(app.renderer.width, app.renderer.height) / 30;

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

const scale = isMobile() ? 0.12 : SpaceScene.MAXSCALE;

console.info("Generating player");

const player = new Lynx({
  pos: {
    x: (0.5 * app.renderer.width) / scale,
    y: (0.5 * app.renderer.height) / scale,
  },
});

player.generate();

player.lives = 3;

let spaceScene = new SpaceScene({
  app: app,
  player: player,
  controller: controller,
  scale: scale,
  id: 0, // TODO remove
});

console.info("Scene constructed");

const scoreDiv = document.getElementById("score");
const livesDiv = document.getElementById("lives");

const commands = [
  {
    title: "Play",

    lambda: () => {
      player.lives = 3;
      player.pos = {
        x: (0.5 * app.renderer.width) / scale,
        y: (0.5 * app.renderer.height) / scale,
      };
      player.vel = {
        x: 0,
        y: 0,
      };
      player.r = 0;
      for (let a of spaceScene.asteroids) {
        a.e = -1;
      }
      for (let f of spaceScene.flameList) {
        f.e = -1;
      }
      spaceScene.score = 0;
      livesDiv.textContent = 3;
      scoreDiv.textContent = 0;
      msgs.hide();
    },
  },
  {
    title: "Add PID controlled ship",
    lambda: () => {
      console.log("clicked");
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
msgs.attach();

document.getElementById("menu").addEventListener("click", (ev) => {
  metaP.metaP();
});

let countDown = 0;

app.ticker.add((delta) => {
  if (metaP.metaPGlass.style.display === "block") {
    return;
  }
  if (!isLandscape() && !msgs.visible) {
    msgs.text(
      "Please rotate your device, this can only be played in landscape mode",
    );
    msgs.show();
    app.canvas.style.display = "none";
    return;
  }
  if (needsStandalone() & !msgs.visible) {
    msgs.text(
      "Please install as a standalone web app (Usually share -> Add to Home Screen)",
    );
    msgs.show();
    app.canvas.style.display = "none";
    return;
  }
  if (player.lives <= 0 && !msgs.visible) {
    msgs.html(
      `Game over!<br/>Select <em>Play</em> in the upper-left menu to play again`,
    );
    msgs.show();
    return;
  }
  if (spaceScene.asteroids.length === 0) {
    if (countDown === 0) {
      // Asteroids just became empty
      countDown = performance.now() + 3000; // Start the 3-second countdown
      msgs.text("");
      msgs.show();
    } else if (performance.now() >= countDown) {
      // 3 seconds have passed
      msgs.hide();
      spaceScene.addRandomAsteroids(5);
      countDown = 0; // Reset the countdown
    } else {
      // Update the countdown display
      const remainingTime = Math.ceil((countDown - performance.now()) / 1000); // Calculate remaining seconds
      msgs.text(`Next wave in: ${remainingTime} seconds`);
    }
  } else {
    // Asteroids are present, reset the countdown
    countDown = 0;
  }
  if (msgs.visible) {
    return;
  }
  spaceScene.update(delta);
});

function getLandscapeDimensions() {
  // Renamed function
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  if (screenWidth >= screenHeight) {
    return { width: screenWidth, height: screenHeight };
  } else {
    return { width: screenHeight, height: screenWidth };
  }
}

function resizeForLandscape() {
  // Renamed function
  const landscapeDimensions = getLandscapeDimensions(); // Using renamed function
  app.renderer.resize(landscapeDimensions.width, landscapeDimensions.height); // Using renamed variable
  console.log(
    `Resized for Landscape: Width: ${landscapeDimensions.width}, Height: ${landscapeDimensions.height}`,
  );
}

function handleOrientationChange() {
  if (window.screen.orientation === 90 || window.screen.orientation === -90) {
    // Landscape check
    document.body.classList.add("landscape");
  } else {
    document.body.classList.remove("landscape");
  }
  msgs.hide();
  app.canvas.style.display = "block";
  resizeForLandscape(); // Still resize your canvas (see next step)
}

window.addEventListener("orientationchange", handleOrientationChange);
handleOrientationChange(); // Call once on load

/*
function resizeApp() {
  if (window.visualViewport) {
      app.renderer.resize(window.visualViewport.width, window.visualViewport.height);
  } else {
      app.renderer.resize(window.outerWidth, window.outerHeight); // Fallback
  }
}

// Initial resize
resizeApp();

// Resize on visual viewport changes
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resizeApp);
}

//resize on window resize as a fallback.
window.addEventListener('resize', resizeApp);
*/
