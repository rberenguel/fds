export { System, generateEliteName };

import { seededRnd } from "../rnd.js";
import { DEBUG } from "../flags.js";
const humanizePopulation = (n) => {
  if (n > 1000) {
    return `${n / 1000} billion`;
  }
  return `${n} million`;
};

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

class System {
  static STARSIZEFACTOR = 10000;
  static EARTH_LIKE_LIMIT = 500000;
  static JUPITER_LIKE_LIMIT = 750000;

  constructor(props) {
    this.id = props.id;
    this.neighbors = {}; // Just to have a set
    this.rnd = seededRnd(props.id + 44);
    this.name = generateEliteName(seededRnd(this.id + 69673865));
    this.numPlanets = Math.floor(5 + this.rnd() * 6);
    this.government = "Democracy";
    this.population = Math.floor(500 + this.rnd() * 5000);
    this.starSize = (1.0 + this.rnd() * 10.0) * System.STARSIZEFACTOR;
    this.starColor = this._starColor();
    this.stations = this._stations();
    this.planets = this._planets();
  }
  info() {
    return `System ID: ${this.id} <br> Neighbors: ${Object.keys(
      this.neighbors,
    ).join(", ")}`;
  }
  extendedinfo() {
    return `
      <h2>System ${this.name} (${this.id})</h2>
      <p>Population: ${humanizePopulation(this.population)}</p>
      <p>Planets: ${this.numPlanets}</p>
      <p>Government: ${this.government}</p>
      `;
  }
  r() {
    return 0;
  }
  _planets() {
    const numEarthLike = Math.floor(2 + this.rnd() * this.numPlanets);
    const numGasGiants = this.numPlanets - numEarthLike;
    console.log(numEarthLike);
    console.log(numGasGiants);
    console.log(this.starSize);
    let planets = [];
    const habitableDistance = Math.floor(7 * this.starSize);
    // The habitability band is 7 stars far and N stars deep
    const firstGap = this.starSize + this.starSize;
    let prev = firstGap;
    for (let i = 0; i < numEarthLike; i++) {
      // Earth-like radius is from 10k to 40k
      const gap = Math.floor(
        (System.EARTH_LIKE_LIMIT - prev) / (numEarthLike - i),
      );
      const distance = prev + this.rnd() * gap;
      const radius =
        10000 +
        0.2 * (i + 1) * Math.min(this.rnd() * 30000, this.rnd() * gap * 0.25);
      prev = distance + radius;
      const inHabitableRadius =
        Math.abs(habitableDistance - distance) < this.starSize * 2;
      const hasAtmosphere = inHabitableRadius
        ? this.rnd() * 15 > 1
        : this.rnd() * 10 > 3;
      const habitable = hasAtmosphere && inHabitableRadius;
      const density = habitable ? 1 : this.rnd() * 2;
      let kind;
      if (habitable) {
        kind = "kEarthLikePlanet";
      } else {
        if (density < 1) {
          kind = "kRocky";
        } else {
          kind = "kAtmosphere";
        }
      }
      console.log(distance);
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
    for (let i = 0; i < numGasGiants; i++) {
      // Earth-like radius is from 10k to 40k
      const factor = numGasGiants - i;
      const gap = prev / factor;
      const distance = prev + gap + this.rnd() * gap;
      console.log(distance);
      const radius = 50000 + this.rnd() * 5000 * factor;
      prev = distance + radius;
      const kind = this.rnd() < 0.15 * factor ? "kGasGiant" : "kIceGiant";
      const planet = {
        kind: kind,
        distance: distance,
        radius: radius,
        idx: i + numEarthLike,
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

if (window.DEVMODE) {
  window.System = System;
}
