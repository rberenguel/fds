export {
  offerChoices,
  allPowerUpChoices,
  currentPowerupsToDiv,
  debugCommands,
  shieldPowerups,
  superPowerups,
};

import {
  GaussCannon,
  MassDriverGun,
  LaserGun,
} from "../stardust/weapons/weapons.js";

const glass = document.getElementById("glass");

const currentPowerupsToDiv = (div, player) => {
  const allChoices = allPowerUpChoices(player)
    .concat(shieldPowerups(player))
    .concat(superPowerups(player));
  for (let pup of Object.keys(player.powerUps ?? {})) {
    if (!player.powerUps[pup]) {
      continue;
    }
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
};

const offerChoices = (options = [], globals = {}) => {
  // Options is a list of powerups, of the form
  // {id: "kPowerup", name: "Human name", description: "Description"}

  glass.style.display = "block";
  const powerupContainer = document.getElementById("powerup-container");

  powerupContainer.style.display = "flex";

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
      //globals.setChoosing(false);
    };
  }
  const skipPowerup = document.getElementById("skip-powerup");
  skipPowerup.textContent = "Skip the choice (very bad idea, and -2000 points)";
  skipPowerup.addEventListener("click", () => {
    globals().spaceScene.score -= 2000;
    glass.style.display = "none";
    powerupContainer.style.display = "none";
    globals.setPowerUpChosen(true);
    //globals.setChoosing(false);
    globals.showHUDInfo();
  });
};

const allPowerUpChoices = (player) => [
  {
    id: "kMassDriverGun",
    name: "Mass Driver",
    description: () => {
      const title = "<h2>Primary weapon</h2>";
      const htmlA = MassDriverGun.present();
      const htmlB = player.weapons[0].present();
      return `${title} ${htmlA} <h3>replaces</h3> ${htmlB}`;
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
      return `${title} ${htmlA} <h3>replaces</h3> ${htmlB}`;
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
      return `${title} ${htmlA} <h3>replaces</h3> ${htmlB}`;
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
  {
    id: "kFasterRotation",
    name: "Faster rotation",
    description: () => {
      const title = "<h2>Passive ability</h2>";
      return `${title}<p>Faster rotation</p>Rotate faster. Does not accumulate.`;
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
      return `${title}<p>Faster acceleration</p>Accelerate faster. Does not accumulate.`;
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
      return `${title}<p>Additional ammunition/energy</p>2 your storage. Does not accumulate.`;
    },
    glyph: "extraammo.png",
    lambda: () => {
      player.extraAmmo = 2;
    },
  },
];

const shieldPowerups = (player) => [
  {
    id: "kDeflectorShield",
    name: "Deflector shield",
    description: () => {
      const title = "<h2>Active ability</h2>";
      let html = `${title}${shieldDescs["kDeflectorShield"]}`;
      if (player.activeAbility) {
        html += `<h3>replaces</h3> ${shieldDescs[player.activeAbility]}`;
      }
      return html;
    },
    glyph: "deflectorshield.png",
    lambda: () => {
      player.activeAbility = "kDeflectorShield";
    },
  },
  {
    id: "kEnergy shield",
    name: "Energy shield",
    description: () => {
      const title = "<h2>Active ability</h2>";
      let html = `${title}${shieldDescs["kEnergyShield"]}`;
      if (player.activeAbility) {
        html += `<h3>replaces</h3> ${shieldDescs[player.activeAbility]}`;
      }
      return html;
    },
    glyph: "energyshield.png",
    lambda: () => {
      player.activeAbility = "kDeflectorShield";
    },
  },
];

const superPowerups = (player) => [
  {
    id: "kPhaseShield",
    name: "Phase shield",
    description: () => {
      const title = "<h2>Active ability</h2>";
      let html = `${title}${shieldDescs["kPhaseShield"]}`;
      if (player.activeAbility) {
        html += `<h3>replaces</h3> ${shieldDescs[player.activeAbility]}`;
      }
      return html;
    },
    glyph: "phaseshield.png",
    lambda: () => {
      player.activeAbility = "kPhaseShield";
    },
  },
  {
    id: "kEmp",
    name: "EMP pulse",
    description: () => {
      const title = "<h2>Active ability</h2>";
      let html = `${title}${shieldDescs["kEmp"]}`;
      if (player.activeAbility) {
        html += `<h3>replaces</h3> ${shieldDescs[player.activeAbility]}`;
      }
      return html;
    },
    glyph: "emp.png",
    lambda: () => {
      player.activeAbility = "kEmp";
    },
  },
];

const shieldDescs = {
  kDeflectorShield:
    "<p>Deflector shield</p><hr/>Deflects strongly kinetic weapons for 3 seconds, affects mildly energy weapons.",
  kEnergyShield:
    "<p>Energy shield</p><hr/>Stops completely energy weapons for 3 seconds, no effect on kinetic weapons.",
  kPhaseShield:
    "<p>Phase shield</p><hr/>Let's you pass through asteroids, projectiles and beams for 3 seconds.",
  kEmp: "<p>EMP pulse</p><hr/>Creates an EMP pulse around you, disabling enemy ships for 3 seconds.",
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
