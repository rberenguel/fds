import { Msgs } from "../libs/msgs/msgs.js";
import { Application } from "../libs/3rdparty/pixi.mjs";

import {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
  resetKeys,
} from "../libs/controller/controlHandling.js";

import { presentKeyMap, keyMap, buttonMap } from "./setupControls.js";

import { VirtualPad } from "../libs/controller/virtualPad.js";
import { settings } from "./settings.js";
import { getEncouragementMessage } from "./encouragement.js";
import { Lynx } from "../stardust/ship.js";
import {
  offerChoices,
  allPowerUpChoices,
  currentPowerupsToDiv,
  debugCommands,
  shieldPowerups,
  superPowerups,
  powerupControls,
} from "./powerups.js";
import { SpaceScene } from "./scene.js";

import {
  PlasmaGun,
  GaussCannon,
  MassDriverGun,
  PhotonTorpedoLauncher,
  LaserGun,
} from "../stardust/weapons/weapons.js";
import { dropEmp } from "../stardust/weapons/empBlast.js";
import { dropBomb } from "../stardust/weapons/bomb.js";

const globalCanvasScale = 0.95;

bindGamepadHandlers();
bindKeyHandlers();

let spaceScene;

const gameActions = {
  moveDown: (f = 1) => {
    if (player.e < 10) {
      return;
    }

    player.backThrust(1, 500);
  },
  moveUp: (f = 1) => {
    if (player.e < 10) {
      return;
    }

    player.forwardThrust(1, 500);
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
    if (now - player.prevshot < firerate) {
      return;
    }
    player.prevshot = now;
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
    settings.shake.onFire(app);
  },
  secondaryShoot: () => {
    if (player.e < 10) {
      return;
    }
    const firerate =
      player.secondaryWeapons[0 + player.secondaryWeaponShift].firerate;
    const now = performance.now();
    if (now - player.secondaryPrevshot < firerate) {
      return;
    }
    player.secondaryPrevshot = now;
    try {
      player.secondaryWeapons[0 + player.secondaryWeaponShift].fire(
        player,
        player.bulletList,
      );
    } catch {}
    settings.shake.onSecondaryFire(app);
  },
  shield: () => {
    if (gameOver) {
      fullRestart();
      return;
    }
    if (player.shield && player.shieldEnergy >= 1) {
      const now = performance.now();
      if (player.shield === "kDeflectorShield") {
        player.deflectorShield = now + 3000;
        player.shieldEnergy = 0;
      }
      if (player.shield === "kEnergyShield") {
        player.energyShield = now + 3000;
        player.shieldEnergy = 0;
      }
      if (player.shield === "kPhaseShield") {
        player.phaseShield = now + 3000;
        player.shieldEnergy = 0;
      }
    }
  },
  activeAbility: () => {
    if (player.activeAbility && player.activeAbilityEnergy >= 1) {
      if (player.activeAbility === "kEmp") {
        dropEmp(player, player.bulletList);
        player.activeAbilityEnergy = 0;
      }
      if (player.activeAbility === "kBomb") {
        dropBomb(player, player.bulletList);
        player.activeAbilityEnergy = 0;
      }
    }
  },
  menu: () => {
    metaP.metaP();
  },
};

const inMenuActions = {
  moveDown: (f = 1) => {
    if (inMenuActions.debounce > performance.now()) {
      return;
    }
    powerupControls("GoDown");
    inMenuActions.debounce = performance.now() + 300;
  },
  moveUp: (f = 1) => {
    if (inMenuActions.debounce > performance.now()) {
      return;
    }
    powerupControls("GoUp");
    inMenuActions.debounce = performance.now() + 300;
  },
  moveRight: (f = 1) => {
    if (inMenuActions.debounce > performance.now()) {
      return;
    }
    powerupControls("GoRight");
    inMenuActions.debounce = performance.now() + 300;
  },
  moveLeft: (f = 1) => {
    if (inMenuActions.debounce > performance.now()) {
      return;
    }
    powerupControls("GoLeft");
    inMenuActions.debounce = performance.now() + 300;
  },
  shoot: () => {},
  secondaryShoot: () => {
    if (inMenuActions.debounce > performance.now()) {
      return;
    }
    powerupControls("Accept");
    inMenuActions.debounce = performance.now() + 300;
  },
  shield: () => {},
  menu: () => {},
  debounce: 0,
};

