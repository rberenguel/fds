export { Wreck, SCOOP_RANGE, SCAN_RANGE, HALO_RADIUS };

import { Graphics } from "../libs/3rdparty/pixi.mjs";
import { Base1 } from "./base.js";

const SCOOP_RANGE = 500;   // world units — fly within this to scoop
const SCAN_RANGE  = 40000; // minimap: unresolved ? → resolved × transition

const HALO_RADIUS  = 4000; // world units — large enough to see from planet proximity
const HALO_SPEED   = 0.003; // pulse rate

class Wreck extends Base1 {
  constructor(props = {}) {
    super({ ...props, vel: { x: 0, y: 0 } });
    this.loot      = props.loot ?? [];
    this.scooped   = false;
    this._rotation = 0;
    this._rotSpeed = (0.003 + Math.random() * 0.004) * (Math.random() < 0.5 ? 1 : -1);
    this._time     = Math.random() * Math.PI * 2; // stagger pulse phase
  }

  generate(app) {
    if (this.generated) return;

    // Pulsing halo — large world-space ring visible when zoomed out
    const halo = new Graphics();
    halo.circle(0, 0, HALO_RADIUS);
    halo.stroke({ color: 0xffaa33, width: 80 });
    halo._isHalo = true;

    // Diamond marker — visible when close up
    const diamond = new Graphics();
    const r = 200;
    diamond.moveTo(0, -r);
    diamond.lineTo(r * 0.6, -r * 0.4);
    diamond.lineTo(r, 0);
    diamond.lineTo(r * 0.6, r * 0.4);
    diamond.lineTo(0, r);
    diamond.lineTo(-r * 0.6, r * 0.4);
    diamond.lineTo(-r, 0);
    diamond.lineTo(-r * 0.6, -r * 0.4);
    diamond.closePath();
    diamond.stroke({ color: 0xffaa33, width: 40 });

    this.presentations = [halo, diamond];
    this.generated = true;
  }

  attach(viewframe) {
    this.viewframe = viewframe;
    for (const p of this.presentations) {
      viewframe.presentation.addChild(p);
    }
  }

  update(delta) {
    if (this.scooped) return;
    this._time     += HALO_SPEED * delta.deltaTime;
    this._rotation += this._rotSpeed * delta.deltaTime;

    const sx = this.pos.x - this.viewframe.pos.x;
    const sy = this.pos.y - this.viewframe.pos.y;
    const playerX = this._playerRef ? this._playerRef.pos.x : this.viewframe.pos.x;
    const playerY = this._playerRef ? this._playerRef.pos.y : this.viewframe.pos.y;
    const distSq  = (this.pos.x - playerX) ** 2 + (this.pos.y - playerY) ** 2;
    const visible = distSq < SCAN_RANGE * SCAN_RANGE;

    const pulse = 0.3 + 0.25 * Math.sin(this._time);

    for (const p of (this.presentations ?? [])) {
      if (!p || p.destroyed) continue;
      p.x       = sx;
      p.y       = sy;
      p.visible = visible;
      if (p._isHalo) {
        p.alpha    = pulse;
        p.rotation = this._time * 0.1;
      } else {
        p.rotation = this._rotation;
      }
    }
  }

  despawn() {
    for (const p of (this.presentations ?? [])) {
      p?.parent?.removeChild(p);
    }
    this.scooped = true;
  }
}
