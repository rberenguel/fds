import { Ship } from "./shipbase.js";
import { Mesh, Meshes } from "../mesh.js";
export { Lynx };
import { FillGradient } from "../../libs/3rdparty/pixi.mjs";

class Lynx extends Ship {
  constructor(props) {
    const vertices = [
      [-70, 50],
      [70, 0],
      [-70, -50],
      [-30, 0],
      [-70, 50],
    ];
    const width = 14;
    const mesh = new Mesh({
      name: "",
      kind: Meshes.kPoly,
      vertices: vertices,
      color: 0xffffff,
      width: width,
      fill: 0x000000,
    });
    const secondaryWeaponMesh = new Mesh({
      name: "secondaryWeapon",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: width,
      color: 0xffffff,
      fill: 0xffffff,
    });
    const shieldMesh = new Mesh({
      name: "shield",
      kind: Meshes.kCircle,
      center: [0, 0],
      radius: 130,
      color: 0xffffff,
      fill: 0xcccccc,
      width: 10,
    });
    const phaseShieldMesh = new Mesh({
      name: "phaseShield",
      kind: Meshes.kPoly,
      vertices: vertices,
      color: 0xcccccc,
      gradienter:
        (mesh, p) =>
        (s1 = 1, s2 = 1) => {
          const colorStops = [0x00ff00, 0x000000];
          const gradientFill = new FillGradient(
            -50 * s1,
            -50 * s2,
            50 * s1,
            50 * s2,
          );
          colorStops.forEach((number, index) => {
            const ratio = index / colorStops.length;
            gradientFill.addColorStop(ratio, number);
          });
          p.clear().poly(mesh.flatten()).fill({ fill: gradientFill });
        },
    });
    const pointSightMesh = new Mesh({
      name: "pointSight",
      kind: Meshes.kPoly,
      vertices: [
        [20000, 6],
        [20000, -6],
        [0, -6],
        [0, 6],
      ],
      fill: 0x00ff00,
    });
    let weapons = props.weapons ?? [];
    let secondaryWeapons = props.secondaryWeapons ?? [];

    super({
      ...props,
      meshes: [
        shieldMesh,
        pointSightMesh,
        mesh,
        phaseShieldMesh,
        secondaryWeaponMesh,
      ],
      weapons: weapons,
      secondaryWeapons: secondaryWeapons,
      vertices: vertices,
    });
    this.mass = 7;
    this.width = width;
  }
}
