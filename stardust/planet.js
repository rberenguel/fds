export { planet };

import { Mesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";

import { rotate } from "./math.js";

const planet = (texture) =>
  new Base1({
    pos: {
      x: 5000,
      y: 1500,
    },
    e: 100000000000,

    meshes: [
      new Mesh({
        kind: Meshes.kPlanet,
        center: [0, 0],
        radius: 2000,
        fill: 0x303030,
        texture: texture,
      }),
    ],
  });
