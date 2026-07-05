export { Scene, SpaceScene, computeEntryPosition };

import { Viewframe } from "./viewframe.js";
import { Starfield } from "./parallax.js";
import { RenderedSystem } from "./tinker/renderedSystem.js";
import { sqnorm } from "./math.js";
import { PlanetKinds } from "./tinker/system.js";
import { otherControl } from "./pid.js";
import { npcControl, traderControl } from "./npc.js";
import { Lynx } from "./base/lynx.js";
import { Bobcat } from "./base/bobcat.js";
import { Flame } from "./flame.js";
import { settings } from "../roids2/settings.js";
import { Debris } from "./base/debris.js";
import { Minimap } from "./minimap.js";
import { CommsSystem } from "./comms.js";
import { Station, APPROACH_RANGE } from "./station.js";
import { WarpTunnel, TUNNEL_RADIUS } from "./warpTunnel.js";
import { universe } from "./tinker/universe.js";
import { ShipTypes } from "./tinker/systemShips.js";
import { generateShipName } from "./comms.js";
import { seededRnd } from "./rnd.js";
import { MassDriverGun, PhotonTorpedoLauncher } from "./weapons/weapons.js";
import { Wreck, SCOOP_RANGE, SCAN_RANGE, HALO_RADIUS } from "./wreck.js";

// Loot tables keyed by planet kind.
// Each entry: [weight, loot object]  — rnd() selects by cumulative weight.
const LOOT_TABLES = {
  [PlanetKinds.Rocky]:      [[0.5, { kind:'ammo', weapon:'kMassDriverGun', count:40 }],
                             [0.3, { kind:'ammo', weapon:'kPhotonTorpedoLauncher', count:3 }],
                             [0.2, { kind:'credits', count:800 }]],
  [PlanetKinds.EarthLike]:  [[0.4, { kind:'ammo', weapon:'kMassDriverGun', count:30 }],
                             [0.3, { kind:'credits', count:1200 }],
                             [0.2, { kind:'ammo', weapon:'kPhotonTorpedoLauncher', count:4 }],
                             [0.1, { kind:'item', id:'matterCompressorMk1', name:'Matter compressor Mk1' }]],
  [PlanetKinds.Atmosphere]: [[0.45, { kind:'credits', count:1500 }],
                             [0.3,  { kind:'ammo', weapon:'kMassDriverGun', count:50 }],
                             [0.15, { kind:'ammo', weapon:'kPhotonTorpedoLauncher', count:5 }],
                             [0.1,  { kind:'item', id:'matterCompressorMk1', name:'Matter compressor Mk1' }]],
  [PlanetKinds.GasGiant]:   [[0.4,  { kind:'credits', count:2000 }],
                             [0.25, { kind:'ammo', weapon:'kPhotonTorpedoLauncher', count:8 }],
                             [0.2,  { kind:'item', id:'matterCompressorMk2', name:'Matter compressor Mk2' }],
                             [0.15, { kind:'item', id:'targetingComputer', name:'Targeting computer' }]],
  [PlanetKinds.IceGiant]:   [[0.35, { kind:'credits', count:3000 }],
                             [0.25, { kind:'item', id:'matterCompressorMk2', name:'Matter compressor Mk2' }],
                             [0.2,  { kind:'item', id:'matterCompressorMk3', name:'Matter compressor Mk3' }],
                             [0.2,  { kind:'item', id:'powerManagementComputer', name:'Power management computer' }]],
};

function _rollLoot(rnd, planetKind) {
  const table = LOOT_TABLES[planetKind] ?? LOOT_TABLES[PlanetKinds.Rocky];
  const roll = rnd();
  let cumulative = 0;
  for (const [weight, loot] of table) {
    cumulative += weight;
    if (roll < cumulative) return [{ ...loot }];
  }
  return [{ ...table[table.length - 1][1] }];
}

// Returns spawn position and inward velocity angle for arriving via the tunnel from `fromId`
function computeEntryPosition(systemId, fromId) {
  const planets = universe[systemId].planets;
  const outermost = Math.max(...planets.map(p => p.distance + p.radius));
  const tunnelDist = outermost * 2;
  const rnd = seededRnd(systemId * 997 + fromId);
  const angle = rnd() * Math.PI * 2;
  // Arrive 5× TUNNEL_RADIUS inward from the tunnel so the jump check doesn't re-fire
  const arrivalDist = tunnelDist - TUNNEL_RADIUS * 5;
  return {
    x: Math.cos(angle) * arrivalDist,
    y: Math.sin(angle) * arrivalDist,
    inwardAngle: angle + Math.PI, // direction pointing toward the system centre
  };
}

class Scene {
  constructor() {}
}

// TODO: this will go with a separate "HUD"
const niceDistance = (dist) => {
  if (dist < 1000) {
    return String(Math.round(dist));
  }
  if (dist < 1000000) {
    return (dist / 1000).toFixed(2) + "k";
  }
  return (dist / 1000000).toFixed(2) + "M";
};

const logg = document.getElementById("logg");
const log = (f) => {
  logg.innerHTML = f;
};

