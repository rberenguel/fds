export { Gun };

import { Flame } from "../flame.js";
import { settings } from "../../roids2/settings.js";
import { rotate } from "../math.js";

class Gun {
  constructor(props) {
    // Still need to find out how to change the angle for spreads.
    this.pos = {
      x: props.pos?.x ?? 0,
      y: props.pos?.y ?? 0,
    };
    this.source = props.source ?? -1;
    this.color = props.color ?? 0xffcc00;
  }

  fire(shooter, bulletList) {
    if (shooter.human) {
      shooter.stats.shots[this.kind].fired++;
    }
    // Muzzle fire
    const [rpx, rpy] = rotate(this.pos.x, this.pos.y, shooter.r);
    for (let i = 0; i < settings.fire.muzzle.minCount(this); i++) {
      const m = 2 * Math.random();
      const a = Math.random() * 2 * Math.PI;
      const fl = new Flame({
        pos: {
          x: rpx + shooter.pos.x,
          y: rpy + shooter.pos.y,
        },
        vel: {
          x: m * Math.cos(a) + shooter.vel.x,
          y: m * Math.sin(a) + shooter.vel.y,
        },
        fill: settings.fire.muzzle.fill(this),
        r: 0,
        e: settings.fire.muzzle.energy(this),
        scale: settings.fire.muzzle.scale(this),
      });
      shooter.flameList.push(fl);
    }
  }
}
