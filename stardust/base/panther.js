export { Panther };

import { Mesh, Meshes } from "../mesh.js";
import { Ship } from "./shipbase.js";
import { LaserGun, MassDriverGun } from "../weapons/weapons.js";
import { Flame } from "../flame.js";
import { rotate } from "../math.js";

class Panther extends Ship {
  constructor(props) {
    const width = 14;
    const verticesBase = [
      [110, 40],
      [110, -40],
      [-80, -70],
      [-110, -50],
      [-110, 50],
      [-80, 70],
    ];
    const verticesSide1 = [
      [60, -55],
      [-60, -70],
      [-70, -110],
      [60, -100],
    ];
    const verticesSide2 = [
      [60, 55],
      [-60, 70],
      [-70, 110],
      [60, 100],
    ];
    const color = 0xffffff;
    const orange = 0xff8800;
    const targettedV = new Mesh({
      name: "targetted",
      kind: Meshes.kLine,
      vertices: [[-130, 0], [130, 0]],
      color: orange,
      width: width ?? 10,
    });
    const targettedH = new Mesh({
      name: "targetted",
      kind: Meshes.kLine,
      vertices: [[0, -130], [0, 130]],
      color: orange,
      width: width ?? 10,
    });
    const meshBelowBase = new Mesh({
      name: "hitMesh",
      kind: Meshes.kPoly,
      vertices: verticesBase,
      fill: 0xffffff,
    });
    const meshAroundBase = new Mesh({
      kind: Meshes.kPoly,
      vertices: verticesBase,
      color: color,
      width: width,
      fill: 0x000000,
    });
    const meshBelowSide1 = new Mesh({
      name: "hitMesh",
      kind: Meshes.kPoly,
      vertices: verticesSide1,
      fill: 0xffffff,
    });
    const meshAroundSide1 = new Mesh({
      kind: Meshes.kPoly,
      vertices: verticesSide1,
      color: color,
      width: width,
      fill: 0x000000,
    });
    const meshBelowSide2 = new Mesh({
      name: "hitMesh",
      kind: Meshes.kPoly,
      vertices: verticesSide2,
      fill: 0xffffff,
    });
    const meshAroundSide2 = new Mesh({
      kind: Meshes.kPoly,
      vertices: verticesSide2,
      color: color,
      width: width,
      fill: 0x000000,
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
      vertices: [[110, 25], [60, 25], [60, 15], [110, 15]],
      fill: 0xffffff,
    });
    const primaryWeaponMesh2 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [[110, -25], [60, -25], [60, -15], [110, -15]],
      fill: 0xffffff,
    });
    const primaryWeaponMesh3 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [[60, -75], [10, -75], [10, -85], [60, -85]],
      fill: 0xff0000,
    });
    const primaryWeaponMesh4 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [[60, 75], [10, 75], [10, 85], [60, 85]],
      fill: 0xff0000,
    });
    const primaryWeaponMesh5 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [[-110, 25], [-60, 25], [-60, 15], [-110, 15]],
      fill: 0xffffff,
    });
    const primaryWeaponMesh6 = new Mesh({
      name: "primaryWeapon",
      kind: Meshes.kPoly,
      vertices: [[-110, -25], [-60, -25], [-60, -15], [-110, -15]],
      fill: 0xffffff,
    });
    let weapons = [];
    super({
      ...props,
      e: 5000,
      meshes: [
        secondaryWeaponMesh,
        primaryWeaponMesh1,
        primaryWeaponMesh2,
        primaryWeaponMesh3,
        primaryWeaponMesh4,
        primaryWeaponMesh5,
        primaryWeaponMesh6,
        meshAroundBase,
        meshAroundSide1,
        meshAroundSide2,
        meshBelowBase,
        meshBelowSide1,
        meshBelowSide2,
        targettedH,
        targettedV,
      ],
      weapons: weapons,
      vertices: verticesBase,
    });
    try {
      const massDriverGun1 = new MassDriverGun({ pos: { x: 110, y: 30 }, source: this._id });
      const massDriverGun2 = new MassDriverGun({ pos: { x: 110, y: -30 }, source: this._id });
      const massDriverGun3 = new MassDriverGun({ pos: { x: -110, y: 20 }, source: this._id, angleShift: Math.PI });
      const massDriverGun4 = new MassDriverGun({ pos: { x: -110, y: -20 }, source: this._id, angleShift: Math.PI });
      const laserGun1 = new LaserGun({ pos: { x: 60, y: -85 }, color: 0xff0000, source: this._id });
      const laserGun2 = new LaserGun({ pos: { x: 60, y: 85 }, color: 0xff0000, source: this._id });
      weapons = [massDriverGun1, massDriverGun2, laserGun1, laserGun2, massDriverGun3, massDriverGun4];
      this.weapons = weapons;
      this._initAmmo(weapons);
    } catch (err) {
      console.error(err);
    }

    this.mass = 50;
    this.width = width;
    this.color = color;
    this.radius = 100;
  }

  _backThrust(props = {}) {
    const spread = 0.3 - 0.6 * Math.random();
    const ivx = -Math.cos(this.r + spread);
    const ivy = -Math.sin(this.r + spread);
    const pvx = props.pvx ?? 0;
    const pvy = props.pvy ?? 0;
    const vx = Flame.ACCEL * ivx + (this.vel.x + pvx) * Math.sqrt(Math.random());
    const vy = Flame.ACCEL * ivy + (this.vel.y + pvy) * Math.sqrt(Math.random());
    const [rvx, rvy] = rotate(vx, vy, spread);
    const [rpx1, rpy1] = rotate(-90, -90, this.r);
    const [rpx2, rpy2] = rotate(-90, 90, this.r);
    const fl1 = new Flame({ pos: { x: this.pos.x + rpx1, y: this.pos.y + rpy1 }, vel: { x: rvx, y: rvy }, r: this.r, e: 12, fill: props.fill });
    const fl2 = new Flame({ pos: { x: this.pos.x + rpx2, y: this.pos.y + rpy2 }, vel: { x: rvx, y: rvy }, r: this.r, e: 12, fill: props.fill });
    this.flameList.push(fl1);
    this.flameList.push(fl2);
  }
}
