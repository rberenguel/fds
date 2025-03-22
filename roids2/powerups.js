export {
  offerChoices,
  allPowerUpChoices,
  currentPowerupsToDiv,
  debugCommands,
  shieldPowerups,
  superPowerups,
  powerupControls,
};

import {
  GaussCannon,
  MassDriverGun,
  LaserGun,
  PhotonTorpedoLauncher,
  PlasmaGun,
} from "../stardust/weapons/weapons.js";

const glass = document.getElementById("glass");

const currentPowerupsToDiv = (div, player) => {
  const allChoices = allPowerUpChoices(player)
    .concat(shieldPowerups(player))
    .concat(superPowerups(player));
  let added = 0;
  for (let pup of Object.keys(player.powerUps ?? {})) {
    if (!player.powerUps[pup]) {
      continue;
    }
    added++;
    const props = allChoices.filter((p) => p.id === pup);
    if (!props) {
      continue;
    }
    const d = document.createElement("DIV");
    const i = document.createElement("IMG");
    i.src = "media/glyphs/" + props[0].glyph;
    d.appendChild(i);
    d.title = props[0].name;
    div.appendChild(d);
  }
  if (added == 0) {
    const d = document.createElement("DIV");
    const i = document.createElement("IMG");
    i.src = "media/glyphs/none.png";
    d.appendChild(i);
    d.title = "None";
    div.appendChild(d);
  }
};

const powerupContainer = document.getElementById("powerup-container");
const currentPowerUpsHud = document.getElementById("current-powerups-hud");

let selection = null;

const powerupControls = (ev) => {
  if (powerupContainer.style.display != "flex") {
    return;
  }
  try {
    const isH2 = selection.tagName === "H2";
    const isChoice = selection.classList.contains("powerup-choice");
    const isSkip = selection.id === "skip-powerup";
    // TODO: these should be the real controls, including the gamepad
    if (ev == "GoLeft" || ev == "GoRight") {
      if (isChoice) {
        const other = Array.from(
          powerupContainer.querySelectorAll(".powerup-choice"),
        ).filter((s) => !s.classList.contains("powerup-selected"))[0];
        selection.classList.remove("powerup-selected");
        selection = other;
      }
    }
    if (ev == "GoDown") {
      if (isH2) {
        selection.classList.remove("powerup-selected");
        selection = powerupContainer.querySelector(".powerup-choice");
      } else if (isChoice) {
        selection.classList.remove("powerup-selected");
        selection = powerupContainer.querySelector("#skip-powerup");
      }
    }
    if (ev == "GoUp") {
      if (isChoice) {
        selection.classList.remove("powerup-selected");
        selection = powerupContainer.querySelector("h2");
      } else if (isSkip) {
        selection.classList.remove("powerup-selected");
        selection = powerupContainer.querySelector(".powerup-choice");
      }
    }
    if (ev === "Accept") {
      selection.click();
      selection.classList.remove("powerup-selected");
      selection = null;
    }
    selection?.classList.add("powerup-selected");
  } catch (e) {
    console.error(e);
  }
};

const offerChoices = (options = [], globals = {}) => {
  // Options is a list of powerups, of the form
  // {id: "kPowerup", name: "Human name", description: "Description"}

  glass.style.display = "block";
  powerupContainer.style.display = "flex";
  selection = powerupContainer.querySelector("h2");
  selection.classList.add("powerup-selected");

  const currentPowerups = document.getElementById("current-powerups");
  currentPowerups.innerHTML = "";

  currentPowerupsToDiv(currentPowerups, globals.player);

  const choiceElements = document.querySelectorAll(".powerup-choice");
  if (choiceElements.length !== 2) {
    console.error(
      "Error: Exactly two .powerup-choice elements are expected in the HTML.",
    );
    return;
  }
  const glyphElements = document.querySelectorAll(".choice-glyph");
  const descriptionElements = document.querySelectorAll(".choice-description");

  for (let i = 0; i < 2; i++) {
    const option = options[i];
    const choiceElement = choiceElements[i];
    choiceElement.dataset.id = option.id;
    const glyphElement = glyphElements[i];
    glyphElement.innerHTML = `<img src="media/glyphs/${option.glyph}"></img>`;
    const descriptionElement = descriptionElements[i];
    descriptionElement.innerHTML = option.description();
    // To avoid having a million powerups on the same one
    choiceElement.onclick = () => {
      // You will fill this up later to handle the choice
      option.lambda();
      glass.style.display = "none";
      powerupContainer.style.display = "none";
      globals.setPowerUpChosen(true);
      console.info(`Setting ${option.id} to true`);
      globals.player.powerUps[option.id] = true;
      globals.player.stats.powerups.chosen++;
      currentPowerUpsHud.innerHTML = "";
      currentPowerupsToDiv(currentPowerUpsHud, globals.player);
    };
  }
  const skipPowerup = document.getElementById("skip-powerup");
  skipPowerup.textContent = "Skip the choice (very bad idea, and -2000 points)";
  skipPowerup.addEventListener("click", () => {
    globals.spaceScene.score -= 2000;
    glass.style.display = "none";
    powerupContainer.style.display = "none";
    globals.setPowerUpChosen(true);
    globals.showHUDInfo();
    globals.player.stats.powerups.skipped++;
  });
};