const showHUDInfo = () => {
  const nextWaveCountdown = document.getElementById("next-wave-countdown");
  const scoreDiv = document.getElementById("score");
  const hull = document.getElementById("hull");
  const shieldEnergy = document.getElementById("shield-energy");
  const containerPrimary = document.getElementById("primary-weapon-types");
  const containerSecondary = document.getElementById("secondary-weapon-types");
  const ammoPContainer = document.getElementById("primary-weapon-ammo");
  const ammoSContainer = document.getElementById("secondary-weapon-ammo");
  if (player.e < 0) {
    hull.innerHTML = "";
    shieldEnergy.innerHTML = "";
    containerPrimary.innerHTML = "";
    containerSecondary.innerHTML = "";
    ammoPContainer.innerHTML = "";
    ammoSContainer.innerHTML = "";
    scoreDiv.innerHTML = "";
    nextWaveCountdown.innerHTML = "";
    return;
  }
  scoreDiv.textContent = spaceScene?.score.toFixed(0);
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

  hull.innerHTML = `H:${((player.e / 1000) * 100).toFixed(0)}%`;
  // TODO: use a maxE instead
  let S = "";
  if (player.shield === "kDeflectorShield") {
    S = "(d):";
  }
  if (player.shield === "kEnergyShield") {
    S = "(e):";
  }
  if (player.shield === "kPhaseShield") {
    S = "(p):";
  }
  /*if (player.shield === "kEmp") {
    S = "(m):";
  }*/
  shieldEnergy.innerHTML = `${S}${player.shieldEnergy.toFixed(2)}`;
  if (S === "") {
    shieldEnergy.innerHTML = "";
  }
  containerPrimary.innerHTML = `W1: ${a}${b}`;

  containerSecondary.innerHTML = `W2: ${c}`;

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

const msgs = new Msgs({ blur: 50, sepia: 50 });

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

/*const virtualPad = new VirtualPad({
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
});*/

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
  //virtualPad.touchStart(e.global, e);
});
app.stage.addEventListener("pointermove", (e) => {
  //virtualPad.touchMove(e.global, () => ship.r);
});
app.stage.addEventListener("pointerup", (e) => {
  //virtualPad.touchEnd(e.global);
});

const focusTrap = document.getElementById("focus-trap");
if (!isMobile()) {
  focusTrap.focus(); // Set focus to the hidden input… unless on mobile
} else {
  // TODO: remove
}

const controller = handleControls(gameActions, keyMap, buttonMap);
const menuController = handleControls(inMenuActions, keyMap, buttonMap);

const scale = (() => {
  //isMobile() ? 0.12 : SpaceScene.MAXSCALE;
  //AAAA
  const { width, height } = getLandscapeDimensions();
  // width*height should be 1.5 million
  return Math.max(0.12, (SpaceScene.MAXSCALE * width * height) / 2200000);
})();

console.log(scale);

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
player.e = 1500;

const resetStats = (player) => {
  player.stats = {
    powerups: {
      chosen: 0,
      skipped: 0,
    },
    shots: {
      kPlasmaGun: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
      kLaserGun: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
      kMassDriverGun: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
      kGaussCannon: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
      kPhotonTorpedoLauncher: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
      kEmp: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
      kBomb: {
        fired: 0,
        hitsAsteroid: 0,
        hitsShip: 0,
      },
    },
  };
};

const presentStats = (player) => {
  const stats = player.stats.shots;
  const table = document.createElement("table");
  table.classList.add("player-stats");
  table.style.width = "100%";

  // Create table header
  const headerRow = table.insertRow();
  const headers = [
    "Gun type",
    "Shots fired",
    "Asteroid hits",
    "Ship hits",
    "Hit %",
  ];
  for (const headerText of headers) {
    const th = document.createElement("th");
    th.textContent = headerText;
    headerRow.appendChild(th);
  }

  // Create table rows
  for (const gunType in stats) {
    const row = table.insertRow();
    const gunData = stats[gunType];

    const gunTypeCell = row.insertCell();
    gunTypeCell.textContent = gunType.substring(1); // Remove the "k" prefix
    gunTypeCell.classList.add("player-stats-title");

    const shotsFiredCell = row.insertCell();
    shotsFiredCell.textContent = gunData.fired;

    const asteroidHitsCell = row.insertCell();
    asteroidHitsCell.textContent = gunData.hitsAsteroid;

    const shipHitsCell = row.insertCell();
    shipHitsCell.textContent = gunData.hitsShip;

    const hitPercentageCell = row.insertCell();
    const totalHits = gunData.hitsAsteroid + gunData.hitsShip;
    const hitPercentage =
      gunData.fired > 0
        ? ((totalHits / gunData.fired) * 100).toFixed(2)
        : "0.00";
    hitPercentageCell.textContent = `${hitPercentage}%`;
  }
  return table;
};

