export { Bobcat };

import { Mesh, Meshes } from "../mesh.js";
import { Ship } from "./shipbase.js";
import { PlasmaGun } from "../weapons/weapons.js";

class Bobcat extends Ship {
  constructor(props) {
    const width = 14;
    const vertices = [
      [-70, 50],
      [-50, 60],
      [70, 0],
      [-50, -60],
      [-70, -50],
      [-30, 0],
      [-70, 50],
    ];
    const color = 0xffffff;
    const meshBelow = new Mesh({
      name: "hitMesh",
      kind: Meshes.kPoly,
      vertices: vertices,
      fill: 0xffffff,
    });
    const meshAround = new Mesh({
      kind: Meshes.kPoly,
      vertices: vertices,
      color: color,
      width: width,
    });
    const orange = 0xff8800;
    const targettedV = new Mesh({
      name: "targetted",
      kind: Meshes.kLine,
      vertices: [
        [-130, 0],
        [130, 0],
      ],
      color: orange,
      width: width ?? 10,
    });
    const targettedH = new Mesh({
      name: "targetted",
      kind: Meshes.kLine,
      vertices: [
        [0, -130],
        [0, 130],
      ],
      color: orange,
      width: width ?? 10,
    });

    const secondaryWeaponMesh = new Mesh({
      name: "secondaryWeapon",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 10,
      color: color,
      fill: 0xffffff,
    });
    const primaryWeaponMesh1 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [
        [15, 35],
        [-50, 35],
        [-50, 25],
        [15, 25],
      ],
      fill: 0xffffff,
    });
    const primaryWeaponMesh2 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [
        [15, -35],
        [-50, -35],
        [-50, -25],
        [15, -25],
      ],
      fill: 0xffffff,
    });
    let weapons = [];
    super({
      ...props,
      meshes: [
        secondaryWeaponMesh,
        primaryWeaponMesh1,
        primaryWeaponMesh2,
        meshBelow,
        meshAround,
        targettedH,
        targettedV,
      ],
      weapons: weapons,
      vertices: vertices,
    });
    try {
      const plasmaGun1 = new PlasmaGun({
        pos: { x: -30, y: 50 },
        source: this._id,
      });
      const plasmaGun2 = new PlasmaGun({
        pos: { x: -30, y: -50 },
        source: this._id,
      });
      weapons = [plasmaGun1, plasmaGun2];
      this.weapons = weapons;
      this._initAmmo(weapons);
    } catch (err) {
      console.error(err);
    }

    this.mass = 10;
    this.width = width;
    this.color = color;
  }
}
