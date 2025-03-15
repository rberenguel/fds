import { set, get } from "../libs/3rdparty/idb-keyval.js";

import { Msgs } from "../libs/msgs/msgs.js";
import { Application } from "../libs/3rdparty/pixi.mjs";

import {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
} from "../libs/controller/controlHandling.js";

import { VirtualPad } from "../libs/controller/virtualPad.js";

import { Bobcat, Lynx } from "../stardust/ship.js";

import { SpaceScene } from "./scene.js";

import {
  PlasmaGun,
  GaussCannon,
  MassDriverGun,
  PhotonTorpedoLauncher,
} from "../stardust/weapons/weapons.js";

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
    Enter: "secondaryShoot",
    KeyQ: "menu",
    KeyX: "weaponSwitch",
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
    b2: "secondaryShoot",
    b3: "weaponSwitch",
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
    player.weapons[0 + player.primaryWeaponShift].fire(
      player,
      player.bulletList,
    );
    player.weapons[1 + player.primaryWeaponShift].fire(
      player,
      player.bulletList,
    );
    showHUDInfo();
  },
  secondaryShoot: () => {
    if (player.e < 10) {
      return;
    }
    const now = performance.now();
    if (now - prevshot < 1000) {
      return;
    }
    prevshot = now;
    try {
      player.secondaryWeapons[0 + player.secondaryWeaponShift].fire(
        player,
        player.bulletList,
      );
    } catch {}
  },
  weaponSwitch: () => {
    const now = performance.now();
    console.log(player.weapons.length);
    if (now - prevshot < 100) {
      return;
    }
    prevshot = now;
    console.log("Shifted weapons");
    player.primaryWeaponShift =
      (player.primaryWeaponShift + 2) % player.weapons.length;
    player.secondaryWeaponShift =
      (player.secondaryWeaponShift + 1) % player.secondaryWeapons.length;
    showHUDInfo();
  },
  menu: () => {
    metaP.metaP();
  },
};

