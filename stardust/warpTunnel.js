export { WarpTunnel, TUNNEL_RADIUS };

import { Graphics, Container } from "../libs/3rdparty/pixi.mjs";
import { seededRnd } from "./rnd.js";

// Visual event-horizon radius in world units — smaller than the smallest planet (~10k)
const TUNNEL_RADIUS = 5000;

class WarpTunnel {
  constructor(props) {
    this.pos = { x: props.pos.x, y: props.pos.y };
    this.vel = { x: 0, y: 0 };
    this.e = Infinity;
    this.destinationId = props.destinationId;
    this.name = `→ ${props.destinationName}`;
    this.kind = "kWarpTunnel";
    this.averagedColor = 0xff8822;
    this.radius = TUNNEL_RADIUS;

    // Stable per-tunnel appearance derived from system + destination ids
    const rnd = seededRnd(props.systemId * 997 + props.destinationId + 313);
    this._diskTilt = 0.18 + rnd() * 0.12;
    this._diskRotSpeed = (0.4 + rnd() * 0.4) * (rnd() < 0.5 ? 1 : -1);
    this._diskAngle = rnd() * Math.PI * 2;
  }

  generate(_app) {
    const R = TUNNEL_RADIUS;
    const t = this._diskTilt;

    this._root = new Container();
    this._diskLayer = new Container();

    // Faint outer gravitational haze
    const glow = new Graphics();
    glow.ellipse(0, 0, R * 5, R * 5 * t * 1.4);
    glow.fill({ color: 0x110022, alpha: 0.4 });
    this._diskLayer.addChild(glow);

    // Accretion disk rings, outermost first so inner ones paint over
    for (const { r, color, alpha } of [
      { r: 4.0, color: 0x330000, alpha: 0.30 },
      { r: 3.4, color: 0x771100, alpha: 0.40 },
      { r: 2.8, color: 0xcc4400, alpha: 0.52 },
      { r: 2.3, color: 0xff7700, alpha: 0.65 },
      { r: 1.9, color: 0xffaa44, alpha: 0.75 },
      { r: 1.6, color: 0xffdd88, alpha: 0.85 },
      { r: 1.4, color: 0xffffff, alpha: 0.55 },
    ]) {
      const g = new Graphics();
      g.ellipse(0, 0, R * r, R * r * t);
      g.fill({ color, alpha });
      this._diskLayer.addChild(g);
    }

    this._root.addChild(this._diskLayer);

    // Static layer on top: event horizon + photon ring (don't spin with disk)
    const staticLayer = new Container();

    const horizon = new Graphics();
    horizon.circle(0, 0, R);
    horizon.fill(0x000000);
    staticLayer.addChild(horizon);

    // Photon ring — thin bright ellipse at ~1.22R
    const photonRing = new Graphics();
    photonRing.ellipse(0, 0, R * 1.22, R * 1.22 * t);
    photonRing.stroke({ color: 0xffeedd, width: R * 0.055, alpha: 0.95 });
    staticLayer.addChild(photonRing);

    // Blue-shifted inner edge glow
    const innerGlow = new Graphics();
    innerGlow.circle(0, 0, R * 1.05);
    innerGlow.stroke({ color: 0x8888ff, width: R * 0.04, alpha: 0.5 });
    staticLayer.addChild(innerGlow);

    this._root.addChild(staticLayer);
    this.presentations = [this._root];
    this.generated = true;
  }

  attach(viewframe) {
    viewframe.presentation.addChild(this._root);
    this.viewframe = viewframe;
    this.drawn = true;
  }

  update(delta) {
    this._diskAngle += this._diskRotSpeed * (delta?.deltaTime ?? 1) * 0.003;
    this._diskLayer.rotation = this._diskAngle;
    this._root.x = this.pos.x - this.viewframe.pos.x;
    this._root.y = this.pos.y - this.viewframe.pos.y;
  }
}