const linScale = (
  scale,
  props = { minScale: 1e-5, maxScale: 1, minOutput: 0.5, maxOutput: 1 },
) => {
  const { minScale, maxScale, minOutput, maxOutput } = props;

  // Clamp the scale factor to the valid range
  const clampedScale = Math.max(minScale, Math.min(maxScale, scale));

  // Perform linear interpolation
  const output =
    maxOutput +
    ((clampedScale - maxScale) * (minOutput - maxOutput)) /
      (minScale - maxScale);

  return output;
};

const MAXSCALE = 0.2;
const TORUS_WARP_SPEED = 5000;    // world units/sec while in torus
const TORUS_SPEED_SQ  = 100 * 100; // engage threshold: 100 m/s
const TORUS_HOLD_SQ   =  60 *  60; // disengage below this (hysteresis)
const TORUS_DROP_DIST = 200000;    // drop out within this distance of target
const TORUS_ENEMY_DIST = 150000;   // drop out if an enemy is this close

class SpaceScene extends Scene {
  constructor(props = {}) {
    super();
    this.controller = props.controller; // This is required
    this.pendingJump = null; // set to { destId, fromId } when player enters a tunnel
    this.player = props.player; // This is required
    this.app = props.app; // This is required, but likely I don't want it in super (non-pixi scenes)
    this.systemId = props.id; // This will very likely be required

    // Ordering is important:
    // - Background:
    //     - Nebula
    //     - Starfield/dustfield
    // - Viewframe
    //     - Player
    //     - Planets / other stuff
    this.starfield = new Starfield({
      width: this.app.renderer.width,
      height: this.app.renderer.height,
    });
    this.starfield.generate(this.app);
    this.starfield.attach(this.app);

    this.viewframe = new Viewframe();

    this.renderedSystem = new RenderedSystem({
      id: this.systemId,
      app: this.app,
      viewframe: this.viewframe,
    });
    this.renderedSystem.attachNebula();

    this.viewframe.attach(this.app);
    this.viewframe.scale = MAXSCALE;
    this.renderedSystem.attachPlanets();
    this.player.attach(this.viewframe);

    this.starfield.viewframe = this.viewframe; // TODO Trying to see if I can shift with this

    this.viewframe.pos.x =
      ((-1 / this.viewframe.scale) * this.app.screen.width) / 2;
    this.viewframe.pos.y =
      ((-1 / this.viewframe.scale) * this.app.screen.height) / 2;

    this.player.viewframe = this.viewframe; // Linking to have zoom
    this.viewframe.vel = this.player.vel;

    this.warpTunnels = this._buildWarpTunnels();
    this.warpTunnels.forEach(t => { t.generate(this.app); t.attach(this.viewframe); });
    this.station = this._buildStation();
    if (this.station) {
      this.station.generate(this.app);
      this.station.attach(this.viewframe);
    }
    this.objectList = [
      ...this.renderedSystem.planetObjects,
      ...this.warpTunnels,
      ...(this.station ? [this.station] : []),
    ];
    this.waypoints = this.objectList;
    this.bulletList = props.bulletList;
    this.flameList = props.flameList;
    this.otherShips = [];
    this.debrisList = [];
    this.wrecks     = [];
    this.wantedLevel   = 0;
    this.pendingDock   = false;
    this.pendingCrash  = false;
    this._wasDocking   = false;
    this._wasColliding = false;
    this._dockedAt     = null;
    this._spawnSecurityShips();
    this._spawnTraderShips();
    this._spawnWrecks();
    this._planetNames = this._buildPlanetNames();
    this.cameraPos = { x: this.player.pos.x, y: this.player.pos.y };
    this.torusDrive = false;
    this.minimap = new Minimap({
      player: this.player,
      renderedSystem: this.renderedSystem,
      warpTunnels: this.warpTunnels,
      station: this.station,
    });
    this.comms = new CommsSystem();
  }
  _buildWarpTunnels() {
    const sysId = this.renderedSystem.id;
    const outermost = Math.max(
      ...this.renderedSystem.planets.map(p => p.distance + p.radius)
    );
    // Place tunnels at 2× the outermost planet distance so torus drive is needed
    const tunnelDist = outermost * 2;
    return Object.keys(universe[sysId].neighbors).map(nid => {
      const destId = parseInt(nid);
      const rnd = seededRnd(sysId * 997 + destId);
      const angle = rnd() * Math.PI * 2;
      return new WarpTunnel({
        pos: { x: Math.cos(angle) * tunnelDist, y: Math.sin(angle) * tunnelDist },
        destinationId: destId,
        destinationName: universe[destId].name,
        systemId: sysId,
      });
    });
  }

  _buildStation() {
    const earthLike = this.renderedSystem.planetObjects.find(
      p => p.kind === PlanetKinds.EarthLike
    );
    if (!earthLike) return null;
    const planetRadius = earthLike.p?.radius ?? earthLike.meshes[0]?.radius ?? 20000;
    const a = Math.atan2(earthLike.pos.y, earthLike.pos.x);
    const perpAngle = a + Math.PI / 2;
    return new Station({
      pos: {
        x: earthLike.pos.x + Math.cos(perpAngle) * planetRadius * 1.5,
        y: earthLike.pos.y + Math.sin(perpAngle) * planetRadius * 1.5,
      },
      planetRadius,
      name: `${this.renderedSystem.name} Station`,
    });
  }

