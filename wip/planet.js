export { planet }

import { Mesh, Meshes } from "./mesh.js"
import { Base1 } from "./base.js"

import { rotate } from "./math.js"


const planet = new Base1({
  pos: {
    x: 30000,
    y: 100
  },
  e: 100000000000,

  meshes: [new Mesh({
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 20000,
      fill: 0x303030,
    })]
})


