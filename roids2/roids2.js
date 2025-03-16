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
  LaserGun,
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
    const firerate = player.weapons[0 + player.primaryWeaponShift].firerate;
    if (now - prevshot < firerate) {
      return;
    }
    prevshot = now;
    if (
      (player.ammo[player.weapons[0 + player.primaryWeaponShift].kind]?.count ??
        10) < 2
    ) {
      return;
    }
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
    const firerate =
      player.secondaryWeapons[0 + player.secondaryWeaponShift].firerate;
    const now = performance.now();
    if (now - prevshot < firerate) {
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
    ammoP = `${(player.ammo[wa.kind].count ?? 0).toFixed(0)}`;
  }
  if (player.ammo[wc.kind]) {
    ammoS = `${(player.ammo[wc.kind].count ?? 0).toFixed(0)}`;
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

const baseWeapons = () => {
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
      color: 0x00ddff,
      haloColor: 0x11ddff,
    });
    secondaryWeapons = [photonTorpedo];

    weapons = [plasmaGun1, plasmaGun2];
  } catch (err) {
    console.error(err);
  }
  return { weapons: weapons, secondaryWeapons: secondaryWeapons };
};

const { weapons, secondaryWeapons } = baseWeapons();

const player = new Lynx({
  pos: {
    // Note that this initial positioning sets up the viewframe center too
    x: (0.5 * app.renderer.width) / scale,
    y: (0.5 * app.renderer.height) / scale,
  },
  weapons: weapons,
  secondaryWeapons: secondaryWeapons,
});
player.human = true;
player.recoveryRate = 0.04;
player.emergencyBrakes = false;
player.pointSight = false;

const resetPlayerPVA = (regenerate = false) => {
  player.human = true;
  player.pos = {
    x: (0.5 * app.renderer.width) / scale,
    y: (0.5 * app.renderer.height) / scale,
  };
  player.vel = {
    x: 0,
    y: 0,
  };
  player.r = 0;
  player.lives = 1;
  if (player.weapons[0].ammo) {
    player.ammo[player.weapons[0].kind] = {};
    player.ammo[player.weapons[0].kind].count = player.weapons[0].ammoMax;
    player.ammo[player.weapons[0].kind].max = player.weapons[0].ammoMax;
  }
  if (player.secondaryWeapons[0].ammo) {
    player.ammo[player.secondaryWeapons[0].kind] = {};
    player.ammo[player.secondaryWeapons[0].kind].count =
      player.secondaryWeapons[0].ammoMax;
    player.ammo[player.secondaryWeapons[0].kind].max =
      player.secondaryWeapons[0].ammoMax;
  }
  spaceScene.player = player;
  player.e = 1000; // TODO: this should be the current player maximum instead
  if (regenerate) {
    player.generate(true);
    spaceScene.bindPlayer(); // This is like very disconnected?
  }
};

for (let w of player.weapons) {
  w.source = player._id;
}

for (let w of player.secondaryWeapons) {
  w.source = player._id;
}
player.ammo = {};
player.ammo[MassDriverGun.kind] = {};
player.ammo[MassDriverGun.kind].count = 30;
player.ammo[MassDriverGun.kind].max = 30;
player.ammo[PhotonTorpedoLauncher.kind] = {};
player.ammo[PhotonTorpedoLauncher.kind].count = 2;
player.ammo[PhotonTorpedoLauncher.kind].max = 2;
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
      msgs.hide();
      resetPlayerPVA(true);
      for (let a of spaceScene.asteroids) {
        a.e = -1;
      }
      for (let o of spaceScene.otherShips) {
        o.e = -1;
      }
      for (let f of spaceScene.flameList) {
        f.e = -1;
      }
      for (let b of spaceScene.bulletList) {
        b.e = -1;
      }
      level = 0;
      spaceScene.score = 0;
      scoreDiv.textContent = 0;
      chosePowerup = true;
      finishCountdown = 0;
      countDown = 0;
      player.pointSight = false;
      player.emergencyBrakes = false;
      const { weapons, secondaryWeapons } = baseWeapons();
      player.weapons = weapons;
      player.secondaryWeapons = secondaryWeapons;
      for (let w of player.weapons) {
        w.source = player._id;
      }
      for (let w of player.secondaryWeapons) {
        w.source = player._id;
      }
    },
  },
  {
    title: "Debug commands:",
    lambda: () => {},
    disabled: true,
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
    },
  },
  {
    title: "Mass drivers",
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
      player.ammo[MassDriverGun.kind] = {};
      player.ammo[MassDriverGun.kind].count = 99;
      player.ammo[MassDriverGun.kind].max = massDriverGun1.ammoMax;
      console.log(player.ammo[MassDriverGun.kind].count);
      for (let w of player.weapons) {
        w.source = player._id;
      }
    },
  },
  {
    title: "Laser guns",
    lambda: () => {
      const laserGun1 = new LaserGun({
        pos: {
          x: -40,
          y: 40,
        },
      });
      const laserGun2 = new LaserGun({
        pos: {
          x: -40,
          y: -40,
        },
      });
      player.weapons = [laserGun1, laserGun2];
      player.ammo[LaserGun.kind] = {};
      player.ammo[LaserGun.kind].count = 10;
      player.ammo[LaserGun.kind].max = laserGun1.ammoMax;
      for (let w of player.weapons) {
        w.source = player._id;
      }
    },
  },
  {
    title: "Gauss cannon",
    lambda: () => {
      const railGun = new GaussCannon({
        pos: {
          x: 0,
          y: 0,
        },
      });

      player.secondaryWeapons = [railGun];
      player.ammo[GaussCannon.kind] = {};
      player.ammo[GaussCannon.kind].count = 10;
      player.ammo[GaussCannon.kind].max = railGun.ammoMax;
      for (let w of player.secondaryWeapons) {
        w.source = player._id;
      }
    },
  },
  {
    title: "Photon torpedo",
    lambda: () => {
      const ptl = new PhotonTorpedoLauncher({
        pos: {
          x: 0,
          y: 0,
        },
        color: 0x00ddff,
        haloColor: 0x11ddff,
      });

      player.secondaryWeapons = [ptl];
      player.ammo[PhotonTorpedoLauncher.kind] = {};
      player.ammo[PhotonTorpedoLauncher.kind].count = 10;
      player.ammo[PhotonTorpedoLauncher.kind].max = ptl.ammoMax;

      for (let w of player.secondaryWeapons) {
        w.source = player._id;
      }
    },
  },
  {
    title: "Pointsight",

    lambda: () => {
      player.pointSight = true;
    },
  },
  {
    title: "Emergency brakes",

    lambda: () => {
      player.emergencyBrakes = true;
    },
  },
];
metaP.maxCommands = 10;
metaP.bind(commands);
msgs.attach();