  _spawnSecurityShips() {
    if (!this.station) return;
    const dist = this.renderedSystem.shipDistribution;
    const policeCount   = Math.min(2, dist.police ?? 0);
    const militaryCount = Math.min(1, Math.floor((dist.military ?? 0) / 4));
    const factions = [
      ...Array(policeCount).fill('police'),
      ...Array(militaryCount).fill('military'),
    ];
    if (factions.length === 0) return;
    const patrolRadius = this.station.planetRadius * 2;
    const homePos = this.station.pos;
    factions.forEach((faction, i) => {
      const angle = (i / factions.length) * Math.PI * 2;
      const isMilitary = faction === 'military';
      const photonAmmo  = isMilitary ? 30 : 20;
      const hull        = isMilitary ? 8000 : 5000;

      const ship = new Lynx({
        pos: {
          x: homePos.x + Math.cos(angle) * patrolRadius,
          y: homePos.y + Math.sin(angle) * patrolRadius,
        },
        vel: { x: 0, y: 0 },
        r: angle + Math.PI / 2,
        e: hull,
      });

      const massDriver = new MassDriverGun({ pos: { x: 30, y: 0 }, source: ship._id });
      const photon     = new PhotonTorpedoLauncher({ pos: { x: 0, y: 0 }, source: ship._id });
      photon.ammoMax   = photonAmmo;
      ship.weapons     = [massDriver, photon];
      ship._initAmmo(ship.weapons);
      ship.npcState     = 'patrol';
      ship.npcRole      = 'security';
      ship.faction      = faction;
      ship.homePos      = homePos;
      ship.patrolRadius = patrolRadius;
      ship.orbitAngle   = angle;
      ship.orbitSpeed   = 0.0003;
      ship.generate(this.app);
      ship.attach(this.viewframe);
      this.otherShips.push(ship);
    });
  }

  _spawnTraderShips() {
    if (!this.station || this.warpTunnels.length === 0) return;
    const dist  = this.renderedSystem.shipDistribution;
    const count = Math.min(3, Math.floor((dist[ShipTypes.TRADER] ?? 0) / 4));
    if (count === 0) return;

    const stationPos = this.station.pos;
    const STATION_R  = this.station.radius;

    for (let i = 0; i < count; i++) {
      const roll   = Math.random();
      const tunnel = this.warpTunnels[Math.floor(Math.random() * this.warpTunnels.length)];
      const name   = generateShipName();
      let ship, npcState, traderDest, traderArrivalRange, spawnPos, spawnAngle;

      if (roll < 0.4) {
        // Arriving: spawn at tunnel, head to station
        npcState          = 'arriving';
        traderDest        = { ...stationPos };
        traderArrivalRange = STATION_R * 2.5;
        const offset      = (Math.random() - 0.5) * tunnel.radius * 1.5;
        const perp        = Math.atan2(tunnel.pos.y, tunnel.pos.x) + Math.PI / 2;
        spawnPos = {
          x: tunnel.pos.x + Math.cos(perp) * offset,
          y: tunnel.pos.y + Math.sin(perp) * offset,
        };
        spawnAngle = Math.atan2(stationPos.y - spawnPos.y, stationPos.x - spawnPos.x);
      } else if (roll < 0.8) {
        // Departing: spawn near station, head to tunnel
        npcState          = 'departing';
        traderDest        = { ...tunnel.pos };
        traderArrivalRange = tunnel.radius * 3;
        const angle       = Math.random() * Math.PI * 2;
        spawnPos = {
          x: stationPos.x + Math.cos(angle) * STATION_R * 3,
          y: stationPos.y + Math.sin(angle) * STATION_R * 3,
        };
        spawnAngle = Math.atan2(tunnel.pos.y - spawnPos.y, tunnel.pos.x - spawnPos.x);
      } else {
        // Idle: drift near station between random nearby waypoints
        npcState          = 'idle';
        traderArrivalRange = STATION_R * 0.8;
        const angle       = Math.random() * Math.PI * 2;
        spawnPos = {
          x: stationPos.x + Math.cos(angle) * STATION_R * (2 + Math.random()),
          y: stationPos.y + Math.sin(angle) * STATION_R * (2 + Math.random()),
        };
        spawnAngle = angle + Math.PI / 2;
        const destAngle = Math.random() * Math.PI * 2;
        traderDest = {
          x: stationPos.x + Math.cos(destAngle) * STATION_R * (1.5 + Math.random() * 1.5),
          y: stationPos.y + Math.sin(destAngle) * STATION_R * (1.5 + Math.random() * 1.5),
        };
      }

      ship = new Bobcat({ pos: spawnPos, vel: { x: 0, y: 0 }, r: spawnAngle });
      ship.npcState          = npcState;
      ship.npcRole           = 'trader';
      ship.faction           = 'merchant';
      ship.traderName        = name;
      ship.traderDest        = traderDest;
      ship.traderArrivalRange = traderArrivalRange;
      ship.traderArrived     = false;
      ship.traderTunnel      = npcState !== 'idle' ? tunnel : null;
      ship.generate(this.app);
      ship.attach(this.viewframe);
      this.otherShips.push(ship);

      // Comms broadcast staggered so they don't all fire at once
      const delay = i * 1200 + Math.random() * 600;
      if (npcState === 'arriving') {
        const from = tunnel.destinationId !== undefined
          ? universe[tunnel.destinationId]?.name ?? 'deep space'
          : 'deep space';
        setTimeout(() => this.comms?.trader(name, `inbound from ${from}, requesting clearance`), delay);
      } else if (npcState === 'departing') {
        const to = tunnel.destinationId !== undefined
          ? universe[tunnel.destinationId]?.name ?? 'deep space'
          : 'deep space';
        setTimeout(() => this.comms?.trader(name, `departing for ${to}`), delay);
      }
    }
  }

