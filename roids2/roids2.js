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

import { Lynx } from "../stardust/ship.js";
import {
  offerChoices,
  allPowerUpChoices,
  currentPowerupsToDiv,
  debugCommands,
  shieldPowerups,
  superPowerups,
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
  },
  shield: () => {
    if (player.activeAbility && player.activeAbilityEnergy >= 1) {
      const now = performance.now();
      if (player.activeAbility === "kDeflectorShield") {
        player.deflectorShield = now + 3000;
        player.activeAbilityEnergy = 0;
      }
      if (player.activeAbility === "kEnergyShield") {
        player.energyShield = now + 3000;
        player.activeAbilityEnergy = 0;
      }
      if (player.activeAbility === "kPhaseShield") {
        player.phaseShield = now + 3000;
        player.activeAbilityEnergy = 0;
      }
      if (player.activeAbility === "kEmp") {
        dropEmp(player, player.bulletList);
        player.activeAbilityEnergy = 0;
      }
    }
  },
  menu: () => {
    metaP.metaP();
  },
};

const showHUDInfo = () => {
  const nextWaveCountdown = document.getElementById("next-wave-countdown");
  const scoreDiv = document.getElementById("score");
  const hull = document.getElementById("hull");
  const activeAbilityEnergy = document.getElementById("shield-energy");
  const containerPrimary = document.getElementById("primary-weapon-types");
  const containerSecondary = document.getElementById("secondary-weapon-types");
  const ammoPContainer = document.getElementById("primary-weapon-ammo");
  const ammoSContainer = document.getElementById("secondary-weapon-ammo");
  if (player.e < 0) {
    hull.innerHTML = "";
    activeAbilityEnergy.innerHTML = "";
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

  hull.innerHTML = `H:${player.e.toFixed(0)}`;
  let S = "";
  if (player.activeAbility === "kDeflectorShield") {
    S = "(d):";
  }
  if (player.activeAbility === "kEnergyShield") {
    S = "(e):";
  }
  if (player.activeAbility === "kPhaseShield") {
    S = "(p):";
  }
  if (player.activeAbility === "kEmp") {
    S = "(m):";
  }
  activeAbilityEnergy.innerHTML = `${S}${player.activeAbilityEnergy.toFixed(2)}`;
  if (S === "") {
    activeAbilityEnergy.innerHTML = "";
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
focusTrap.focus(); // Set focus to the hidden input

const controller = handleControls(gameActions, keyMap, buttonMap);

const scale = isMobile() ? 0.12 : SpaceScene.MAXSCALE;

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
player.activeAbilityEnergy = 1;
player.activeAbilityEnergyRecoveryRate = 0.0005;
player.powerUps = {};
player.recoveryRate = 0.04;
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
  player.activeAbilityEnergy = 1;
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
  const nextLevel = countsPerLevel(level);
  spaceScene.addAsteroids(nextLevel.asteroids);
  spaceScene.addEnemies(nextLevel.ships);
  spaceScene.score = 0;
  scoreDiv.textContent = 0;
  powerUpChosen = true;
  finishCountdown = 0;
  countdown = 0;
  inGame = true;
  gameOver = false;
  player.powerUps = undefined;
  player.powerUps = {};
  player.pointSight = false; // TODO There are more things to reset
  player.emergencyBrakes = false;
  player.extraAmmo = 1;
  player.yawRate = 0.03;
  player.accel = 0.1;
  player.energyShield = 1;
  player.deflectorShield = 0;
  const { weapons, secondaryWeapons } = baseWeapons();
  player.weapons = weapons;
  player.secondaryWeapons = secondaryWeapons;
  for (let w of player.weapons) {
    w.source = player._id;
  }
  for (let w of player.secondaryWeapons) {
    w.source = player._id;
  }
};

const commands = [
  {
    title: "Play",
    lambda: fullRestart,
  },
  {
    title: "Back to main menu",
    lambda: () => {
      showMainMenu = true;
      fullRestart();
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
  ...debugCommands(player),
];
metaP.maxCommands = 100;
metaP.bind(commands);
msgs.attach();

document.getElementById("menu").addEventListener("click", (ev) => {
  metaP.metaP();
  // TODO: freeze countdowns
  if (Object.keys(player.powerUps).length > 0 && player.e > 0) {
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
    const backToGame = document.createElement("p");
    backToGame.style.cursor = "pointer";
    backToGame.addEventListener("click", () => {
      msgs.hide();
      metaP.toggle();
    });
    backToGame.textContent = "Back to the game";
    wrapper.appendChild(backToGame);
    msgs.div(wrapper);
    msgs.show({ glass: 0, msgs: 1000000 });
  }
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
    },
  },
  {
    title: "Settings",
    lambda: () => {
      menuP.ignoreKeys();
      msgs.div(controlsChanger());
      msgs.show({ glass: 1000000, msgs: 1000001 }); // TODO Why does this need to be so high? Fix zindexing
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
      msgs.show({ glass: 1000000, msgs: 1000001 });
    },
  },
];

menuP.bind(mainMenuCommands, { blur: 30 }, false);

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
    return { ...obj, asteroids: 4, ships: 0 };
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

let powerUpChosen = true;
let offerPowerUpChoices = false;
let countdown = 0;
let diffcountDown = 0;
let finishCountdown = 0;
let diffFinishCountdown = 0;
let level = 0;
let chosePowerup = true;
let inGame = false;
let gameOver = false;

app.ticker.add((delta) => {
  if (showMainMenu) {
    if (!menuP.visible()) {
      console.debug("Showing main menu");
      menuP.metaP();
    }
    return;
  }
  if (metaP.metaPGlass.style.display === "block") {
    // This implies pause menu is showing
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
    if (level === 5) {
      console.info("Offering only shields!");
      offerChoices(shieldPowerups(player), globals);
    } else if (level === 15) {
      console.info("Offering the good stuff");
      offerChoices(superPowerups(player), globals);
    } else {
      offerChoices(choices.slice(0, 2), globals);
    }

    return;
  }
  if (!powerUpChosen) {
    // This needs to be after setting up the chooser above
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
    (div.innerHTML = `Game over!<br/>Click here to play again`),
      div.addEventListener("click", fullRestart);
    div.style.cursor = "pointer";
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
      document.getElementById("next-wave-countdown").innerText =
        `Next wave in ${remainingTime} seconds`;
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
      const nextLevel = countsPerLevel(level);
      resetPlayerPVA(false);
      resetKeys();
      spaceScene.addAsteroids(nextLevel.asteroids);
      spaceScene.addEnemies(nextLevel.ships);
      countdown = 0;
      finishCountdown === 0;
      inGame = true;
    } else {
      // Update the countdown display
      const remainingTime = Math.ceil((countdown - performance.now()) / 1000); // Calculate remaining seconds
      const nextLevel = countsPerLevel(level);
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
        `Wave ${level} in ${remainingTime} seconds<br\>You will face ${a} asteroids` +
          extra,
      );
    }
  }
  if (msgs.visible && player.lives > 0) {
    // TODO What was this for again?
    return;
  }
  spaceScene.update(delta);
  showHUDInfo();
});

function getLandscapeDimensions() {
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
