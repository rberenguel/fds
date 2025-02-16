export { ShipTypes, getInitialShipDistribution, distributionToHTML };

import { SystemCategories, GovernmentTypes } from "./systemEconomy.js";

const ShipTypes = {
  MILITARY: "military",
  POLICE: "police",
  TRADER: "trader",
  MINING: "mining",
  STATE: "state",
  SERVICES: "services",
  PIRATE: "pirate",
};

function getRandomInt(min, max, rnd) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(rnd() * (max - min + 1)) + min;
}

const distributionToHTML = (distribution) =>
  Object.entries(distribution)
    .filter(([, count]) => count > 0) // Only show types with at least one ship
    .map(
      ([type, count]) =>
        `<span class="ship-type">${type}:</span> <span class="ship-count">${count}</span>`,
    )
    .join(", ");

function getInitialShipDistribution(
  systemCategory,
  systemSubtype,
  governmentType,
  rnd = Math.random,
) {
  let distribution = {
    [ShipTypes.MILITARY]: 0,
    [ShipTypes.POLICE]: 0,
    [ShipTypes.TRADER]: 0,
    [ShipTypes.MINING]: 0,
    [ShipTypes.STATE]: 0,
    [ShipTypes.SERVICES]: 0,
    [ShipTypes.PIRATE]: 0,
  };

  switch (systemCategory) {
    case SystemCategories.Agricultural:
      distribution[ShipTypes.TRADER] = getRandomInt(5, 15, rnd);
      distribution[ShipTypes.SERVICES] = getRandomInt(2, 5, rnd);
      break;
    case SystemCategories.Industrial:
      distribution[ShipTypes.TRADER] = getRandomInt(10, 25, rnd);
      distribution[ShipTypes.SERVICES] = getRandomInt(3, 8, rnd);
      break;
    case SystemCategories.HighTech:
      distribution[ShipTypes.TRADER] = getRandomInt(8, 20, rnd);
      distribution[ShipTypes.SERVICES] = getRandomInt(5, 10, rnd);
      break;
    case SystemCategories.Mining:
      distribution[ShipTypes.MINING] = getRandomInt(5, 15, rnd);
      distribution[ShipTypes.TRADER] = getRandomInt(3, 8, rnd); // Traders to buy the ore
      break;
    case SystemCategories.Services:
      distribution[ShipTypes.TRADER] = getRandomInt(15, 30, rnd);
      distribution[ShipTypes.SERVICES] = getRandomInt(5, 15, rnd);
      break;
    case SystemCategories.Frontier:
      distribution[ShipTypes.TRADER] = getRandomInt(2, 8, rnd);
      distribution[ShipTypes.MINING] = getRandomInt(0, 5, rnd); // Could have or not
      break;
  }
  // --- Subtype Modifiers ---
  switch (systemSubtype) {
    case SystemCategories.AgriculturalRich:
      distribution[ShipTypes.TRADER] += getRandomInt(5, 10, rnd);
      break;
    case SystemCategories.IndustrialHeavy:
      distribution[ShipTypes.TRADER] += getRandomInt(5, 15, rnd);
      break;
    case SystemCategories.HighTechResearch:
      distribution[ShipTypes.STATE] += getRandomInt(2, 5, rnd); //More state ships
      break;
    case SystemCategories.HighTechIndustrial:
      distribution[ShipTypes.TRADER] += getRandomInt(5, 10, rnd);
      break;
    case SystemCategories.MiningRich:
      distribution[ShipTypes.MINING] += getRandomInt(5, 10, rnd);
      break;
    case SystemCategories.ServicesFinancial:
      distribution[ShipTypes.SERVICES] += getRandomInt(5, 10, rnd);
      break;
    case SystemCategories.FrontierOutpost:
      distribution[ShipTypes.MINING] = 0;
      distribution[ShipTypes.TRADER] += getRandomInt(1, 3, rnd);
      break;
  }

  // --- Government Modifiers ---

  switch (governmentType) {
    case GovernmentTypes.Anarchy:
      distribution[ShipTypes.PIRATE] = getRandomInt(5, 15, rnd);
      distribution[ShipTypes.POLICE] = 0;
      distribution[ShipTypes.MILITARY] = 0; // No organized military
      distribution[ShipTypes.TRADER] = Math.max(
        0,
        distribution[ShipTypes.TRADER] - getRandomInt(2, 5, rnd),
      ); // Traders avoid
      break;
    case GovernmentTypes.Feudal:
      distribution[ShipTypes.MILITARY] = getRandomInt(2, 6, rnd);
      distribution[ShipTypes.POLICE] = getRandomInt(1, 3, rnd);
      break;
    case GovernmentTypes.MultiGovernment:
      distribution[ShipTypes.MILITARY] = getRandomInt(4, 8, rnd); // Multiple factions
      distribution[ShipTypes.POLICE] = getRandomInt(2, 5, rnd);
      break;
    case GovernmentTypes.Dictatorship:
      distribution[ShipTypes.MILITARY] = getRandomInt(10, 20, rnd);
      distribution[ShipTypes.POLICE] = getRandomInt(5, 10, rnd);
      distribution[ShipTypes.STATE] = getRandomInt(2, 6, rnd); // State control
      break;
    case GovernmentTypes.Communist:
      distribution[ShipTypes.MILITARY] = getRandomInt(8, 15, rnd);
      distribution[ShipTypes.POLICE] = getRandomInt(8, 15, rnd);
      distribution[ShipTypes.STATE] = getRandomInt(5, 10, rnd); // State control
      distribution[ShipTypes.TRADER] = 0; // State controlled trade

      break;
    case GovernmentTypes.CorporateState:
      distribution[ShipTypes.MILITARY] = getRandomInt(3, 8, rnd); // Corporate security
      distribution[ShipTypes.POLICE] = getRandomInt(3, 8, rnd);
      break;
    case GovernmentTypes.Democracy:
      distribution[ShipTypes.MILITARY] = getRandomInt(4, 8, rnd);
      distribution[ShipTypes.POLICE] = getRandomInt(4, 8, rnd);
      distribution[ShipTypes.STATE] = getRandomInt(1, 4, rnd);
      break;
    case GovernmentTypes.Theocracy:
      distribution[ShipTypes.MILITARY] = getRandomInt(6, 12, rnd); // Religious guard
      distribution[ShipTypes.POLICE] = getRandomInt(4, 8, rnd);
      distribution[ShipTypes.STATE] = getRandomInt(3, 6, rnd);
      break;
    case GovernmentTypes.Technocracy:
      distribution[ShipTypes.MILITARY] = getRandomInt(5, 10, rnd); // Advanced military
      distribution[ShipTypes.POLICE] = getRandomInt(5, 10, rnd);
      break;
  }

  // --- Limit Total Ships ---

  let totalShips = 0;
  for (const type in distribution) {
    totalShips += distribution[type];
  }

  if (totalShips > 50) {
    const reductionFactor = 50 / totalShips;
    for (const type in distribution) {
      distribution[type] = Math.floor(distribution[type] * reductionFactor);
    }
  }

  return distribution;
}