  _spawnWrecks() {
    const planets = this.renderedSystem.planetObjects;
    planets.forEach((planet, idx) => {
      if (planet.pos.x === 0 && planet.pos.y === 0) return; // skip sun
      const rnd = seededRnd(this.systemId * 3001 + idx * 97);
      if (rnd() > 0.4) return; // 40% chance of a wreck per planet
      const wrecksHere = 1 + (rnd() < 0.25 ? 1 : 0); // 25% chance of a second wreck
      for (let w = 0; w < wrecksHere; w++) {
        const angle  = rnd() * Math.PI * 2;
        const dist   = (planet.radius ?? 2000) * (2.5 + rnd() * 2);
        const pos    = {
          x: planet.pos.x + Math.cos(angle) * dist,
          y: planet.pos.y + Math.sin(angle) * dist,
        };
        const loot = _rollLoot(rnd, planet.kind);
        const wreck = new Wreck({ pos, loot });
        wreck._playerRef = this.player;
        wreck.generate(this.app);
        wreck.attach(this.viewframe);
        this.wrecks.push(wreck);
      }
    });
  }

  _onScoop(loot) {
    for (const item of loot) {
      if (item.kind === 'ammo') {
        const current = this.player.ammo[item.weapon] ?? { count: 0, max: 0 };
        current.count = (current.count ?? 0) + item.count;
        current.max   = Math.max(current.max ?? 0, current.count);
        this.player.ammo[item.weapon] = current;
        this.comms?.system(`Scooped: ${item.count} × ${item.weapon.replace('k','').replace(/([A-Z])/g, ' $1').trim()}`);
      } else if (item.kind === 'credits') {
        this.player.credits = (this.player.credits ?? 0) + item.count;
        this.comms?.system(`Scooped: ${item.count} credits`);
      } else if (item.kind === 'item') {
        this.player.cargo = this.player.cargo ?? [];
        this.player.cargo.push({ id: item.id, name: item.name });
        this.comms?.system(`Scooped: ${item.name}`);
      }
    }
  }

  _alertNearbySecurityFor(victim) {
    const ALERT_RANGE = 30_000; // respond to incidents within sensor range of the crime scene
    for (const ship of this.otherShips) {
      if (ship.npcRole !== 'security') continue;
      if (ship.npcState === 'chase') continue;
      const dx = ship.pos.x - victim.pos.x;  // proximity to the attacked ship, not the player
      const dy = ship.pos.y - victim.pos.y;
      if (dx * dx + dy * dy < ALERT_RANGE * ALERT_RANGE) {
        ship.npcState    = 'chase';
        ship.chaseTarget = this.player;
        this.comms?.system(`${ship.faction === 'military' ? 'Military' : 'Police'} ship responding`);
      }
    }
  }

  _buildPlanetNames() {
    const roman = ["I", "II", "III", "IV", "V", "VI", "VII", "VIII"];
    const sysName = this.renderedSystem.name;
    const earthLikes = this.renderedSystem.planets
      .filter((p) => p.kind === PlanetKinds.EarthLike)
      .sort((a, b) => a.idx - b.idx);
    const names = new Map();
    earthLikes.forEach((p, rank) => {
      names.set(p.idx, earthLikes.length === 1
        ? `${sysName} Prime`
        : `${sysName} ${roman[rank]}`);
    });
    return names;
  }

