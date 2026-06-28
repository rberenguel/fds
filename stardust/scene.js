export { Scene, SpaceScene, computeEntryPosition };

import { Viewframe } from "./viewframe.js";
import { Starfield } from "./parallax.js";
import { RenderedSystem } from "./tinker/renderedSystem.js";
import { sqnorm } from "./math.js";
import { PlanetKinds } from "./tinker/system.js";
import { otherControl } from "./pid.js";
import { npcControl } from "./npc.js";
import { Lynx } from "./base/lynx.js";
import { Flame } from "./flame.js";
import { settings } from "../roids2/settings.js";
import { Debris } from "./base/debris.js";
import { Minimap } from "./minimap.js";
import { WarpTunnel, TUNNEL_RADIUS } from "./warpTunnel.js";
import { universe } from "./tinker/universe.js";
import { seededRnd } from "./rnd.js";
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
    this.objectList = [...this.renderedSystem.planetObjects, ...this.warpTunnels];
    this.waypoints = this.objectList;
    this.bulletList = props.bulletList;
    this.flameList = props.flameList;
    this.otherShips = [];
    this.debrisList = [];
    this.station = this._buildStation();
    this._spawnSecurityShips();
    this._planetNames = this._buildPlanetNames();
    this.cameraPos = { x: this.player.pos.x, y: this.player.pos.y };
    this.torusDrive = false;
    this.minimap = new Minimap({
      player: this.player,
      renderedSystem: this.renderedSystem,
      warpTunnels: this.warpTunnels,
    });
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
    // Place station perpendicular to the planet's orbital direction (L4-ish offset)
    const a = Math.atan2(earthLike.pos.y, earthLike.pos.x);
    const perpAngle = a + Math.PI / 2;
    return {
      pos: {
        x: earthLike.pos.x + Math.cos(perpAngle) * planetRadius * 1.5,
        y: earthLike.pos.y + Math.sin(perpAngle) * planetRadius * 1.5,
      },
      planetRadius,
    };
  }

  _spawnSecurityShips() {
    if (!this.station) return;
    const dist = this.renderedSystem.shipDistribution;
    const count = Math.min(3, (dist.police ?? 0) + Math.floor((dist.military ?? 0) / 4));
    if (count === 0) return;
    const patrolRadius = this.station.planetRadius * 2;
    const homePos = this.station.pos;
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2;
      const ship = new Lynx({
        pos: {
          x: homePos.x + Math.cos(angle) * patrolRadius,
          y: homePos.y + Math.sin(angle) * patrolRadius,
        },
        vel: { x: 0, y: 0 },
        r: angle + Math.PI / 2, // face tangent to orbit initially
      });
      ship.npcState    = 'patrol';
      ship.homePos     = homePos;
      ship.patrolRadius = patrolRadius;
      ship.orbitAngle  = angle;
      ship.orbitSpeed  = 0.0003; // rad/deltaTime; full circle ≈ 20k frames ≈ 5 min at 60fps
      ship.generate(this.app);
      ship.attach(this.viewframe);
      this.otherShips.push(ship);
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
      if (otherShip.npcState) {
        npcControl(otherShip, delta.deltaTime);
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
    // Elastic dead-zone camera: player moves freely in the inner 3/5 of screen;
    // the 1/5 border region pulls the camera and triggers zoom-out.
    const W = this.app.screen.width;
    const H = this.app.screen.height;
    const MARGIN = 0.02;

    const speedScale = linScale(rawSpeedScale, {
      minScale: 1e-15,
      maxScale: MAXSCALE,
      minOutput: 1e-2,
      maxOutput: MAXSCALE,
    });

    // Where would the player appear at max scale given current camera?
    const screenX = (this.player.pos.x - this.cameraPos.x) * MAXSCALE + W / 2;
    const screenY = (this.player.pos.y - this.cameraPos.y) * MAXSCALE + H / 2;

    // How far into the border zone (0 = safe, 1 = at screen edge)?
    const excessX = Math.max(0, (Math.abs(screenX - W / 2) - (0.5 - MARGIN) * W) / (MARGIN * W));
    const excessY = Math.max(0, (Math.abs(screenY - H / 2) - (0.5 - MARGIN) * H) / (MARGIN * H));
    const excess = Math.min(1, Math.max(excessX, excessY));

    // At warp speed the dead-zone melts away and camera locks to player;
    // at low speed it's elastic (0.12 at border, 0 at centre).
    const warpFactor = 1 - speedScale / MAXSCALE; // 0 = stationary, 1 = max speed
    const followRate = warpFactor + (1 - warpFactor) * excess * 0.12;
    this.cameraPos.x += (this.player.pos.x - this.cameraPos.x) * followRate;
    this.cameraPos.y += (this.player.pos.y - this.cameraPos.y) * followRate;

    const scale = MAXSCALE + (speedScale - MAXSCALE) * Math.max(excess, warpFactor);

    this.viewframe.scale = scale;
    this.viewframe.pos.x = this.cameraPos.x - (W / 2) / scale;
    this.viewframe.pos.y = this.cameraPos.y - (H / 2) / scale;
    let hudTarget = { targetName: null, targetColor: null, targetDist: null, targetPos: null, isWarpTunnel: false };
    for (let pl of this.waypoints) {
      const dx = pl.pos.x - this.player.pos.x;
      const dy = pl.pos.y - this.player.pos.y;
      const angle = -Math.atan2(dy, dx);
      const diff = Math.cos(angle + this.player.r) - 1;

      if (diff * diff < 1e-4) {
        const name = pl.kind === "kWarpTunnel"
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
        break;
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
    this.minimap.setHUD({
      ...hudTarget,
      speed: Math.sqrt(nv).toFixed(1),
      torus: this.torusDrive,
      velAngle,
      shipAngle: this.player.r,
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
            const oe = o.e;
            if (b.kind === "kMissile") {
              o.e -= b.e;
              b.e = -1;
              b.explode?.();
            } else {
              o.e -= b.e;
              b.e -= oe;
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

    // Remove dead other ships
    for (let i = this.otherShips.length - 1; i >= 0; i--) {
      if (this.otherShips[i].e < 0) {
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

    this.renderedSystem.update(delta);
    this.minimap.setOtherShips(this.otherShips);
    this.minimap.update();
  }

  destroy() {
    this.minimap.destroy();
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