resetStats(player);

player.shieldEnergy = 1;
player.shieldEnergyRecoveryRate = 0.0007;
player.powerUps = {};
player.recoveryRate = 0.08;
player.emergencyBrakes = false;
player.energyShield = 0;
player.deflectorShield = 0;
player.pointSight = false;

player.emp = true;
//player.shield = "kPhaseShield"
player.phaseShield = 0;
if (location.href.startsWith("http")) {
  //player.shield = "kEnergyShield"
  //player.emp = true
}

const resetPlayerAmmo = (player) => {
  if (player.weapons[0].ammo) {
    player.ammo[player.weapons[0].kind] = {};
    player.ammo[player.weapons[0].kind].count =
      player.weapons[0].ammoMax * player.extraAmmo;
    player.ammo[player.weapons[0].kind].max =
      player.weapons[0].ammoMax * player.extraAmmo;
  }
  if (player.secondaryWeapons[0].ammo) {
    player.ammo[player.secondaryWeapons[0].kind] = {};
    player.ammo[player.secondaryWeapons[0].kind].count =
      player.secondaryWeapons[0].ammoMax * player.extraAmmo;
    player.ammo[player.secondaryWeapons[0].kind].max =
      player.secondaryWeapons[0].ammoMax * player.extraAmmo;
  }
};

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
  resetPlayerAmmo(player);
  player.shieldEnergy = 1;
  player.activeAbilityEnergy = 1;
  spaceScene.player = player;
  player.e = 1500; // TODO: this should be the current player maximum instead
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

player.generate();

player.lives = 1;

spaceScene = new SpaceScene({
  app: app,
  player: player,
  controller: controller,
  scale: scale,
  id: 0, // TODO remove
});

console.info("Scene constructed");

const scoreDiv = document.getElementById("score");

const fullRestart = () => {
  msgs.hide();
  resetPlayerPVA(true);
  resetKeys();
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
  level = 1;
  const nextLevel = enemiesPerLevel(level);
  spaceScene.addAsteroids(nextLevel.asteroids);
  spaceScene.addEnemies(nextLevel.ships, nextLevel.shipLoadouts);
  spaceScene.score = 0;
  scoreDiv.textContent = 0;
  powerUpChosen = true;
  finishCountdown = 0;
  countdown = 0;
  inGame = true;
  gameOver = false;
  resetStats(player);
  player.powerUps = undefined;
  player.powerUps = {};
  player.pointSight = false; // TODO There are more things to reset
  player.emergencyBrakes = false;
  player.shield = undefined;
  player.activeAbility = undefined;

  player.extraAmmo = 1;
  player.yawRate = 0.03;
  player.accel = 0.1;
  player.energyShield = 0;
  player.deflectorShield = 0;
  player.phaseShield = 0;
  const { weapons, secondaryWeapons } = baseWeapons();
  player.weapons = weapons;
  player.secondaryWeapons = secondaryWeapons;
  resetPlayerAmmo(player);
  for (let w of player.weapons) {
    w.source = player._id;
  }
  for (let w of player.secondaryWeapons) {
    w.source = player._id;
  }
};

