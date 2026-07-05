export { Station, STATION_RADIUS, APPROACH_RANGE };

import { Graphics, Container } from "../libs/3rdparty/pixi.mjs";

const STATION_RADIUS  = 2000;
const APPROACH_RANGE  = 40000;  // world units: show name/dist in HUD
const DOCK_BAY_RANGE  = STATION_RADIUS * 0.1; // max distance from bay entrance to trigger
const DOCK_MAX_SPEED  = 5;      // m/s — approach slowly or it counts as a crash
const DOCK_CONE_COS   = Math.cos(Math.PI / 8); // 22.5° half-angle — bay must be facing player
const ROT_SPEED       = 0.0015; // rad/frame — full rotation ≈ 70 s at 60fps
const BAY_OFFSET      = Math.PI / 8; // bay face centre is at this angle from vertex 0 (N=8)

class Station {
  constructor(props) {
    this.pos          = { ...props.pos };
    this.planetRadius = props.planetRadius; // for patrol orbit sizing
    this._rotation    = props.startAngle ?? 0;
    this.radius       = STATION_RADIUS;
    this.kind         = "kStation";
    this.name         = props.name ?? "Station";
    this.averagedColor = [0.5, 0.65, 0.9];
    this.e            = Infinity;
  }

  get dockAngle() { return this._rotation + BAY_OFFSET; }

  get dockPos() {
    const a = this._rotation + BAY_OFFSET;
    return {
      x: this.pos.x + Math.cos(a) * this.radius,
      y: this.pos.y + Math.sin(a) * this.radius,
    };
  }

  // Returns null | 'approach' | 'dock'
  dockStatus(player) {
    const sdx  = player.pos.x - this.pos.x;
    const sdy  = player.pos.y - this.pos.y;
    const distToCenter = Math.sqrt(sdx * sdx + sdy * sdy);
    if (distToCenter > APPROACH_RANGE) return null;

    // Bay entrance world position
    const bx  = this.pos.x + Math.cos(this._rotation + BAY_OFFSET) * this.radius;
    const by  = this.pos.y + Math.sin(this._rotation + BAY_OFFSET) * this.radius;
    const bdx = player.pos.x - bx;
    const bdy = player.pos.y - by;
    const distToBay = Math.sqrt(bdx * bdx + bdy * bdy);

    // Bay outward normal — must be facing the player from station center
    const nx  = Math.cos(this._rotation + BAY_OFFSET);
    const ny  = Math.sin(this._rotation + BAY_OFFSET);
    const dot = distToCenter > 0.001 ? (sdx * nx + sdy * ny) / distToCenter : 0;

    const speed   = Math.sqrt(player.vel.x ** 2 + player.vel.y ** 2);
    const outside = distToCenter > this.radius * 0.95;

    if (outside && distToBay < DOCK_BAY_RANGE && dot > DOCK_CONE_COS && speed < DOCK_MAX_SPEED) {
      return 'dock';
    }
    return 'approach';
  }

  // True if player has physically collided with the hull
  collides(player) {
    const dx = player.pos.x - this.pos.x;
    const dy = player.pos.y - this.pos.y;
    return dx * dx + dy * dy < this.radius * this.radius * 0.9 * 0.9;
  }