const setWeaponPowerup = (player, weapon) => {
  player.powerUps["kLaserGun"] = false;
  player.powerUps["kPlasmaGun"] = false;
  player.powerUps["kMassDriverGun"] = false;
  player.powerUps[weapon] = true;
};

const setSecondaryWeaponPowerup = (player, weapon) => {
  player.powerUps["kGaussCannon"] = false;
  player.powerUps["kTorpedoLauncher"] = false;
  player.powerUps[weapon] = true;
};

const replaces = `<h3 class="powerup-replaces">replaces</h3>`;

const allPowerUpChoices = (player) => [
  {
    id: "kMassDriverGun",
    name: "Mass Driver",
    description: () => {
      const title = "<h2>Primary weapon</h2>";
      const htmlA = MassDriverGun.present();
      const htmlB = player.weapons[0].present();
      return `${title} ${htmlA} ${replaces} ${htmlB}`;
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
      setWeaponPowerup(player, "kMassDriverGun");
    },
  },
  {
    id: "kPlasmaGun",
    name: "Plasma gun",
    description: () => {
      const title = "<h2>Primary weapon</h2>";
      const htmlA = PlasmaGun.present();
      const htmlB = player.weapons[0].present();
      return `${title} ${htmlA} ${replaces} ${htmlB}`;
    },
    glyph: "plasmagun.png",
    lambda: () => {
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

      player.weapons = [plasmaGun1, plasmaGun2];

      for (let w of player.weapons) {
        w.source = player._id;
      }
      setWeaponPowerup(player, "kPlasmaGun");
    },
  },
  {
    id: "kGaussCannon",
    name: "Gauss Cannon",
    description: () => {
      const title = "<h2>Secondary weapon</h2>";
      const htmlA = GaussCannon.present();
      const htmlB = player.secondaryWeapons[0].present();
      return `${title} ${htmlA} ${replaces} ${htmlB}`;
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
      setSecondaryWeaponPowerup(player, "kGaussCannon");
    },
  },
  {
    id: "kPhotonTorpedoLauncher",
    name: "Photon torpedo launcher",
    description: () => {
      const title = "<h2>Secondary weapon</h2>";
      const htmlA = PhotonTorpedoLauncher.present();
      const htmlB = player.secondaryWeapons[0].present();
      return `${title} ${htmlA} ${replaces} ${htmlB}`;
    },
    glyph: "photontorpedo.png",
    lambda: () => {
      const torpedo = new PhotonTorpedoLauncher({
        pos: {
          x: 0,
          y: 0,
        },
      });
      player.secondaryWeapons = [torpedo];
      player.ammo[PhotonTorpedoLauncher.kind] = {};
      player.ammo[PhotonTorpedoLauncher.kind].count = 2;
      player.ammo[PhotonTorpedoLauncher.kind].max = 2;
      for (let w of player.secondaryWeapons) {
        w.source = player._id;
      }
      setSecondaryWeaponPowerup(player, "kPhotonTorpedoLauncher");
    },
  },
  {
    id: "kLaserGun",
    name: "Laser Gun",
    description: () => {
      const title = "<h2>Primary weapon</h2>";
      const htmlA = LaserGun.present();
      const htmlB = player.weapons[0].present();
      return `${title} ${htmlA} ${replaces} ${htmlB}`;
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
      setWeaponPowerup(player, "kLaserGun");
    },
  },
  {
    id: "kEmergencyBrakes",
    name: "Emergency brakes",
    description: () => {
      const title = "<h2>Passive utility</h2>";
      return `${title}<p class='powerup-title'>Emergency brakes</p> Accelerate in the opposite direction of your travel to brake immediately.`;
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
      return `${title}<p class='powerup-title'>Point sight</p> Show an overlay of where you are aiming at. Particularly useful for long range weapons`;
    },
    glyph: "pointsight.png",
    lambda: () => {
      player.pointSight = true;
      console.log(player);
    },
  },
  {
    id: "kFasterRotation",
    name: "Faster rotation",
    description: () => {
      const title = "<h2>Passive ability</h2>";
      return `${title}<p class='powerup-title'>Faster rotation</p>Rotate faster. Does not accumulate.`;
    },
    glyph: "rotatefaster.png",
    lambda: () => {
      player.yawRate = 0.05;
    },
  },
  {
    id: "kFasterAcceleration",
    name: "Faster acceleration",
    description: () => {
      const title = "<h2>Passive ability</h2>";
      return `${title}<p class='powerup-title'>Faster acceleration</p>Accelerate faster. Does not accumulate.`;
    },
    glyph: "speedup.png",
    lambda: () => {
      player.accel = 0.2;
    },
  },
  {
    id: "kExtraAmmo",
    name: "Additional ammunition/energy",
    description: () => {
      const title = "<h2>Passive ability</h2>";
      return `${title}<p class='powerup-title'>Additional ammunition/energy</p>x1.5 your storage. Does not accumulate.`;
    },
    glyph: "extraammo.png",
    lambda: () => {
      player.extraAmmo = 1.5;
    },
  },
];

