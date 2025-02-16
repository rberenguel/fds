export { universe, nodes, links };

import { System } from "./system.js";

import { seededRnd } from "../rnd.js";
let universe = [];
let links = [];

const SYSTEMS = 1000;

const rnd = seededRnd(42);

for (let i = 0; i < SYSTEMS; i++) {
  const sys = new System({ id: i });
  let nneighbors = 1 + rnd() * 2;
  for (let j = 0; j < nneighbors; j++) {
    const linked = Math.min(rnd() * i, SYSTEMS - 1);
    sys.neighbors[Math.floor(linked)] = true;
  }
  universe.push(sys);
}

const relink = (universe) => {
  // Link everything as needed
  for (let sys of universe) {
    for (const nei in sys.neighbors) {
      universe[nei].neighbors[sys.id] = true;
    }
  }
};

relink(universe);

const purge = (universe) => {
  // Purge too many
  for (let sys of universe) {
    const keys = Object.keys(sys.neighbors);
    if (keys.length > rnd() + 1) {
      const drops = keys.slice(Math.floor(rnd() * keys.length));
      for (let drop of drops) {
        delete sys.neighbors[drop];
      }
    }
  }
};

function findConnectedComponents(universe) {
  const visited = new Set();
  const components = [];

  for (const sys of universe) {
    if (!visited.has(sys.id)) {
      const component = [];
      const queue = [sys];
      visited.add(sys.id);

      while (queue.length > 0) {
        const currentSys = queue.shift();
        component.push(currentSys.id);

        for (const neighborId in currentSys.neighbors) {
          const neighborIdInt = parseInt(neighborId);
          if (!visited.has(neighborIdInt)) {
            visited.add(neighborIdInt);
            queue.push(universe[neighborIdInt]);
          }
        }
      }

      components.push(component);
    }
  }

  return components;
}

purge(universe);
purge(universe);
relink(universe);

const reblob = (universe, props = { fullrandom: true, threshold: 2 }) => {
  let components = findConnectedComponents(universe);
  let blob = [];

  for (let component of components) {
    if (component.length <= props.threshold) {
      blob = blob.concat(component);
    }
  }

  for (let i = 0; i < blob.length; i++) {
    const sys = universe[blob[i]];
    if (props.fullrandom) {
      let nneighbors = 5 + rnd() * 5;
      for (let j = 0; j < nneighbors; j++) {
        const linked = blob[Math.floor(Math.min(rnd() * i, blob.length - 1))];
        sys.neighbors[linked] = true;
      }
    } else {
      for (let j = i; j < blob.length; j++) {
        if (props.random()) {
          const linked = blob[j];
          sys.neighbors[linked] = true;
        }
      }
    }
  }
};

reblob(universe);
relink(universe);
purge(universe);
purge(universe);
relink(universe);
reblob(universe, {
  fullrandom: false,
  threshold: 5,
  random: () => rnd() < 0.01,
});
relink(universe);
reblob(universe, {
  fullrandom: false,
  threshold: 5,
  random: () => rnd() < 0.01,
});
relink(universe);
reblob(universe, { fullrandom: false, threshold: 10, random: () => rnd() < 1 });
relink(universe);

let components = findConnectedComponents(universe);

for (const sys of universe) {
  for (const nei in sys.neighbors) {
    if (parseInt(nei) > sys.id) {
      links.push({ source: sys.id, target: parseInt(nei) });
    }
  }
}
const nodes = universe.map((sys) => ({ id: sys.id, system: sys }));

const toLatinForm = (number) => {
  if (number < 0 || number > 15) {
    return "Number must be between 0 and 15"; // Or throw an error
  }

  const romanNumerals = [
    { value: 10, numeral: "x" },
    { value: 9, numeral: "ix" },
    { value: 5, numeral: "v" },
    { value: 4, numeral: "iv" },
    { value: 1, numeral: "i" },
  ];

  let result = "";
  let remaining = Math.floor(number); // Use Math.floor to handle potential decimals

  if (remaining === 0) {
    return "nulla"; // or just "" for an empty string
  }

  for (let i = 0; i < romanNumerals.length; i++) {
    while (remaining >= romanNumerals[i].value) {
      result += romanNumerals[i].numeral;
      remaining -= romanNumerals[i].value;
    }
  }

  return result;
};

const dedupeUniverse = (universe) => {
  let counts = {};
  let dupes = [];
  let letters = "ABCDEF";
  const names = universe.map((s) => s.name);
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    if (counts[name]) {
      counts[name].count += 1;
    } else {
      counts[name] = {
        count: 0,
        alpha: i,
      };
    }
    const c = counts[name].count;
    if (c >= 1) {
      const a = counts[name].alpha;
      universe[i].name = `${name}-${letters[c]}`;
      universe[a].name = `${name}-A`;
      console.log(universe[i].name);
      console.log(universe[a].name);
    }
  }
  return dupes;
};

dedupeUniverse(universe);

if (window.DEVMODE) {
  window.universe = universe;
}