  // TODO: will need a destructor for all the created objects
  update(delta) {
    const nv = sqnorm(this.player.vel.x, this.player.vel.y);
    this.starfield.update(this.player.vel);

    this.viewframe.move(delta.deltaTime);
    this.viewframe.update();
    const visualNv = this.torusDrive ? TORUS_WARP_SPEED * TORUS_WARP_SPEED : nv;
    // Zoom-out knee: sqrt(constant/MAXSCALE - 1) ≈ 50 m/s at 500, ~22 m/s at 100
    const rawSpeedScale = Math.min(MAXSCALE, 500 / (visualNv + 1));
    this.starfield.starContainer.scale = linScale(rawSpeedScale);
    this.starfield.dustContainer.scale = linScale(rawSpeedScale);
    if (this.renderedSystem.nebulaSprite) {
      this.renderedSystem.nebulaSprite.scale = linScale(rawSpeedScale);
    }
    //if(nv > 1){
    //if (scale < 1e-10) {
    //  scale = 1e-10;
    // This should have a faster option at some point?
    //}
    const target = {
      pos: {
        x: this.player.pos.x - 800,
        y: this.player.pos.y,
      },
      vel: {
        x: this.player.vel.x,
        y: this.player.vel.y,
      },
    };
    for (let otherShip of this.otherShips) {
      if (otherShip.npcRole === 'trader') {
        if (otherShip.npcState === 'arriving' || otherShip.npcState === 'departing') {
          traderControl(otherShip, delta.deltaTime);
        }
      } else if (otherShip.npcState) {
        npcControl(otherShip, delta.deltaTime, this.player);
      } else if (otherShip.action() === "kChase") {
        otherControl(
          otherShip,
          this.player,
          target,
          delta.deltaTime,
          this.player.bulletList,
        );
      }
      otherShip.update(delta);
    }
    const W = this.app.screen.width;
    const H = this.app.screen.height;

    // Zoom: speed-driven, independent of camera tracking.
    const speedScale = linScale(rawSpeedScale, {
      minScale: 1e-15,
      maxScale: MAXSCALE,
      minOutput: 1e-2,
      maxOutput: MAXSCALE,
    });
    const zoomT = 1 - speedScale / MAXSCALE; // 0 = slow, 1 = fast
    let scale = MAXSCALE + (speedScale - MAXSCALE) * zoomT;

    // Proximity zoom: zoom out smoothly when close to the station so it doesn't fill the screen.
    if (this.station) {
      const psdx = this.player.pos.x - this.station.pos.x;
      const psdy = this.player.pos.y - this.station.pos.y;
      const psDist = Math.sqrt(psdx * psdx + psdy * psdy);
      const PROX_RANGE  = APPROACH_RANGE;        // start zooming at approach range
      const PROX_SCALE  = MAXSCALE * 0.18;       // target scale when right at station
      if (psDist < PROX_RANGE) {
        const pt = 1 - psDist / PROX_RANGE;      // 0 = at range edge, 1 = at station center
        const smoothPt = pt * pt * (3 - 2 * pt);
        const proximityScale = MAXSCALE * (1 - smoothPt) + PROX_SCALE * smoothPt;
        scale = Math.min(scale, proximityScale);  // take whichever is more zoomed out
      }
    }

    // Planet/sun proximity zoom: zoom out proportionally to body size when nearby.
    // The sun uses a tighter range multiplier — its radius is so large that * 5 would
    // cover the entire inner system and keep the player permanently zoomed out.
    for (const body of this.renderedSystem.planetObjects) {
      const bodyRadius = body.meshes[0].radius;
      const isSun = body.pos.x === 0 && body.pos.y === 0;
      const pdx = this.player.pos.x - body.pos.x;
      const pdy = this.player.pos.y - body.pos.y;
      const pDist = Math.sqrt(pdx * pdx + pdy * pdy);
      const BODY_PROX_RANGE = bodyRadius * (isSun ? 1.5 : 5);
      const BODY_PROX_SCALE = Math.min(MAXSCALE, W / (4 * bodyRadius));
      if (pDist < BODY_PROX_RANGE) {
        const pt = Math.max(0, 1 - pDist / BODY_PROX_RANGE);
        const smoothPt = pt * pt * (3 - 2 * pt);
        const proximityScale = MAXSCALE * (1 - smoothPt) + BODY_PROX_SCALE * smoothPt;
        scale = Math.min(scale, proximityScale);
      }
    }
    // Wreck proximity zoom: gently recover toward MAXSCALE when close to a resolved wreck.
    // Blends between current scale and MAXSCALE — doesn't fight planet zoom-out, just
    // partially counteracts it. Target is scale*2 capped at MAXSCALE, not a fixed value,
    // so the recovery is proportional to how zoomed out you already are.
    for (const wreck of this.wrecks) {
      const wdx = this.player.pos.x - wreck.pos.x;
      const wdy = this.player.pos.y - wreck.pos.y;
      const wDistSq = wdx * wdx + wdy * wdy;
      if (wDistSq > SCAN_RANGE * SCAN_RANGE) continue; // not resolved yet
      const wDist = Math.sqrt(wDistSq);
      const WRECK_PROX_RANGE = HALO_RADIUS;
      if (wDist < WRECK_PROX_RANGE) {
        const pt = 1 - wDist / WRECK_PROX_RANGE;
        const smoothPt = pt * pt * (3 - 2 * pt);
        const target = Math.min(MAXSCALE, Math.max(scale * 4, MAXSCALE * 0.4));
        const proximityScale = scale * (1 - smoothPt) + target * smoothPt;
        scale = Math.max(scale, proximityScale);
      }
    }

    // Ship proximity zoom: zoom in when close to any ship so ships near planets/
    // stations remain visible and interactive.  Counteracts body zoom-out.
    const SHIP_PROX_RANGE = 12000;
    for (const ship of this.otherShips) {
      const shdx = this.player.pos.x - ship.pos.x;
      const shdy = this.player.pos.y - ship.pos.y;
      const shDist = Math.sqrt(shdx * shdx + shdy * shdy);
      if (shDist < SHIP_PROX_RANGE) {
        const pt = 1 - shDist / SHIP_PROX_RANGE;
        const smoothPt = pt * pt * (3 - 2 * pt);
        const proximityScale = scale + (MAXSCALE - scale) * smoothPt;
        scale = Math.max(scale, proximityScale);
      }
    }

    // Camera tracking: dead zone shrinks and follow strength grows with speed.
    // Below CAM_LOW_SPEED: full dead zone (PULL_BASE of viewport), gentle pull at border.
    // CAM_LOW_SPEED→CAM_HIGH_SPEED: dead zone shrinks to zero, follow tightens.
    // Torus: lock to player.
    const CAM_LOW_SPEED  = 35;
    const CAM_HIGH_SPEED = 100;
    const PULL_BASE      = 0.80; // dead zone radius at low speed (inner 80%)
    const FOLLOW_LOW     = 0.03; // gentle pull at low speed, border
    const FOLLOW_HIGH    = 0.25; // tight pull just before torus

    if (this.torusDrive) {
      this.cameraPos.x = this.player.pos.x;
      this.cameraPos.y = this.player.pos.y;
    } else {
      const speed = Math.sqrt(nv);
      const speedSf   = Math.max(0, Math.min(1, (speed - CAM_LOW_SPEED) / (CAM_HIGH_SPEED - CAM_LOW_SPEED)));
      const zoomSf    = Math.max(0, 1 - scale / MAXSCALE); // 0=full zoom, 1=zoomed out
      const sf        = Math.max(speedSf, zoomSf);
      const deadRadius = PULL_BASE * (1 - sf);

      // norm: where the player sits on screen relative to center (0=center, 1=edge)
      const offsetX = (this.player.pos.x - this.cameraPos.x) * scale;
      const offsetY = (this.player.pos.y - this.cameraPos.y) * scale;
      const norm = Math.min(1, Math.max(
        Math.abs(offsetX) / (W / 2),
        Math.abs(offsetY) / (H / 2),
      ));

      if (norm > deadRadius) {
        const pullRange = Math.max(0.001, 1 - deadRadius);
        const t = (norm - deadRadius) / pullRange;
        const smoothT = t * t * (3 - 2 * t);
        const maxFollow = FOLLOW_LOW + sf * (FOLLOW_HIGH - FOLLOW_LOW);
        const followRate = smoothT * maxFollow;
        this.cameraPos.x += (this.player.pos.x - this.cameraPos.x) * followRate;
        this.cameraPos.y += (this.player.pos.y - this.cameraPos.y) * followRate;
      }
    }

    this.viewframe.scale = scale;
    this.viewframe.pos.x = this.cameraPos.x - (W / 2) / scale;
    this.viewframe.pos.y = this.cameraPos.y - (H / 2) / scale;
    let hudTarget = { targetName: null, targetColor: null, targetDist: null, targetPos: null, isWarpTunnel: false };
    let bestDiff = 1e-4; // threshold: cos(angle+r)-1 squared must beat this
    for (let pl of this.waypoints) {
      const dx    = pl.pos.x - this.player.pos.x;
      const dy    = pl.pos.y - this.player.pos.y;
      const angle = -Math.atan2(dy, dx);
      const diff  = Math.cos(angle + this.player.r) - 1;
      const diffSq = diff * diff;

      if (diffSq < bestDiff) {
        bestDiff = diffSq;
        const name = (pl.kind === "kWarpTunnel" || pl.kind === "kStation")
          ? pl.name
          : pl.kind === PlanetKinds.Sun
            ? pl.name
            : pl.kind === PlanetKinds.EarthLike
              ? (this._planetNames.get(pl.p.idx) ?? pl.kind.slice(1))
              : pl.kind.slice(1);
        const dist = Math.sqrt(dx * dx + dy * dy);
        hudTarget = {
          targetName: name,
          targetColor: pl.averagedColor,
          targetDist: niceDistance(dist),
          targetPos: { x: pl.pos.x, y: pl.pos.y },
          isWarpTunnel: pl.kind === "kWarpTunnel",
        };
      }
    }
    // Torus drive: engage when aimed at a target, moving fast, AND velocity
    // is aligned with the direction to the target (not just pointing at it).
    const torusThreshold = this.torusDrive ? TORUS_HOLD_SQ : TORUS_SPEED_SQ;
    let torusActive = hudTarget.targetPos !== null && nv >= torusThreshold;
    if (torusActive) {
      const tdx = hudTarget.targetPos.x - this.player.pos.x;
      const tdy = hudTarget.targetPos.y - this.player.pos.y;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (!hudTarget.isWarpTunnel && dist < TORUS_DROP_DIST) {
        torusActive = false;
      } else {
        // Velocity must be pointing within ~30° of the target direction
        const speed = Math.sqrt(nv);
        const velDot = (this.player.vel.x * tdx + this.player.vel.y * tdy) / (speed * dist);
        if (velDot < 0.97) torusActive = false; // cos(15°) ≈ 0.97
      }
    }
    if (torusActive) {
      for (const ship of this.otherShips) {
        if (ship.e < 0) continue;
        const sdx = ship.pos.x - this.player.pos.x;
        const sdy = ship.pos.y - this.player.pos.y;
        if (sdx * sdx + sdy * sdy < TORUS_ENEMY_DIST * TORUS_ENEMY_DIST) {
          torusActive = false;
          break;
        }
      }
    }
    this.torusDrive = torusActive;

    const velAngle = nv > 1 ? Math.atan2(this.player.vel.y, this.player.vel.x) : null;

    // Station docking and collision
    let dockPrompt = null;
    if (this.station) {
      if (this.station.collides(this.player)) {
        if (!this._wasColliding) {
          this.pendingCrash  = true;
          this._wasColliding = true;
        }
      } else {
        this._wasColliding = false;
        const ds      = this.station.dockStatus(this.player);
        // DEBUG — remove once docking feels right
        if (ds === 'approach' || ds === 'dock') {
          const bx  = this.station.pos.x + Math.cos(this.station.dockAngle) * this.station.radius;
          const by  = this.station.pos.y + Math.sin(this.station.dockAngle) * this.station.radius;
          const bdx = this.player.pos.x - bx, bdy = this.player.pos.y - by;
          log(`bay dist: ${Math.round(Math.sqrt(bdx*bdx+bdy*bdy))}  status: ${ds}`);
        }
        const isDock  = ds === 'dock';
        if (isDock) {
          if (!this._wasDocking) {
            this.pendingDock = true;
            this._dockedAt   = performance.now();
          }
          dockPrompt = 'dock';
        } else if (ds === 'approach') {
          dockPrompt = 'approach';
        }
        this._wasDocking = isDock;
      }
    }

    const dockedFlash = this._dockedAt && (performance.now() - this._dockedAt) < 3000;
    const playerScreenX = (this.player.pos.x - this.cameraPos.x) * scale;
    const playerScreenY = (this.player.pos.y - this.cameraPos.y) * scale;
    this.minimap.setHUD({
      ...hudTarget,
      speed: Math.sqrt(nv).toFixed(1),
      torus: this.torusDrive,
      velAngle,
      shipAngle: this.player.r,
      dockPrompt,
      dockedFlash,
      zoomRatio: scale / MAXSCALE,
      playerScreenX,
      playerScreenY,
    });

    //viewframe.scale = nv > 0.2 ? 0.2 * 10000 /nv : 0.2
    this.objectList.map((p) => p.update(delta));
    this.controller();

    this.player.update(delta);

    // Warp displacement: added on top of normal physics during torus
    if (this.torusDrive && hudTarget.targetPos) {
      const tdx = hudTarget.targetPos.x - this.player.pos.x;
      const tdy = hudTarget.targetPos.y - this.player.pos.y;
      const dist = Math.sqrt(tdx * tdx + tdy * tdy);
      if (dist > 0) {
        const move = TORUS_WARP_SPEED * delta.deltaTime;
        this.player.pos.x += (tdx / dist) * move;
        this.player.pos.y += (tdy / dist) * move;
      }
    }

    // Jump trigger: entering a warp tunnel's event horizon
    for (const tunnel of this.warpTunnels) {
      const jdx = tunnel.pos.x - this.player.pos.x;
      const jdy = tunnel.pos.y - this.player.pos.y;
      if (jdx * jdx + jdy * jdy < TUNNEL_RADIUS * TUNNEL_RADIUS) {
        this.pendingJump = { destId: tunnel.destinationId, fromId: this.renderedSystem.id };
        return;
      }
    }

    for (let flammable of [this.player, ...this.otherShips]) {
      // Remove destroyed flames (in-place)
      for (let i = flammable.flameList.length - 1; i >= 0; i--) {
        if (flammable.flameList[i].presentation?.destroyed) {
          flammable.flameList.splice(i, 1);
        }
      }

      // Remove destroyed bullets (in-place)
      for (let i = flammable.bulletList.length - 1; i >= 0; i--) {
        if (flammable.bulletList[i].presentation?.destroyed) {
          flammable.bulletList.splice(i, 1);
        }
      }

      // Render and update bullets; run collision checks
      for (let b of flammable.bulletList) {
        if (!b.drawn) {
          b.generate();
          b.attach(this.viewframe);
        }
        b.update(delta);

        if (b.e <= 0.01) {
          b.e = -1;
          continue;
        }

        // Player hit by enemy bullets
        if (this.player.e > 0 && b.source !== this.player._id) {
          if (this.player.collision(b) === 1) {
            settings.shake?.onHit(this.app);
            const pe = this.player.e;
            this.player.e -= b.e;
            b.e -= pe;
            const bnv = sqnorm(b.vel.x, b.vel.y) + 0.01;
            const pnv = sqnorm(this.player.vel.x, this.player.vel.y) + 0.01;
            for (let i = 0; i < settings.explosions.player.hitFlame.count; i++) {
              const fl = new Flame({
                pos: { x: b.pos.x, y: b.pos.y },
                vel: {
                  x: (250 * b.vel.x) / bnv - (0.4 * this.player.vel.x) / pnv,
                  y: (250 * b.vel.y) / bnv - (0.4 * this.player.vel.y) / pnv,
                },
                r: 0,
                e: 12,
                scale: settings.explosions.player.flame.scale?.() ?? 1,
              });
              this.player.flameList.push(fl);
            }
            if (this.player.e < 0) {
              this.player.e = -1;
              const debris = this.player.explode({
                e: Math.abs(this.player.e) + 1,
                vel: {
                  x: (2 * b.vel.x) / bnv - (0.4 * this.player.vel.x) / pnv,
                  y: (2 * b.vel.y) / bnv - (0.4 * this.player.vel.y) / pnv,
                },
              });
              if (debris) this.debrisList.push(debris);
            }
          }
        }

        // Other ships hit by any bullet not from themselves
        for (let o of this.otherShips) {
          if (o.e < 0) continue;
          if (b.source === o._id) continue;
          const collisioning = o.collision(b);
          if (collisioning === 1) {
            o.showHit = performance.now() + settings.showHitMs;
            o.lastAttacker = b.source;
            o.lastHitTime  = performance.now();
            const oe = o.e;
            if (b.kind === "kMissile") {
              o.e -= b.e;
              b.e = -1;
              b.explode?.();
            } else {
              o.e -= b.e;
              b.e -= oe;
            }
            if (b.source === this.player._id) {
              this._alertNearbySecurityFor(o);
            }
            const bnv = sqnorm(b.vel.x, b.vel.y) + 0.01;
            const onv = sqnorm(o.vel.x, o.vel.y) + 0.01;
            for (let i = 0; i < settings.explosions.ships.hitFlame.count; i++) {
              const fl = new Flame({
                pos: { x: b.pos.x, y: b.pos.y },
                vel: {
                  x: (290 * b.vel.x) / bnv - (0.3 * o.vel.x) / onv,
                  y: (290 * b.vel.y) / bnv - (0.3 * o.vel.y) / onv,
                },
                fill: 0xff0000,
                r: 0,
                e: 12,
                scale: settings.explosions.ships.flame.scale?.() ?? 1,
              });
              this.player.flameList.push(fl);
            }
            if (o.e < 0) {
              if (b.source === this.player._id) {
                this.wantedLevel = Math.min(5, this.wantedLevel + 1);
              }
              const debris = o.explode({
                e: Math.abs(o.e) + 1,
                vel: {
                  x: (2 * b.vel.x) / bnv - (0.4 * o.vel.x) / onv,
                  y: (2 * b.vel.y) / bnv - (0.4 * o.vel.y) / onv,
                },
              });
              if (debris) this.debrisList.push(debris);
              o.e = -1;
            }
          }
        }
      }

      // Render and update flames
      for (let f of flammable.flameList) {
        if (!f.drawn) {
          f.generate();
          f.attach(this.viewframe);
        }
        f.update(delta);
      }
    }

    // Remove dead or arrived ships
    for (let i = this.otherShips.length - 1; i >= 0; i--) {
      const ship = this.otherShips[i];
      if (ship.traderArrived) {
        if (ship.npcState === 'idle') {
          // Pick a new random waypoint near the station and keep drifting
          const stPos  = this.station?.pos ?? { x: 0, y: 0 };
          const stR    = this.station?.radius ?? 2000;
          const angle  = Math.random() * Math.PI * 2;
          ship.traderDest = {
            x: stPos.x + Math.cos(angle) * stR * (1.5 + Math.random() * 1.5),
            y: stPos.y + Math.sin(angle) * stR * (1.5 + Math.random() * 1.5),
          };
          ship.traderArrived = false;
          continue;
        }
        // Arriving/departing trader reached its destination — quietly despawn
        for (const p of (ship.presentations ?? [])) p?.parent?.removeChild(p);
        this.otherShips.splice(i, 1);
        continue;
      }
      if (ship.e < 0) {
        if (ship.npcRole === 'trader') {
          // Economy impact: one fewer trader in this system
          const sys = universe[this.systemId];
          if (sys?.shipDistribution) {
            sys.shipDistribution[ShipTypes.TRADER] =
              Math.max(0, (sys.shipDistribution[ShipTypes.TRADER] ?? 1) - 1);
          }
          this.comms?.trader(ship.traderName ?? 'UNKNOWN', 'MAYDAY — under attack');
        }
        for (const p of (ship.presentations ?? [])) p?.parent?.removeChild(p);
        this.otherShips.splice(i, 1);
      }
    }

    // Render and update debris
    for (let i = this.debrisList.length - 1; i >= 0; i--) {
      const d = this.debrisList[i];
      if (d.destroyed) {
        this.debrisList.splice(i, 1);
        continue;
      }
      if (!d.generated) {
        d.generate();
        d.viewframe = this.viewframe;
        for (let p of d.presentations) {
          this.viewframe.presentation.addChild(p);
        }
      }
      d.update(delta);
    }

    // Update wrecks + scoop check
    const px = this.player.pos.x;
    const py = this.player.pos.y;
    for (let i = this.wrecks.length - 1; i >= 0; i--) {
      const wreck = this.wrecks[i];
      if (wreck.scooped) { this.wrecks.splice(i, 1); continue; }
      wreck.update(delta);
      const dx = wreck.pos.x - px;
      const dy = wreck.pos.y - py;
      if (dx * dx + dy * dy < SCOOP_RANGE * SCOOP_RANGE) {
        wreck.despawn();
        this.wrecks.splice(i, 1);
        this._onScoop(wreck.loot);
      }
    }

    this.renderedSystem.update(delta);
    this.minimap.setOtherShips(this.otherShips);
    this.minimap.setWrecks(this.wrecks);
    this.minimap.update();
    this.comms.update();
  }

  destroy() {
    this.minimap.destroy();
    this.comms.destroy();
    // Detach the reused player from the viewframe before destroying the scene tree,
    // otherwise destroy({ children: true }) would nuke the player's PIXI objects.
    for (const p of (this.player.presentations ?? [])) {
      p?.parent?.removeChild(p);
    }
    this.starfield.dustContainer?.destroy({ children: true });
    this.starfield.starContainer?.destroy({ children: true });
    this.viewframe.presentation?.destroy({ children: true });
    this.renderedSystem.nebulaSprite?.destroy();
  }
}