const shieldPowerups = (player) => [
  {
    id: "kDeflectorShield",
    name: "Deflector shield",
    description: () => {
      const title = "<h2>Shield</h2>";
      let html = `${title}${shieldDescs["kDeflectorShield"]}`;
      if (player.shield) {
        html += `${replaces} ${shieldDescs[player.shield]}`;
      }
      return html;
    },
    glyph: "deflectorshield.png",
    lambda: () => {
      if (player.shield) {
        player.powerUps[player.shield] = false;
      }
      player.shield = "kDeflectorShield";
    },
  },
  {
    id: "kEnergy shield",
    name: "Energy shield",
    description: () => {
      const title = "<h2>Shield</h2>";
      let html = `${title}${shieldDescs["kEnergyShield"]}`;
      if (player.shield) {
        html += `${replaces} ${shieldDescs[player.shield]}`;
      }
      return html;
    },
    glyph: "energyshield.png",
    lambda: () => {
      if (player.shield) {
        player.powerUps[player.shield] = false;
      }
      player.shield = "kEnergyShield";
    },
  },
];

const superPowerups = (player) => [
  {
    id: "kPhaseShield",
    name: "Phase shield",
    description: () => {
      const title = "<h2>Shield</h2>";
      let html = `${title}${shieldDescs["kPhaseShield"]}`;
      if (player.shield) {
        html += `${replaces} ${shieldDescs[player.shield]}`;
      }
      return html;
    },
    glyph: "phaseshield.png",
    lambda: () => {
      if (player.shield) {
        player.powerUps[player.shield] = false;
      }
      player.shield = "kPhaseShield";
    },
  },
  {
    id: "kEmp",
    name: "EMP pulse",
    description: () => {
      const title = "<h2>Active ability</h2>";
      let html = `${title}${activeAbilityDescs["kEmp"]}`;
      if (player.shield) {
        html += `${replaces} ${activeAbilityDescs[player.activeAbility]}`;
      }
      return html;
    },
    glyph: "emp.png",
    lambda: () => {
      if (player.activeAbility) {
        player.powerUps[player.activeAbility] = false;
      }
      player.activeAbility = "kEmp";
    },
  },
  {
    id: "kBomb",
    name: "Bomb",
    description: () => {
      const title = "<h2>Active ability</h2>";
      let html = `${title}${activeAbilityDescs["kBomb"]}`;
      if (player.shield) {
        html += `${replaces} ${activeAbilityDescs[player.activeAbility]}`;
      }
      return html;
    },
    glyph: "bomb.png",
    lambda: () => {
      if (player.activeAbility) {
        player.powerUps[player.activeAbility] = false;
      }
      player.activeAbility = "kBomb";
    },
  },
];

const shieldDescs = {
  kDeflectorShield:
    "<p class='powerup-title'>Deflector shield</p><hr/>Deflects strongly kinetic weapons for 3 seconds, affects mildly energy weapons.<br/><em>You can't fire your secondary weapon while the shield is on</em>",
  kEnergyShield:
    "<p class='powerup-title'>Energy shield</p><hr/>Stops completely energy weapons for 3 seconds, no effect on kinetic weapons.<br/><em>You can't fire your secondary weapon while the shield is on</em>",
  kPhaseShield:
    "<p class='powerup-title'>Phase shield</p><hr/>Let's you pass through asteroids, projectiles and beams for 3 seconds.<br/><em>You can't fire your secondary weapon while the shield is on</em>",
};

const activeAbilityDescs = {
  kEmp: "<p>EMP pulse</p><hr/>Generates an EMP pulse where you are, disabling enemy ships for 3 seconds.",
  kBomb:
    "<p class='powerup-title'>Gravitic bomb</p><hr/>Drop it and it will explode in 1 second for massive damage. Won't affect your ship.",
};

const debugCommands = (player) => {
  const choices = allPowerUpChoices(player)
    .concat(shieldPowerups(player))
    .concat(superPowerups(player));
  return choices.map((c) => {
    return {
      title: c.name,
      lambda: () => {
        c.lambda();
        player.powerUps[c.id] = true;
      },
    };
  });
};