  generate(_app) {
    const R = this.radius;
    const N = 8;
    this._root = new Container();

    const pts = (r) => {
      const arr = [];
      for (let i = 0; i < N; i++) {
        const a = (i / N) * Math.PI * 2;
        arr.push(Math.cos(a) * r, Math.sin(a) * r);
      }
      return arr;
    };

    // Outer ring face — dark fill to occlude space behind the ring
    const outerFill = new Graphics();
    outerFill.poly(pts(R), true).fill({ color: 0x111a2e, alpha: 0.95 });
    this._root.addChild(outerFill);

    // Inner hole — black fills the interior, leaving a ring band visible
    const innerHole = new Graphics();
    innerHole.poly(pts(R * 0.68), true).fill({ color: 0x000000, alpha: 1 });
    this._root.addChild(innerHole);

    // Outer edge stroke
    const outerEdge = new Graphics();
    outerEdge.poly(pts(R), true).stroke({ color: 0x5577aa, width: R * 0.07, alpha: 0.9 });
    this._root.addChild(outerEdge);

    // Inner edge stroke
    const innerEdge = new Graphics();
    innerEdge.poly(pts(R * 0.68), true).stroke({ color: 0x334466, width: R * 0.04, alpha: 0.8 });
    this._root.addChild(innerEdge);

    // Spokes at every other vertex (skipping vertex 0 so bay face stays clear)
    const spokes = new Graphics();
    for (let i = 1; i < N; i += 2) {
      const a = (i / N) * Math.PI * 2;
      spokes.moveTo(Math.cos(a) * R * 0.68, Math.sin(a) * R * 0.68);
      spokes.lineTo(Math.cos(a) * R * 0.18, Math.sin(a) * R * 0.18);
    }
    spokes.stroke({ color: 0x334466, width: R * 0.035 });
    this._root.addChild(spokes);

    // Hub
    const hub = new Graphics();
    hub.circle(0, 0, R * 0.18).fill({ color: 0x1a2a44 });
    hub.circle(0, 0, R * 0.18).stroke({ color: 0x5577aa, width: R * 0.04 });
    this._root.addChild(hub);

    // Docking bay — face between vertex 0 and vertex 1 (local angle 0)
    const a0 = 0;
    const a1 = (1 / N) * Math.PI * 2;
    const amid = (a0 + a1) / 2;

    // Bay face fill (trapezoidal band between outer and inner ring at segment 0)
    const bayFill = new Graphics();
    bayFill.poly([
      Math.cos(a0) * R,        Math.sin(a0) * R,
      Math.cos(a1) * R,        Math.sin(a1) * R,
      Math.cos(a1) * R * 0.68, Math.sin(a1) * R * 0.68,
      Math.cos(a0) * R * 0.68, Math.sin(a0) * R * 0.68,
    ], true).fill({ color: 0x003322, alpha: 0.95 });
    this._root.addChild(bayFill);

    // Bay outer edge highlight
    const bayEdge = new Graphics();
    bayEdge.moveTo(Math.cos(a0) * R, Math.sin(a0) * R);
    bayEdge.lineTo(Math.cos(a1) * R, Math.sin(a1) * R);
    bayEdge.stroke({ color: 0x00ffcc, width: R * 0.1 });
    this._root.addChild(bayEdge);

    // Bay frame lines on sides
    const bayFrame = new Graphics();
    bayFrame.moveTo(Math.cos(a0) * R * 0.68, Math.sin(a0) * R * 0.68);
    bayFrame.lineTo(Math.cos(a0) * R,        Math.sin(a0) * R);
    bayFrame.moveTo(Math.cos(a1) * R * 0.68, Math.sin(a1) * R * 0.68);
    bayFrame.lineTo(Math.cos(a1) * R,        Math.sin(a1) * R);
    bayFrame.stroke({ color: 0x00ffcc, width: R * 0.04, alpha: 0.7 });
    this._root.addChild(bayFrame);

    // Pulsing beacon at bay midpoint (mid-ring radius)
    this._beacon = new Graphics();
    const br = (R + R * 0.68) / 2;
    this._beacon.circle(Math.cos(amid) * br, Math.sin(amid) * br, R * 0.06);
    this._beacon.fill({ color: 0x00ffcc });
    this._root.addChild(this._beacon);

    this.presentations = [this._root];
    this.generated = true;
  }

  attach(viewframe) {
    viewframe.presentation.addChild(this._root);
    this.viewframe = viewframe;
    this.drawn = true;
  }

  update(delta) {
    this._rotation += ROT_SPEED * (delta?.deltaTime ?? 1);
    this._root.rotation = this._rotation;
    this._root.x = this.pos.x - this.viewframe.pos.x;
    this._root.y = this.pos.y - this.viewframe.pos.y;

    // Pulse beacon
    this._beacon.alpha = 0.4 + 0.6 * Math.abs(Math.sin(performance.now() / 600));
  }
}
