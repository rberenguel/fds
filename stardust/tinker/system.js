export { System, generateEliteName, PlanetKinds };

import { seededRnd } from "../rnd.js";
import { DEBUG } from "../flags.js";
const humanizePopulation = (n) => {
  if (n > 1000) {
    return `${n / 1000} billion`;
  }
  return `${n} million`;
};

import {
  commodityRegistry,
  GovernmentTypes,
  SystemCategories,
} from "./systemEconomy.js";
import {
  getInitialShipDistribution,
  distributionToHTML,
} from "./systemShips.js";

const PlanetKinds = {
  EarthLike: "kEarthLike",
  Rocky: "kRocky",
  Atmosphere: "kAtmosphere",
  GasGiant: "kGasGiant",
  IceGiant: "kIceGiant",
  Sun: "kSun",
};

class System {
  static STARSIZEFACTOR = 10000;
  static EARTH_LIKE_LIMIT = 500000;
  static JUPITER_LIKE_LIMIT = 750000;

  constructor(props) {
    this.id = props.id;
    this.neighbors = {}; // Just to have a set
    this.rnd = seededRnd(props.id + 42);
    this.name = generateEliteName(seededRnd(this.id + 69673865));
    this.starSize = (1.0 + this.rnd() * 10.0) * System.STARSIZEFACTOR;
    this.rnd = seededRnd(props.id + 9); // Refresh and fix seeding again so planets are fixed from this point
    // Magic number that makes Lave have a bit of everything
    this.numPlanets = Math.floor(5 + this.rnd() * 6);
    this.planets = this._planets();
    this.category = SystemCategories.getOne(this.rnd() * 100);
    this.government = GovernmentTypes.getOne(this.rnd() * 100);
    this.subCategory = SystemCategories.getRandomSubType(
      this.category,
      this.rnd() * 100,
    );
    this.population = Math.floor(500 + this.rnd() * 5000);
    this.starColor = this._starColor();
    this.shipDistribution = getInitialShipDistribution(
      this.category,
      this.subCategory,
      this.government,
      this.rnd,
    );
    this.stations = this._stations();
    this.currentProduction = {}; // TODO deprecated?
    this.inventory = {};
    this.hasNebula = true;
  }
  info() {
    return `System ID: ${this.id} <br> Neighbors: ${Object.keys(
      this.neighbors,
    ).join(", ")}`;
  }
  extendedinfo() {
    let planetInfo = `${this.numPlanets} total, `;
    if (this.numEarthLike > 0) {
      planetInfo += `${this.numEarthLike} 🌍 `;
    }
    if (this.numGasGiants > 0) {
      planetInfo += `/ ${this.numGasGiants} 🪐`;
    }
    const governmentStr = `${GovernmentTypes.repr(this.government).name}`;
    const categoryStr = `${SystemCategories.subRepr(this.subCategory).name}`;
    const producedBySubtype = commodityRegistry.getProducedCommodities(
      this.subCategory,
    );
    const consumedBySubtype = commodityRegistry.getConsumedCommodities(
      this.subCategory,
    );
    const producedHTML = producedBySubtype
      .map(
        (item) => `
      <span class="commodity-name">${item.commodity.name}:</span>
      <span class="commodity-weight">${item.weight}</span>
  `,
      )
      .join("<br>");
    const consumedHTML = consumedBySubtype
      .map(
        (item) => `
    <span class="commodity-name">${item.commodity.name}:</span>
    <span class="commodity-weight">${item.weight}</span>
`,
      )
      .join("<br>");
    const shipDist = distributionToHTML(this.shipDistribution);
    return `
      <h2>System ${this.name} (${this.id})</h2>
      <p>Population: ${humanizePopulation(this.population)}</p>
      <p>Planets: ${planetInfo}</p>
      <p>Government: ${governmentStr}</p>
      <p>Category: ${categoryStr}</p>
      <hr/>
      <p>Produces:</p>
      ${producedHTML}
      <hr/>
      <p>Consumes:</p>
      ${consumedHTML}
      <hr/>
      ${shipDist}
      `;
  }
  r() {
    return 0;
  }
  getProducedCommodities() {
    // Use the registry to get produced commodities based on subCategory
    return commodityRegistry.getProducedCommodities(this.subCategory);
  }

  getConsumedCommodities() {
    // Use the registry to get consumed commodities based on subCategory
    return commodityRegistry.getConsumedCommodities(this.subCategory);
  }

  addToInventory(commodityId, quantity) {
    if (!this.inventory[commodityId]) {
      this.inventory[commodityId] = 0;
    }
    this.inventory[commodityId] += quantity;
  }

  // New method to remove from inventory
  removeFromInventory(commodityId, quantity) {
    if (this.inventory[commodityId]) {
      this.inventory[commodityId] -= quantity;
      if (this.inventory[commodityId] < 0) {
        this.inventory[commodityId] = 0; // Prevent negative inventory
      }
    }
  }
  getInventory(commodityId) {
    //Helper
    return this.inventory[commodityId] || 0;
  }

