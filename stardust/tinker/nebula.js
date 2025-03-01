export { NebulaGenerator };

import {
  Graphics,
  Sprite,
  RenderTexture,
  Texture,
  Matrix,
} from "../../libs/3rdparty/pixi.mjs";

import { seededRnd } from "../rnd.js";

//import p5 from '../libs/3rdparty/p5.min.js';
class NebulaGenerator {
  constructor(props = {}) {
    this.width = props.width;
    this.height = props.height;
    this.seed = props.id;
    this.rnd = seededRnd(props.id + 92);
    this.p5Instance = null; // To store the p5 instance
    this.nebulaTexture = null; // To store the PixiJS texture

    // Create a new p5 instance
    this.createP5Instance();
  }

  static WIDTH = 300;
  static HEIGHT = 200;

  createP5Instance() {
    // Create a new p5 instance in instance mode
    this.p5Instance = new p5((p) => {
      // Your nebula drawing logic (adapted for instance mode)
      const nebula = (pg, width = 100) => {
        let t = 0;
        pg.translate(0.5 * width, -0.25 * width);
        pg.noiseSeed(this.seed);
        const baseRad = 0.5 * width + width * this.rnd();
        const xshift = width + 4 * width * this.rnd();
        while (t < NebulaGenerator.WIDTH) {
          pg.beginShape();
          for (let i = 0; i < NebulaGenerator.HEIGHT; i++) {
            const h = 360 * this.rnd();
            const s = 70 + 20 * pg.noise(i);
            const v = 50;
            const c = pg.color(h, s, v, 0.1);
            pg.stroke(c);
            const ang = pg.map(i, 0, 200, 0, pg.PI);
            const rad = //baseRad*Math.cos(ang)+baseRad*pg.noise(0.5*i/NebulaGenerator.HEIGHT, t/NebulaGenerator.WIDTH)
              baseRad * pg.cos(ang) +
              baseRad * pg.noise(i / NebulaGenerator.HEIGHT) +
              xshift *
                pg.noise(
                  i / NebulaGenerator.HEIGHT,
                  t / NebulaGenerator.WIDTH,
                  Math.sin(ang) * 2,
                );

            // Exaggerated vertical stretch
            const y = rad * pg.sin(ang) * 3; // Stretch vertically
            const x = (rad - 0.8 * y) * Math.cos(ang) * Math.cos(ang);

            pg.curveVertex(x, y);
          }
          pg.endShape();

          t += 1;
        }
      };

      p.setup = () => {
        let renderer = p.createCanvas(this.width, this.height);
        renderer.hide();
        p.colorMode(p.HSL);
        p.noFill();
        p.noLoop();

        // Draw nebula to the p5 canvas
        nebula(p, 0.25 * this.width);

        //nebula(p, 100);
        // Create a PixiJS texture from the p5 canvas
        this.nebulaTexture = Texture.from(renderer.canvas);
      };
    });
  }
}