const commands = [
  /*{
    title: "Play",
    lambda: fullRestart,
  },
  {
    title: "Back to main menu",
    lambda: () => {
      showMainMenu = true;
      fullRestart();
    },
  },*/
  {
    title: "Debug commands:",
    lambda: () => {},
    disabled: true,
  },
  {
    title: "To level",
    inputs: [{ title: "Which?", default: "10" }],
    lambda: (lev) => {
      level = parseInt(lev);
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
    title: "Skip to level end",
    lambda: () => {
      offerPowerUpChoices = true;
      powerUpChosen = false;
    },
  },
  ...debugCommands(player),
];
metaP.maxCommands = 100;
metaP.bind(commands);
msgs.attach();

let paused = false;

const pauseMenu = () => {
  console.log(player.stats);
  const statsTable = presentStats(player);
  const wrapper = document.createElement("DIV");
  const div = document.createElement("DIV");
  const p = document.createElement("P");
  p.textContent = "Current powerups";
  p.style.flexBasis = "100%";
  div.appendChild(p);
  div.style.display = "flex";
  div.style.flexDirection = "row";
  div.classList.add("current-powerups");
  div.addEventListener("click", () => msgs.hide());
  currentPowerupsToDiv(div, player);
  wrapper.appendChild(div);
  wrapper.appendChild(statsTable);
  const backToGame = document.createElement("DIV");
  backToGame.style.cursor = "pointer";
  backToGame.addEventListener("click", () => {
    msgs.hide();
    paused = false;
  });
  backToGame.textContent = "Back to the game";
  backToGame.classList.add("pause-button");
  const backToMainMenu = document.createElement("DIV");
  backToMainMenu.style.cursor = "pointer";
  backToMainMenu.addEventListener("click", () => {
    msgs.hide();
    paused = false;
    showMainMenu = true;
    fullRestart();
  });
  backToMainMenu.classList.add("pause-button");
  backToMainMenu.textContent = "Back to the main menu";
  wrapper.appendChild(backToGame);
  wrapper.appendChild(backToMainMenu);
  msgs.div(wrapper);
  msgs.show({ glass: 1000, msgs: 1001 });
  paused = true;
};

document.getElementById("debug-menu").addEventListener("click", (ev) => {
  metaP.metaP();
});

document.getElementById("pause-menu").addEventListener("click", (ev) => {
  pauseMenu();
});

let showMainMenu = true;
const controlsChanger = () => {
  const div = document.createElement("DIV");
  presentKeyMap(div, gameActions, msgs, menuP);
  return div;
};

const menuP = new MetaP({ id: "main-menu" });

const mainMenuCommands = [
  {
    title: "Play",
    lambda: () => {
      showMainMenu = false;
      finishCountdown = 0;
      countdown = 0;
      diffFinishCountdown = 0;
    },
  },
  {
    title: "Settings",
    lambda: () => {
      menuP.ignoreKeys();
      msgs.div(controlsChanger());
      msgs.show({ glass: 1001, msgs: 1002 });
    },
  },
  {
    title: "About",
    lambda: () => {
      const about = document.getElementById("about");
      const clone = about.cloneNode(true);
      clone.style.display = "block";
      clone.addEventListener("click", () => msgs.hide());
      msgs.div(clone);
      msgs.show({ glass: 1001, msgs: 1002 });
    },
  },
];

menuP.bind(mainMenuCommands, { blur: 30 }, false);

const enemiesPerLevel = (level) => {
  const laser = {
    weapon: "kLaserGun",
  };
  const torpedo = {
    weapon: "kLaserGun",
    secondary: "kPhotonTorpedoLauncher",
  };
  const massDriver = {
    weapon: "kMassDriverGun",
  };
  const gaussCannon = {
    weapon: "kMassDriverGun",
    secondary: "kGaussCannon",
  };
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
    return { ...obj, asteroids: 4, ships: 0 };
  }
  if (level == 2) {
    return {
      ...obj,
      asteroids: 5,
      ships: 1,
      shipLoadouts: [laser],
    };
  }
  if (level == 3) {
    return {
      ...obj,
      asteroids: 5,
      ships: 1,
      shipLoadouts: [massDriver],
    };
  }
  if (level == 4) {
    return {
      ...obj,
      asteroids: 5,
      ships: 1,
      shipLoadouts: [torpedo],
    };
  }
  if (level == 5) {
    return {
      ...obj,
      asteroids: 5,
      ships: 1,
      shipLoadouts: [gaussCannon],
    };
  }
  if (level < 9) {
    const choices = [
      laser,
      laser,
      laser,
      laser,
      torpedo,
      torpedo,
      massDriver,
      massDriver,
      gaussCannon,
    ].sort(() => Math.random() - 0.5);
    return {
      ...obj,
      asteroids: 6,
      ships: 2,
      shipLoadouts: choices.slice(0, 2),
    };
  }
  if (level < 15) {
    const choices = [
      laser,
      laser,
      laser,
      torpedo,
      torpedo,
      massDriver,
      massDriver,
      gaussCannon,
    ].sort(() => Math.random() - 0.5);
    return {
      ...obj,
      asteroids: 6,
      ships: 2,
      shipLoadouts: choices.slice(0, 2),
    };
  }
  if (level < 19) {
    const choices = [
      laser,
      laser,
      laser,
      torpedo,
      torpedo,
      massDriver,
      massDriver,
      gaussCannon,
    ].sort(() => Math.random() - 0.5);
    return {
      ...obj,
      asteroids: 6,
      ships: 3,
      shipLoadouts: choices.slice(0, 3),
    };
  }
  if (level == 19) {
    const choices = [
      laser,
      laser,
      laser,
      torpedo,
      torpedo,
      massDriver,
      massDriver,
      gaussCannon,
    ].sort(() => Math.random() - 0.5);
    return {
      ...obj,
      asteroids: 7,
      ships: 4,
      shipLoadouts: choices.slice(0, 4),
    };
  }
  if (level == 20) {
    const choices = [
      laser,
      laser,
      laser,
      torpedo,
      torpedo,
      massDriver,
      massDriver,
      gaussCannon,
    ].sort(() => Math.random() - 0.5);
    return {
      ...obj,
      asteroids: 7,
      ships: 5,
      shipLoadouts: choices.slice(0, 5),
    };
  }
  const a = enemiesPerLevel(level - 20).asteroids;
  const s = enemiesPerLevel(level - 20).ships + 1;
  const l = enemiesPerLevel(level - 20).shipLoadouts;
  return {
    asteroids: a,
    ships: s,
    level: level,
    shipLoadouts: l,
  };
};