  _planets() {
    this.numEarthLike = Math.abs(
      Math.min(
        Math.floor(2 + this.rnd() * this.numPlanets),
        this.numPlanets - 4,
      ),
    );
    this.numGasGiants = Math.max(0, this.numPlanets - this.numEarthLike);
    let planets = [];
    const habitableDistance = Math.floor(7 * this.starSize);
    const habitabilityStrip = this.starSize * (2 + this.rnd());
    if (DEBUG.system) {
      console.log("Habitability parameters");
      console.log(habitableDistance, habitabilityStrip);
    }

    // The habitability band is 7 stars far and N stars deep
    const firstGap = this.starSize + this.starSize;
    let prev = firstGap;
    for (let i = 0; i < this.numEarthLike; i++) {
      // Earth-like radius is from 10k to 40k
      const gap = Math.floor(
        (System.EARTH_LIKE_LIMIT - prev) / (this.numEarthLike - i),
      );
      const distance = prev + this.rnd() * gap;
      const radius =
        10000 +
        0.2 * (i + 1) * Math.min(this.rnd() * 30000, this.rnd() * gap * 0.25);
      prev = distance + radius;
      const inHabitableRadius =
        Math.abs(habitableDistance - distance) < habitabilityStrip;
      const hasAtmosphere = inHabitableRadius
        ? this.rnd() * 15 > 1
        : this.rnd() * 10 > 3;
      const habitable = hasAtmosphere && inHabitableRadius;
      const density = habitable ? 1 : this.rnd() * 2;
      let kind;
      if (habitable) {
        kind = "kEarthLike";
      } else {
        if (density < 1) {
          kind = "kRocky";
        } else {
          kind = "kAtmosphere";
        }
      }
      const planet = {
        kind: kind,
        distance: distance,
        radius: radius,
        atmosphere: hasAtmosphere,
        habitable: habitable,
        idx: i,
      };
      planets.push(planet);
    }
    prev = System.EARTH_LIKE_LIMIT + System.EARTH_LIKE_LIMIT * 0.5;
    for (let i = 0; i < this.numGasGiants; i++) {
      // Earth-like radius is from 10k to 40k
      const factor = this.numGasGiants - i;
      const gap = prev / factor;
      const distance = prev + gap + this.rnd() * gap;
      const radius = 50000 + this.rnd() * 5000 * factor;
      prev = distance + radius;
      const kind = this.rnd() < 0.15 * factor ? "kGasGiant" : "kIceGiant";
      const planet = {
        kind: kind,
        distance: distance,
        radius: radius,
        idx: i + this.numEarthLike,
      };
      planets.push(planet);
    }
    return planets;
    // TODO moon count
    // TODO rings
  }

  _starColor() {
    const hue = this.rnd() * 360;
    const saturation = 40 + this.rnd() * 30;
    const lightness = 80 + this.rnd() * 5;
    const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    return color;
  }
  _stations() {
    return Math.floor(this.rnd() * this.rnd() * 6);
  }
}

function generateEliteName(rnd) {
  const vowels = "AEIOU";
  const consonants = "BCDFGHJKLMNPQRSTVWXYZ";

  const consonantGroups = {
    C: "CHLMNTRYZ",
    R: "CHLMNTRYZ",
    L: "CHLMNTYZ",
    P: "HLRY",
    B: "HLRY",
    D: "HLRY",
    F: "LRY",
    G: "HLRY",
    H: "Y",
    J: "Y",
    K: "KHLRYZ",
    M: "BPY",
    N: "BCPY",
    S: "CHLMNTRYZ",
    T: "HRY",
    V: "Y",
    Z: "Y",
  };

  let name = "";

  // Less likely to start with a vowel (e.g., 80% consonant start)
  let useVowel = rnd() > 0.8;

  let lastConsonant = null; // Track the last consonant used
  let consecutiveConsonants = 0;
  for (let i = 0; i < 3 + 2 * rnd(); i++) {
    let charSet = useVowel ? vowels : consonants;

    if (lastConsonant) {
      // Apply consonant following rules
      const allowedConsonants = consonantGroups[lastConsonant];
      if (allowedConsonants) {
        charSet = allowedConsonants + vowels; // Allowed + vowels
        if (!useVowel) {
          charSet = allowedConsonants; // Only allowed consonants if it's not a vowel turn
        }
      } else if (!useVowel) {
        // If no rule, don't allow ANY consonant
        charSet = vowels;
      }
    }

    if (consecutiveConsonants > 1) {
      charSet = vowels;
    }

    let char;
    if (charSet === vowels) {
      char = charSet[Math.floor(rnd() * charSet.length)];
    } else {
      char = charSet[Math.floor(rnd() * charSet.length)];
    }

    name += char;

    if (consonants.includes(char)) {
      lastConsonant = char;
      consecutiveConsonants++;
    } else {
      lastConsonant = null; // Reset if vowel or no rule
      consecutiveConsonants = 0;
    }

    useVowel = !useVowel;
    if (rnd() < 0.05) {
      // Chance to repeat (consonant or vowel)
      useVowel = !useVowel;
    }
  }
  const final = rnd();
  if (final > 0.5) {
    return name;
  } else {
    return name.split("").reverse().join("");
  }
}

if (window.DEVMODE) {
  window.System = System;
  window.SystemCategories = SystemCategories;

  for (let i = 0; i < 0; i++) {
    const s = new System({ id: 0, _id: i });
    const ps = s.planets;
    const el = ps.filter((p) => p.kind === PlanetKinds.EarthLike).length > 0;
    const r = ps.filter((p) => p.kind === PlanetKinds.Rocky).length > 0;
    const a = ps.filter((p) => p.kind === PlanetKinds.Atmosphere).length > 0;
    const gg = ps.filter((p) => p.kind === PlanetKinds.GasGiant).length > 0;
    const ig = ps.filter((p) => p.kind === PlanetKinds.IceGiant).length > 0;
    if (el && r && a && gg && ig) {
      console.log(i);
      break;
    }
  }
}