const showHUDInfo = () => {
  const wa = player.weapons[0 + player.primaryWeaponShift];
  const wb = player.weapons[1 + player.primaryWeaponShift];
  const wc = player.secondaryWeapons[0 + player.secondaryWeaponShift];
  let ammoP = undefined;
  let ammoS = undefined;
  if (player.ammo[wa.kind]) {
    ammoP = `${player.ammo[wa.kind].toFixed(0)}`;
  }
  if (player.ammo[wc.kind]) {
    ammoS = `${player.ammo[wc.kind].toFixed(0)}`;
  }
  const a = wa.html;
  const b = wb.html;
  const c = wc.html;
  const hull = document.getElementById("hull");
  hull.innerHTML = `H:${player.e.toFixed(0)}`;
  const containerPrimary = document.getElementById("primary-weapon-types");
  containerPrimary.innerHTML = `W1: ${a}${b}`;
  const containerSecondary = document.getElementById("secondary-weapon-types");
  containerSecondary.innerHTML = `W2: ${c}`;
  const ammoPContainer = document.getElementById("primary-weapon-ammo");
  const ammoSContainer = document.getElementById("secondary-weapon-ammo");
  if (ammoP) {
    ammoPContainer.textContent = `(${ammoP})`;
  } else {
    ammoPContainer.textContent = "";
  }
  if (ammoS) {
    ammoSContainer.textContent = `(${ammoS})`;
  } else {
    ammoSContainer.textContent = "";
  }
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
  debug: true,
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

let weapons = [];
let secondaryWeapons = [];
try {
  const plasmaGun1 = new PlasmaGun({
    pos: {
      x: -40,
      y: 40,
    },
  });
  const plasmaGun2 = new PlasmaGun({
    pos: {
      x: -40,
      y: -40,
    },
  });
  const photonTorpedo = new PhotonTorpedoLauncher({
    pos: {
      x: 0,
      y: 0,
    },
  });
  secondaryWeapons = [photonTorpedo];

  weapons = [plasmaGun1, plasmaGun2];
} catch (err) {
  console.error(err);
}

const player = new Lynx({
  pos: {
    // Note that this initial positioning sets up the viewframe center too
    x: (0.5 * app.renderer.width) / scale,
    y: (0.5 * app.renderer.height) / scale,
  },
  weapons: weapons,
  secondaryWeapons: secondaryWeapons,
});
player.recoveryRate = 0.04;

const resetPlayerPVA = () => {
  player.pos = {
    x: (0.5 * app.renderer.width) / scale,
    y: (0.5 * app.renderer.height) / scale,
  };
  player.vel = {
    x: 0,
    y: 0,
  };
  player.r = 0;
  if (player.weapons[0].ammo) {
    player.ammo[player.weapons[0].kind] = 100;
  }
  if (player.secondaryWeapons[0].ammo) {
    player.ammo[player.secondaryWeapons[0].kind] = 2;
  }
  player.e = 1000; // TODO: this should be the current player maximum instead
};

for (let w of player.weapons) {
  w.source = player._id;
}

for (let w of player.secondaryWeapons) {
  w.source = player._id;
}
player.ammo = {};
player.ammo[MassDriverGun.kind] = 30;
player.ammo[PhotonTorpedoLauncher.kind] = 2;
console.log(player.ammo);
showHUDInfo();

player.generate();

player.lives = 1;

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
      player.lives = 1;
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
      for (let o of spaceScene.otherShips) {
        o.e = -1;
      }
      for (let f of spaceScene.flameList) {
        f.e = -1;
      }
      level = 0;
      spaceScene.score = 0;
      livesDiv.textContent = 3;
      scoreDiv.textContent = 0;
      msgs.hide();
    },
  },
  {
    title: "To level",
    inputs: [{ title: "Which?", default: "10" }],
    lambda: (lev) => {
      level = lev;
      for (let a of spaceScene.asteroids) {
        a.e = -1;
      }
      for (let o of spaceScene.otherShips) {
        o.e = -1;
      }
      for (let f of spaceScene.flameList) {
        f.e = -1;
      }
      const massDriverGun1 = new MassDriverGun({
        pos: {
          x: -40,
          y: 40,
        },
      });
      const massDriverGun2 = new MassDriverGun({
        pos: {
          x: -40,
          y: -40,
        },
      });
      player.weapons = [massDriverGun1, massDriverGun2];
      player.ammo[MassDriverGun.kind] = 100;
      for (let w of player.weapons) {
        w.source = player._id;
      }
    },
  },
  {
    title: "Add asteroids",
    inputs: [{ title: "How many?", default: "1" }],
    lambda: (num) => {
      spaceScene.addRandomAsteroids(parseInt(num));
    },
  },
  {
    title: "Add enemies",
    inputs: [{ title: "How many?", default: "1" }],
    lambda: (num) => {
      spaceScene.addRandomEnemies(parseInt(num) - 1);
    },
  },
];
metaP.bind(commands);
msgs.attach();

document.getElementById("menu").addEventListener("click", (ev) => {
  metaP.metaP();
});

let countDown = 0;
let level = 0;
let chosePowerup = true;

const countsPerLevel = (level) => {
  const obj = {
    level: level,
  };
  if (level === 0) {
    return {
      level: 0,
      asteroids: 0,
      ships: 0,
    };
  }
  if (level === -1) {
    return {
      level: -1,
      asteroids: 1,
      ships: 0,
    };
  }
  if (level <= 1) {
    return { ...obj, asteroids: 2, ships: 0 };
  }
  if (level < 5) {
    return { ...obj, asteroids: 5, ships: 1 };
  }
  if (level < 9) {
    return { ...obj, asteroids: 6, ships: 2 };
  }
  if (level < 15) {
    return { ...obj, asteroids: 6, ships: 3 };
  }
  if (level < 19) {
    return { ...obj, asteroids: 6, ships: 4 };
  }
  if (level == 19) {
    return { ...obj, asteroids: 7, ships: 5 };
  }
  if (level == 20) {
    return { ...obj, asteroids: 7, ships: 6 };
  }
  const a = countsPerLevel(level - 20).asteroids;
  const s = countsPerLevel(level - 20).ships + 1;
  return {
    asteroids: a,
    ships: s,
    level: level,
  };
};

let choosing = false;

const glass = document.getElementById("glass");