let powerUpChosen = true;
let offerPowerUpChoices = false;
let countdown = 0;
let finishCountdown = 0;
let diffFinishCountdown = 0;
let level = 0;
let chosePowerup = true;
let inGame = false;
let gameOver = false;

app.ticker.add((delta) => {
  if (player.sleepUntil > performance.now()) {
    return;
  }
  if (showMainMenu) {
    if (!menuP.visible()) {
      console.debug("Showing main menu");
      menuP.metaP();
    }
    return;
  }
  if (paused) {
    if (diffFinishCountdown == 0) {
      const now = performance.now();
      diffFinishCountdown = finishCountdown - now;
    }
    return;
  } else {
    if (diffFinishCountdown > 0) {
      finishCountdown = performance.now() + diffFinishCountdown;
      diffFinishCountdown = 0;
    }
  }

  if (offerPowerUpChoices && !powerUpChosen) {
    // Offer powerup choices
    powerUpChosen = false;
    offerPowerUpChoices = false;
    inGame = false;
    finishCountdown = 0; // Why here?
    const choices = [...allPowerUpChoices(player)];
    choices.sort(() => Math.random() - 0.5);

    const globals = {
      powerUpChosen: powerUpChosen,
      setPowerUpChosen: (value) => {
        powerUpChosen = value;
      },
      offerPowerUpChoices: offerPowerUpChoices,
      setOfferPowerUpChoices: (value) => {
        offerPowerUpChoices = value;
      },
      spaceScene: spaceScene,
      showHUDInfo: showHUDInfo,
      player: player,
    };
    // Level is increased before being here
    if (level === 3) {
      console.info("Offering only shields!");
      offerChoices(shieldPowerups(player), globals);
      return;
    }
    if (level < 3) {
      offerChoices(choices.slice(0, 2), globals);
      return;
    } else if (level < 7) {
      const choices = [
        ...allPowerUpChoices(player).concat(shieldPowerups(player)),
      ];
      choices.sort(() => Math.random() - 0.5);
      offerChoices(choices.slice(0, 2), globals);
      return;
    } else {
      const choices = [
        ...allPowerUpChoices(player).concat(
          shieldPowerups(player).concat(superPowerups(player)),
        ),
      ];
      choices.sort(() => Math.random() - 0.5);
      offerChoices(choices.slice(0, 2), globals);
      return;
    }
    // Leaving the unused return while I sort out the options above better.

    return;
  }
  if (!powerUpChosen) {
    // This needs to be after setting up the chooser above
    // It is the wait loop in the powerup screen
    menuController();
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
    const div = document.createElement("DIV");
    const message = getEncouragementMessage(player);
    const encouragement = document.createElement("DIV");
    encouragement.classList.add("encouragement");
    encouragement.innerHTML = message;
    const clicky = document.createElement("DIV");
    clicky.innerHTML = `Click here to play again`;
    div.addEventListener("click", fullRestart);
    div.style.cursor = "pointer";
    div.appendChild(encouragement);
    div.appendChild(clicky);
    const statsTable = presentStats(player);
    div.appendChild(statsTable);
    msgs.div(div);
    msgs.showSmall();
    player.explode();
    gameOver = true;
    for (let o of spaceScene.otherShips) {
      o.action = () => "kIdle";
    }
    return;
  }
  if (spaceScene.otherShips.length === 0 && inGame && !gameOver) {
    if (finishCountdown === 0) {
      finishCountdown = performance.now() + 10000;
    } else if (performance.now() >= finishCountdown) {
      // Finish countdown has ended
      for (let a of spaceScene.asteroids) {
        a.e = -1;
      }
      offerPowerUpChoices = true;
      powerUpChosen = false;
    } else {
      const remainingTime = Math.ceil(
        (finishCountdown - performance.now()) / 1000,
      ).toFixed(0); // Calculate remaining seconds
      document.getElementById("next-wave-countdown").innerHTML =
        `Next wave in <span class="remaining-time">${remainingTime}</span> seconds`;
    }
  }
  if (!inGame && !gameOver) {
    if (countdown === 0 && chosePowerup) {
      // We have chosen a powerup already
      countdown = performance.now() + 3000; // Start the 3-second countdown
      document.getElementById("next-wave-countdown").innerText = "";
      msgs.text("");
      msgs.show();
      level++;
    } else if (performance.now() >= countdown) {
      // 3 seconds have passed
      msgs.hide();
      const nextLevel = enemiesPerLevel(level);
      resetPlayerPVA(false);
      resetKeys();
      spaceScene.addAsteroids(nextLevel.asteroids);
      console.log(nextLevel.shipLoadouts);
      spaceScene.addEnemies(nextLevel.ships, nextLevel.shipLoadouts);
      countdown = 0;
      finishCountdown === 0;
      inGame = true;
    } else {
      // Update the countdown display
      const remainingTime = Math.ceil((countdown - performance.now()) / 1000); // Calculate remaining seconds
      const nextLevel = enemiesPerLevel(level);
      const a = nextLevel.asteroids;
      const s = nextLevel.ships;
      let extra = "";
      if (s == 1) {
        extra = `<br/><hr/><span style='color: white'>DANGER<em> You will face ${s} ship </em>DANGER</span>`;
      }
      if (s >= 2) {
        extra = `<br/><hr/><span style='color: orange'>DANGER<em> You will face ${s} ships </em>DANGER</span>`;
      }
      if (s >= 4) {
        extra = `<br/><hr/><span style='color: red'>DANGER<em> You will face ${s} ships </em>DANGER</span>`;
      }
      msgs.html(
        `Wave <span class="wave-num">${level}</span> in <span class="remaining-time">${remainingTime}</span> seconds<br\>You will face <span style="color: #c60;">${a} asteroids</span>` +
          extra,
        { fontSize: "2rem" },
      );
    }
  }
  if (msgs.visible && player.lives > 0) {
    // TODO What was this for again?
    return;
  }
  spaceScene.update(delta);
  // TODO: Game over loop lands around here.
  showHUDInfo();
});

function getLandscapeDimensions() {
  const rootFontSize = parseFloat(
    getComputedStyle(document.documentElement).fontSize,
  );
  const marginInPixels = rootFontSize; // 1rem of additional margin
  const totalMarginWidth = marginInPixels * 2;
  const totalMarginHeight = marginInPixels * 2;

  const availableScreenWidth = window.innerWidth - totalMarginWidth;
  const availableScreenHeight = window.innerHeight - totalMarginHeight;

  const scaledAvailableWidth = availableScreenWidth * globalCanvasScale;
  const scaledAvailableHeight = availableScreenHeight * globalCanvasScale;

  if (scaledAvailableWidth >= scaledAvailableHeight) {
    return { width: scaledAvailableWidth, height: scaledAvailableHeight };
  } else {
    return { width: scaledAvailableHeight, height: scaledAvailableWidth };
  }
}

function resizeForLandscape() {
  // Renamed function
  let landscapeDimensions = getLandscapeDimensions();
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