document.getElementById("menu").addEventListener("click", (ev) => {
  metaP.metaP();
});

let countDown = 0;
let finishCountdown = 0;
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
  console.log(options);

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
    console.log(choiceElement);

    choiceElement.dataset.id = option.id;
    console.log(index, glyphElements, option.glyph);
    const glyphElement = glyphElements[index];
    glyphElement.innerHTML = `<img src="media/glyphs/${option.glyph}"></img>`;
    const descriptionElement = descriptionElements[index];
    descriptionElement.innerHTML = option.description();

    choiceElement.addEventListener("click", () => {
      // You will fill this up later to handle the choice
      option.lambda();
      glass.style.display = "none";
      powerupContainer.style.display = "none";
      chosePowerup = true;
      choosing = false;
    });
  });
  const skipPowerup = document.getElementById("skip-powerup");
  skipPowerup.textContent = "Skip the choice (-2000 points)";
  skipPowerup.addEventListener("click", () => {
    spaceScene.score -= 2000;
    glass.style.display = "none";
    powerupContainer.style.display = "none";
    chosePowerup = true;
    choosing = false;
    showHUDInfo();
  });
};

const allPowerUpChoices = [
  {
    id: "kMassDriverWeapon",
    name: "Mass Driver",
    description: () => {
      const title = "<h2>Primary weapon</h2>";
      const htmlA = MassDriverGun.present();
      const htmlB = player.weapons[0].present();
      return `${title} ${htmlA} <h3>replace</h3> ${htmlB}`;
    },
    glyph: "massdriver.png",
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
      player.ammo[MassDriverGun.kind] = {};
      player.ammo[MassDriverGun.kind].count = 99;
      player.ammo[MassDriverGun.kind].max = massDriverGun1.ammoMax;
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
    glyph: "gausscannon.png",
    lambda: () => {
      const railGun = new GaussCannon({
        pos: {
          x: 0,
          y: 0,
        },
      });
      player.secondaryWeapons = [railGun];
      player.ammo[GaussCannon.kind] = {};
      player.ammo[GaussCannon.kind].count = 2;
      player.ammo[GaussCannon.kind].max = 2;
      for (let w of player.secondaryWeapons) {
        w.source = player._id;
      }
    },
  },
  {
    id: "kLaserGun",
    name: "Laser Gun",
    description: () => {
      const title = "<h2>Primary weapon</h2>";
      const htmlA = LaserGun.present();
      const htmlB = player.weapons[0].present();
      return `${title} ${htmlA} <h3>replace</h3> ${htmlB}`;
    },
    glyph: "lasergun.png",
    lambda: () => {
      const laserGun1 = new LaserGun({
        pos: {
          x: -40,
          y: 40,
        },
      });
      const laserGun2 = new LaserGun({
        pos: {
          x: -40,
          y: -40,
        },
      });
      player.weapons = [laserGun1, laserGun2];
      player.ammo[LaserGun.kind] = {};
      player.ammo[LaserGun.kind].count = 10;
      player.ammo[LaserGun.kind].max = laserGun1.ammoMax;
      for (let w of player.weapons) {
        w.source = player._id;
      }
    },
  },
  {
    id: "kEmergencyBrakes",
    name: "Emergency brakes",
    description: () => {
      const title = "<h2>Passive utility</h2>";
      return `${title}<p>Emergency brakes</p> Accelerate in the opposite direction of your travel to brake immediately.`;
    },
    glyph: "emergencybrakes.png",
    lambda: () => {
      player.emergencyBrakes = true;
    },
  },
  {
    id: "kPointSight",
    name: "Point sight",
    description: () => {
      const title = "<h2>Passive utility</h2>";
      return `${title}<p>Point sight</p> Show an overlay of where you are aiming at. Particularly useful for long range weapons`;
    },
    glyph: "pointsight.png",
    lambda: () => {
      player.pointSight = true;
    },
  },
];

