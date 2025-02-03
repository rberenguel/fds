export { Starfield }

import {
  Graphics, Sprite, RenderTexture, Matrix
} from "../libs/3rdparty/pixi.mjs";

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
  if(r > 255){
    r = 255
  }
  if(b > 255){
    b = 255
  }
  if(g > 255){
    g = 255
  }



  return (r << 16) + (g << 8) + b; // Convert to hex
}

class Starfield {
  constructor(props={}){
    this.width = 2*(props.width ?? 800)
    this.height = 2*(props.height ?? 600)
    this.dStarfield = props.dStarfield ?? 20000
    this.dDustfield = props.dDustfield ?? 40000
    this.starfieldPts = []
    this.dustfieldPts = []
    for (let i = 0; i < this.width; i++) {
      for (let j = 0; j < this.height; j++) {
        const n = Math.random();
        const f = Math.floor(n * this.dStarfield);
        const ff = Math.floor(n * this.dDustfield)
        if (f == 1 || f == 42 || (f > 90 && f < 100)) {
          let rh = Math.floor(Math.random() * 360); // Random number between 0 and 359
          let rs = Math.floor(Math.random() * 20); // Random number between 0 and 19
          let rv = Math.floor(Math.random() * 52); // Random number between 0 and 51

          let h = rh; // Hue: 0.0 to 1.0
          let s = (10 + rs)
          let v = (50 + rv)

          let r = Math.random() < 0.3 ? 2 : 1;
          this.starfieldPts.push(
            {
              x: i, 
              y: j, 
              r: r, 
              c: hsvToHex(h, s, v) 
            }
          )
        }
        if (ff == 1 || ff == 42 || (ff > 90 && ff < 100)) {
          let rh = Math.floor(Math.random() * 360); // Random number between 0 and 359
          let rs = Math.floor(Math.random() * 20); // Random number between 0 and 19
          let rv = Math.floor(Math.random() * 52); // Random number between 0 and 51

          let h = rh; // Hue: 0.0 to 1.0
          let s = (10 + rs)
          let v = (50 + rv)

          this.dustfieldPts.push(
            {
              x: i, 
              y: j, 
              r: 1, 
              c: hsvToHex(h, s, v) 
            }
          )
        }
      }
    }

  }
  generate(){
    let starfield = new Graphics();
    let dustfield = new Graphics()
    starfield.width = this.width
    starfield.height = this.height 
    dustfield.width = this.width
    dustfield.height = this.height 
    for(const pt of this.starfieldPts){
      const {x, y, r, c} = pt
      starfield.circle(x, y, r)
      starfield.fill(c)
    }
    for(const pt of this.dustfieldPts){
      const {x, y, r, c} = pt
      dustfield.circle(x, y, r)
      dustfield.fill(c)
    }
    this.starfield = starfield
    this.dustfield=dustfield
    // Generate textures from the Graphics objects
  }

  attach(app){
    //app.stage.addChild(this.starfield)
    //app.stage.addChild(this.dustfield)
    //this.starfieldTexture = app.renderer.generateTexture(this.starfieldGraphics);
    //this.dustfieldTexture = app.renderer.generateTexture(this.dustfieldGraphics);
    const starfieldTexture = RenderTexture.create({
      width: this.width*2,
      height: this.height*2,
      resolution: 1
      //multisample: MSAA_QUALITY.HIGH,
      //resolution: window.devicePixelRatio
    });
    // With the existing renderer, render texture
    // make sure to apply a transform Matrix
    app.renderer.render(this.starfield, {
      starfieldTexture,
      clear: true
      //transform: new Matrix(1, 0, 0, 1, 1, 1)//this.width / 2, this.height / 2)
    });

    // Required for MSAA, WebGL 2 only
    //(app.renderer as Renderer).framebuffer.blit();

    // Discard the original Graphics
    //this.starfield.destroy(true);

    // Create sprites from the textures
    this.starfieldSprite = new Sprite(starfieldTexture);
    //this.dustfieldSprite = new Sprite(this.dustfieldTexture);

    // Initial position of the sprites (centered)
    this.starfieldSprite.x = -this.width / 2;
    this.starfieldSprite.y = -this.height / 2;
    app.stage.addChild(this.starfieldSprite)
    //app.stage.addChild(this.starfield)
    //this.dustfieldSprite.x = -this.width / 2;
    //this.dustfieldSprite.y = -this.height / 2

  }

}



