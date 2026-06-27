export { transitionTick };

import { GovernmentTypes } from "./systemEconomy.js";
import { getInitialShipDistribution } from "./systemShips.js";

const ANARCHY_REVOLUTION_TICKS = 300;
const STABILITY_THRESHOLD = 100;
const TRANSITION_CHANCE = 0.005;
const MAX_TRANSITIONS_PER_TICK = 1;

const DESTRUCTION = {
  [GovernmentTypes.Anarchy]:         0.50,
  [GovernmentTypes.MultiGovernment]: 0.30,
  [GovernmentTypes.Feudal]:          0.30,
  [GovernmentTypes.Theocracy]:       0.30,
  [GovernmentTypes.Dictatorship]:    0.20,
  [GovernmentTypes.Communist]:       0.20,
  [GovernmentTypes.CorporateState]:  0.10,
  [GovernmentTypes.Democracy]:       0.05,
  [GovernmentTypes.Technocracy]:     0.05,
};

const DOWNWARD = {
  [GovernmentTypes.Democracy]:       [GovernmentTypes.CorporateState],
  [GovernmentTypes.Technocracy]:     [GovernmentTypes.CorporateState],
  [GovernmentTypes.CorporateState]:  [GovernmentTypes.Dictatorship, GovernmentTypes.Communist],
  [GovernmentTypes.Dictatorship]:    [GovernmentTypes.Feudal],
  [GovernmentTypes.Communist]:       [GovernmentTypes.MultiGovernment],
  [GovernmentTypes.Feudal]:          [GovernmentTypes.Anarchy],
  [GovernmentTypes.Theocracy]:       [GovernmentTypes.Feudal, GovernmentTypes.MultiGovernment],
  [GovernmentTypes.MultiGovernment]: [GovernmentTypes.Anarchy],
  [GovernmentTypes.Anarchy]:         null,
};

const UPWARD = {
  [GovernmentTypes.Feudal]:          [GovernmentTypes.Dictatorship, GovernmentTypes.Communist],
  [GovernmentTypes.Theocracy]:       [GovernmentTypes.Dictatorship, GovernmentTypes.Communist],
  [GovernmentTypes.MultiGovernment]: [GovernmentTypes.Dictatorship, GovernmentTypes.Communist],
  [GovernmentTypes.Dictatorship]:    [GovernmentTypes.CorporateState],
  [GovernmentTypes.Communist]:       [GovernmentTypes.CorporateState],
  [GovernmentTypes.CorporateState]:  [GovernmentTypes.Democracy, GovernmentTypes.Technocracy],
  [GovernmentTypes.Democracy]:       null,
  [GovernmentTypes.Technocracy]:     null,
  [GovernmentTypes.Anarchy]:         null,
};

const REVOLUTION_CANDIDATES = [
  GovernmentTypes.Feudal,
  GovernmentTypes.Theocracy,
  GovernmentTypes.Communist,
  GovernmentTypes.Dictatorship,
];

function pickRandom(options) {
  return options[Math.floor(Math.random() * options.length)];
}

function pickRevolutionGov(system, universe) {
  const weights = {};
  for (const g of REVOLUTION_CANDIDATES) weights[g] = 1;
  for (const nId in system.neighbors) {
    const n = universe[nId];
    if (n && weights[n.government] !== undefined) weights[n.government] += 2;
  }
  const total = Object.values(weights).reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (const [gov, w] of Object.entries(weights)) {
    r -= w;
    if (r <= 0) return gov;
  }
  return REVOLUTION_CANDIDATES[0];
}

function destroyGoods(system, fraction) {
  for (const id in system.inventory) {
    system.inventory[id] = Math.floor(system.inventory[id] * (1 - fraction));
  }
}

function applyTransition(system, newGov, destructionFraction) {
  const oldGov = system.government;
  system.government = newGov;
  system.stabilityCounter = 0;
  system.anarchyTicks = 0;
  destroyGoods(system, destructionFraction);
  system.shipDistribution = getInitialShipDistribution(
    system.category,
    system.subCategory,
    newGov,
    Math.random,
  );
  return oldGov;
}

function transitionTick(universe) {
  const events = [];

  // Shuffle so the cap doesn't always favour low-index systems
  const shuffled = universe.slice().sort(() => Math.random() - 0.5);

  for (const system of shuffled) {
    if (events.length >= MAX_TRANSITIONS_PER_TICK) break;

    if (system.anarchyTicks === undefined) system.anarchyTicks = 0;

    if (system.government === GovernmentTypes.Anarchy) {
      system.anarchyTicks++;
    } else {
      system.anarchyTicks = 0;
    }

    // Revolution: escape from prolonged anarchy (no probability gate — time is the gate)
    if (system.anarchyTicks >= ANARCHY_REVOLUTION_TICKS) {
      const newGov = pickRevolutionGov(system, universe);
      const oldGov = applyTransition(system, newGov, 0.30);
      system.stabilityCounter = 20; // honeymoon: new government gets a head start
      events.push({ system, from: oldGov, to: newGov, type: "revolution" });
      continue;
    }

    // Downward collapse
    if (system.stabilityCounter <= -STABILITY_THRESHOLD) {
      if (Math.random() < TRANSITION_CHANCE) {
        const options = DOWNWARD[system.government];
        if (options) {
          const newGov = pickRandom(options);
          const oldGov = applyTransition(system, newGov, DESTRUCTION[newGov]);
          events.push({ system, from: oldGov, to: newGov, type: "collapse" });
        }
      }
      continue;
    }

    // Upward recovery
    if (system.stabilityCounter >= STABILITY_THRESHOLD) {
      if (Math.random() < TRANSITION_CHANCE) {
        const options = UPWARD[system.government];
        if (options) {
          const newGov = pickRandom(options);
          const oldGov = applyTransition(system, newGov, DESTRUCTION[newGov]);
          events.push({ system, from: oldGov, to: newGov, type: "upgrade" });
        } else {
          system.stabilityCounter = 0;
        }
      }
    }
  }

  return events;
}