app.ticker.add((delta) => {
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
  if (player.lives <= 0 && !msgs.visible && !choosing) {
    msgs.html(
      `Game over!<br/>Select <em>Play</em> in the upper-left menu to play again`,
    );
    msgs.showSmall();
    player.explode();
    for (let o of spaceScene.otherShips) {
      o.action = () => "kIdle";
    }
    return;
  }
  /*
  if (spaceScene.otherShips.length == 0 && level > 1) {
    // Refill ammo immediately if there are no enemy ships. Why not?
    if (player.weapons[0].ammo) {
      player.ammo[player.weapons[0].kind].count = player.weapons[0].ammoMax;
      // TODO this has to have the potential to be improved per-player
    }
    if (player.secondaryWeapons[0].ammo) {
      player.ammo[player.secondaryWeapons[0].kind] = {};
      player.ammo[player.secondaryWeapons[0].kind].count =
        player.secondaryWeapons[0].ammoMax;
      player.ammo[player.secondaryWeapons[0].kind].max =
        player.secondaryWeapons[0].ammoMax;
    }
  }*/
  if (!chosePowerup && spaceScene.asteroids.length === 0 && player.lives >= 1) {
    // TODO
    choosing = true;
    finishCountdown = 0; // Why here?
    const choices = [...allPowerUpChoices];
    choices.sort(() => Math.random() - 0.5);

    offerChoices(choices.slice(0, 2));

    return;
  }
  if (
    spaceScene.otherShips.length === 0 &&
    spaceScene.asteroids.length > 0 &&
    player.lives >= 1
  ) {
    if (finishCountdown === 0) {
      console.log("Setting the finish countdown");
      finishCountdown = performance.now() + 10000;
    } else if (performance.now() >= finishCountdown) {
      // Finish countdown has ended
      console.log("Removing all asteroids, " + finishCountdown);
      for (let a of spaceScene.asteroids) {
        a.e = -1;
      }
    } else {
      const remainingTime = Math.ceil(
        (finishCountdown - performance.now()) / 1000,
      ).toFixed(0); // Calculate remaining seconds
      document.getElementById("next-wave-countdown").innerText =
        `Next wave in ${remainingTime} seconds`;
    }
  }
  if (spaceScene.asteroids.length === 0 && player.lives >= 1) {
    if (countDown === 0 && chosePowerup) {
      // Asteroids just became empty and a powerup has been chosen
      countDown = performance.now() + 3000; // Start the 3-second countdown
      document.getElementById("next-wave-countdown").innerText = "";
      msgs.text("");
      msgs.show();
      level++;
    } else if (performance.now() >= countDown) {
      // 3 seconds have passed
      msgs.hide();
      const nextLevel = countsPerLevel(level);
      resetPlayerPVA(false);
      spaceScene.addAsteroids(nextLevel.asteroids);
      spaceScene.addEnemies(nextLevel.ships);
      countDown = 0; // Reset the countdown
      chosePowerup = false;
      finishCountdown === 0;
    } else {
      // Update the countdown display
      const remainingTime = Math.ceil((countDown - performance.now()) / 1000); // Calculate remaining seconds
      const nextLevel = countsPerLevel(level);
      const a = nextLevel.asteroids;
      const s = nextLevel.ships;
      let extra = "";
      if (s >= 1) {
        extra = `<br/><hr/><span style='color: white'>DANGER<em> You will face ${s} ships </em>DANGER</span>`;
      }
      if (s >= 2) {
        extra = `<br/><hr/><span style='color: orange'>DANGER<em> You will face ${s} ships </em>DANGER</span>`;
      }
      if (s >= 4) {
        extra = `<br/><hr/><span style='color: red'>DANGER<em> You will face ${s} ships </em>DANGER</span>`;
      }
      msgs.html(
        `Wave ${level} in ${remainingTime} seconds<br\>You will face ${a} asteroids` +
          extra,
      );
    }
  } else {
    // Asteroids are present, reset the countdown
    countDown = 0;
  }
  if (msgs.visible && player.lives > 0) {
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
