export { Starfield };

import {
  Graphics,
  Container,
  Sprite,
  RenderTexture,
  Matrix,
} from "../libs/3rdparty/pixi.mjs";

import { sqnorm, wrap } from "./math.js";

function hsvToHex(h, s, v) {
  // h = 0-360, s = 0-100, v = 0-100
  let r, g, b, i, f, p, q, t;
  h /= 360;
  s /= 100;
  v /= 100;

  i = Math.floor(h * 6);
  f = h * 6 - i;
  p = v * (1 - s);
  q = v * (1 - f * s);
  t = v * (1 - (1 - f) * s);

  switch (i % 6) {
    case 0:
      r = v;
      g = t;
      b = p;
      break;
    case 1:
      r = q;
      g = v;
      b = p;
      break;
    case 2:
      r = p;
      g = v;
      b = t;
      break;
    case 3:
      r = p;
      g = q;
      b = v;
      break;
    case 4:
      r = t;
      g = p;
      b = v;
      break;
    case 5:
      r = v;
      g = p;
      b = q;
      break;
  }

  r = Math.round(r * 255);
  g = Math.round(g * 255);
  b = Math.round(b * 255);
  if (r > 255) {
    r = 255;
  }
  if (b > 255) {
    b = 255;
  }
  if (g > 255) {
    g = 255;
  }

  return (r << 16) + (g << 8) + b; // Convert to hex
}

class Starfield {
  static dustfieldParallaxFactor = 0.05;
  static starfieldParallaxFactor = 0.005;

  constructor(props = {}) {
    this.width = 2 * (props.width ?? 800);
    this.height = 2 * (props.height ?? 600);
    this.dStarfield = props.dStarfield ?? 20000;
    this.dDustfield = props.dDustfield ?? 80000;
    this.starfieldPts = [];
    this.dustfieldPts = [];
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        const n = Math.random();
        const f = Math.floor(n * this.dStarfield);
        const ff = Math.floor(n * this.dDustfield);
        if (f == 1 || f == 42 || (f > 90 && f < 100)) {
          let rh = Math.floor(Math.random() * 360); // Random number between 0 and 359
          let rs = Math.floor(Math.random() * 20); // Random number between 0 and 19
          let rv = Math.floor(Math.random() * 52); // Random number between 0 and 51

          let h = rh; // Hue: 0.0 to 1.0
          let s = 10 + rs;
          let v = 50 + rv;

          let r = Math.random() < 0.3 ? 2 : 1;
          this.starfieldPts.push({
            x: i,
            y: j,
            r: r,
            c: hsvToHex(h, s, v),
          });
        }
        if (ff == 1 || ff == 42 || (ff > 90 && ff < 100)) {
          let rh = Math.floor(Math.random() * 360); // Random number between 0 and 359
          let rs = Math.floor(Math.random() * 5); // Random number between 0 and 19
          let rv = Math.floor(Math.random() * 20); // Random number between 0 and 51

          let h = rh; // Hue: 0.0 to 1.0
          let s = 10 + rs;
          let v = 50 + rv;

          this.dustfieldPts.push({
            x: i,
            y: j,
            r: 1,
            c: hsvToHex(h, s, v),
          });
        }
      }
    }
  }
  generate(app) {
    let star = new Graphics();
    star.circle(0, 0, 3);
    star.fill(0xffffff);
    const starTexture = RenderTexture.create({
      width: 5,
      height: 5,
      resolution: 1,
    });
    app.renderer.render({ container: star, target: starTexture, clear: true });
    star.destroy(true);
    star = null;

    /*let starfield = new Graphics();
    let dustfield = new Graphics()
    starfield.width = this.width
    starfield.height = this.height 
    dustfield.width = this.width
    dustfield.height = this.height */
    this.stars = [];
    for (const pt of this.starfieldPts) {
      const { x, y, r, c } = pt;
      const star = new Sprite(starTexture);
      star.tint = c;
      star.x = x;
      star.y = y;
      star.scale = r;
      this.stars.push(star);
    }
    this.dust = [];
    for (const pt of this.dustfieldPts) {
      const { x, y, r, c } = pt;
      const dust = new Sprite(starTexture);
      dust.tint = c;
      dust.x = x;
      dust.y = y;
      this.dust.push(dust);
    }
    /*
    for(const pt of this.dustfieldPts){
      console.log(pt)
      const {x, y, r, c} = pt
      dustfield.circle(x, y, 4)
      dustfield.fill(c)
    }
    this.starfield = starfield
    this.dustfield=dustfield*/
    // Generate textures from the Graphics objects
  }

  attach(app) {
    this.app = app;
    const starContainer = new Container();
    const dustContainer = new Container();
    starContainer.pivot.x = this.width / 2;
    starContainer.pivot.y = this.height / 2;
    starContainer.x = this.width / 4;
    starContainer.y = this.height / 4;
    starContainer.width = this.width;
    starContainer.height = this.height;
    app.stage.addChild(dustContainer);
    app.stage.addChild(starContainer);
    starContainer.addChild(...this.stars);
    dustContainer.addChild(...this.dust);
    this.starContainer = starContainer;
    this.dustContainer = dustContainer;
  }

  update(vel) {
    const angle = Math.atan2(vel.y, vel.x);
    const nv = sqnorm(vel.x, vel.y);
    const maxSkew = (0.9 * Math.PI) / 2;
    const maxMagnitude = 100; // Adjust this based on your velocity range
    const skew = Math.min(nv / maxMagnitude, 1) * maxSkew;
    for (const star of this.stars) {
      star.x -= (vel.x ?? 0) * Starfield.starfieldParallaxFactor;
      star.y -= (vel.y ?? 0) * Starfield.starfieldParallaxFactor;
      wrap(star, { w: this.width, h: this.height });
      star.skew.x = skew / 2;
      star.scale = 1 + skew / (nv + 1);
      star.rotation = angle;
    }
    for (const dust of this.dust) {
      dust.x -= (vel.x ?? 0) * Starfield.dustfieldParallaxFactor;
      dust.y -= (vel.y ?? 0) * Starfield.dustfieldParallaxFactor;
      wrap(dust, { w: this.width, h: this.height });
      dust.skew.x = skew;
      dust.scale = 1 + skew;
      dust.rotation = angle;
    }
  }
}
