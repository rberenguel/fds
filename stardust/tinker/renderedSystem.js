export { RenderedSystem };

import { System, PlanetKinds } from "./system.js";
import {
  EarthLikePlanet,
  GasGiantPlanet,
  IceGiantPlanet,
  RockyPlanet,
  AtmospherePlanet,
  Sun,
} from "../planet.js";

class RenderedSystem extends System {
  constructor(props = {}) {
    super(props);
    this.app = props.app; // Required
    this.viewframe = props.viewframe; // Required
    this.planetObjects = this._planetObjects();
    this.planetObjects.map((p) => p.generate(this.app));
    this.planetObjects.map((p) => p.attach(this.viewframe));
  }

  update(delta) {
    this.planetObjects.map((p) => p.update(delta));
  }

  _planetObjects() {
    //const system = new System({ id: 0 });
    const nplanets = this.planets.length;
    let objs = [];
    const sun = new Sun({
      seed: 0,
      radius: this.starSize,
      e: 100000,
      p: { idx: -1 },
      name: this.name,
      color: this.starColor,
    });
    objs.push(sun);
    let angles = [];
    for (let i = 0; i < nplanets; i++) {
      angles.push((i * 2 * Math.PI) / nplanets);
    }
    const shuffledAngles = angles.slice().sort(() => Math.random() - 0.5);
    const angleShift = Math.random() * 2 * Math.PI;
    for (let i = 0; i < nplanets; i++) {
      const p = this.planets[i];
      let planet;
      const a = shuffledAngles[i] + angleShift;
      console.log(a);
      if (p.kind === PlanetKinds.EarthLike) {
        planet = new EarthLikePlanet({
          seed: i,
          pos: { x: p.distance * Math.cos(a), y: p.distance * Math.sin(a) },
          radius: p.radius,
          e: 100000,
          p: p,
        });
      }
      if (p.kind === PlanetKinds.Rocky) {
        planet = new RockyPlanet({
          seed: i,
          pos: { x: p.distance * Math.cos(a), y: p.distance * Math.sin(a) },
          radius: p.radius,
          e: 100000,
          p: p,
        });
      }
      if (p.kind === PlanetKinds.Atmosphere) {
        planet = new AtmospherePlanet({
          seed: i,
          pos: { x: p.distance * Math.cos(a), y: p.distance * Math.sin(a) },
          radius: p.radius,
          e: 100000,
          p: p,
        });
      }
      if (p.kind === PlanetKinds.GasGiant) {
        planet = new GasGiantPlanet({
          seed: i,
          pos: { x: p.distance * Math.cos(a), y: p.distance * Math.sin(a) },
          radius: p.radius,
          e: 100000,
          p: p,
        });
      }
      if (p.kind === PlanetKinds.IceGiant) {
        planet = new IceGiantPlanet({
          seed: i,
          pos: { x: p.distance * Math.cos(a), y: p.distance * Math.sin(a) },
          radius: p.radius,
          e: 100000,
          p: p,
        });
      }
      objs.push(planet);
    }
    return objs;
  }
}
