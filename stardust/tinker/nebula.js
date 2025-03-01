export { NebulaGenerator };

import {
  Graphics,
  Sprite,
  RenderTexture,
  Texture,
  Matrix,
} from "../../libs/3rdparty/pixi.mjs";

// TODO add seeded random and options based on seeding the index

//import p5 from '../libs/3rdparty/p5.min.js';
class NebulaGenerator {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.p5Instance = null; // To store the p5 instance
    this.nebulaTexture = null; // To store the PixiJS texture

    // Create a new p5 instance
    this.createP5Instance();
  }

  createP5Instance() {
    // Create a new p5 instance in instance mode
    this.p5Instance = new p5((p) => {
      // Your nebula drawing logic (adapted for instance mode)
      const nebula = (pg, width = 100) => {
        let t = 0;
        pg.translate(0, -100);
        const baseRad = width + 2 * width * Math.random();
        const xshift = 2 * width + 4 * width * Math.random();
        while (t < 100 + 50 * Math.random()) {
          pg.beginShape();
          for (let i = 0; i < 100; i++) {
            const h = 360 * Math.random();
            const s = 70 + 20 * pg.noise(i * i);
            const v = 50;
            const c = pg.color(h, s, v, 0.1);
            pg.stroke(c);
            const ang = pg.map(i, 0, 200, 0, pg.PI);
            const rad =
              baseRad * pg.cos(ang) +
              baseRad +
              xshift * pg.noise(i * 0.05, t * 0.005, pg.sin(ang) * 2);

            // Exaggerated vertical stretch
            const y = rad * pg.sin(ang) * 3; // Stretch vertically
            const x = (rad - y / 4) * pg.cos(ang) * pg.cos(ang);

            pg.curveVertex(x, y);
          }
          pg.endShape();

          t += 1;
        }
      };

      p.setup = () => {
        let renderer = p.createCanvas(this.width, this.height);
        p.colorMode(p.HSL);
        p.noFill();
        p.noLoop();

        // Draw nebula to the p5 canvas
        nebula(p, 200);

        nebula(p, 100);
        // Create a PixiJS texture from the p5 canvas
        this.nebulaTexture = Texture.from(renderer.canvas);
      };
    });
  }
}