const offerChoices = (options = []) => {
  // Options is a list of powerups, of the form
  // {id: "kPowerup", name: "Human name", description: "Description"}
  glass.style.display = "block";
  const powerupContainer = document.getElementById("powerup-container");

  if (!powerupContainer) {
    console.error("Error: .powerup-container element not found in the HTML.");
    return;
  }

  powerupContainer.style.display = "flex";

  const choiceElements = document.querySelectorAll(".powerup-choice");
  if (choiceElements.length !== 2) {
    console.error(
      "Error: Exactly two .powerup-choice elements are expected in the HTML.",
    );
    return;
  }

  const glyphElements = document.querySelectorAll(".choice-glyph");
  const descriptionElements = document.querySelectorAll(".choice-description");

  const choicesToRender = options.slice(0, 2);

  choicesToRender.forEach((option, index) => {
    const choiceElement = choiceElements[index];
    choiceElement.dataset.id = option.id;

    const glyphElement = glyphElements[index];
    glyphElement.innerHTML = `<img src="media/glyphs/${option.glyph}"></img>`;

    const descriptionElement = descriptionElements[index];
    descriptionElement.innerHTML = option.description();

    choiceElement.addEventListener("click", () => {
      // You will fill this up later to handle the choice
      console.log(`Power-up chosen with id: ${option.id}`);
      option.lambda();
      glass.style.display = "none";
      powerupContainer.style.display = "none";
      chosePowerup = true;
      choosing = false;
    });
  });
};

app.ticker.add((delta) => {
  //return;
  if (metaP.metaPGlass.style.display === "block") {
    return;
  }
  if (choosing) {
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
  if (spaceScene.otherShips.length == 0 && level > 1) {
    // Refill ammo immediately if there are no enemy ships. Why not?
    if (player.weapons[0].ammo) {
      player.ammo[player.weapons[0].kind] = 100;
    }
    if (player.secondaryWeapons[0].ammo) {
      player.ammo[player.secondaryWeapons[0].kind] = 2;
    }
  }
  if (!chosePowerup && spaceScene.asteroids.length === 0) {
    // TODO
    choosing = true;
    offerChoices([
      {
        id: "kMassDriverWeapon",
        name: "Mass Driver",
        description: () => {
          const title = "<h2>Primary weapon</h2>";
          const htmlA = MassDriverGun.present();
          const htmlB = player.weapons[0].present();
          return `${title} ${htmlA} <h3>replace</h3> ${htmlB}`;
        },
        glyph: "massdriver.svg",
        lambda: () => {
          const massDriverGun1 = new MassDriverGun({
            pos: {
              x: -40,
              y: 40,
            },
          });
          const massDriverGun2 = new MassDriverGun({
            pos: {
              x: -40,
              y: -40,
            },
          });
          player.weapons = [massDriverGun1, massDriverGun2];
          player.ammo[MassDriverGun.kind] = 100;
          for (let w of player.weapons) {
            w.source = player._id;
          }
        },
      },
      {
        id: "kGaussCannon",
        name: "Gauss Cannon",
        description: () => {
          const title = "<h2>Secondary weapon</h2>";
          const htmlA = GaussCannon.present();
          const htmlB = player.secondaryWeapons[0].present();
          return `${title} ${htmlA} <h3>replace</h3> ${htmlB}`;
        },
        glyph: "gausscannon.svg",
        lambda: () => {
          const railGun = new GaussCannon({
            pos: {
              x: 0,
              y: 0,
            },
          });
          player.secondaryWeapons = [railGun];
          for (let w of player.secondaryWeapons) {
            w.source = player._id;
          }
        },
      },
    ]);

    return;
  }
  if (spaceScene.asteroids.length === 0) {
    if (countDown === 0 && chosePowerup) {
      // Asteroids just became empty and a powerup has been chosen
      countDown = performance.now() + 3000; // Start the 3-second countdown
      msgs.text("");
      msgs.show();
      level++;
    } else if (performance.now() >= countDown) {
      // 3 seconds have passed
      msgs.hide();
      const nextLevel = countsPerLevel(level);
      resetPlayerPVA();
      spaceScene.addAsteroids(nextLevel.asteroids);
      spaceScene.addEnemies(nextLevel.ships);
      countDown = 0; // Reset the countdown
      chosePowerup = false;
    } else {
      // Update the countdown display
      const remainingTime = Math.ceil((countDown - performance.now()) / 1000); // Calculate remaining seconds
      msgs.html(`Wave ${level} in ${remainingTime} seconds`);
    }
  } else {
    // Asteroids are present, reset the countdown
    countDown = 0;
  }
  if (msgs.visible) {
    return;
  }
  spaceScene.update(delta);
  showHUDInfo(); // TODO: remove all the other calls
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
