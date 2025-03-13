export { Base1 };

import {
  Graphics,
  Assets,
  Mesh,
  Shader,
  Geometry,
  RenderTexture,
  Container,
  Sprite,
} from "../libs/3rdparty/pixi.mjs";

import { Meshes } from "./mesh.js";

/*
const giantTexture = (app, size) =>
  RenderTexture.create({
    width: size,
    height: size,
    resolution: 1,
  });

const renderGiant = async (app) => {
  const fragment = await Assets.load({
    src: "./custom.frg",
    loadParser: "loadTxt",
  });
  const vertex = await Assets.load({
    src: "./custom.vrt",
    loadParser: "loadTxt",
  });

  const shader = Shader.from({
    gl: {
      vertex,
      fragment,
    },
    resources: {
      shaderToyUniforms: {
        iResolution: { value: [1000, 1000, 1], type: "vec3<f32>" },
        iTime: { value: 1, type: "f32" },
        uTextureOffset: { value: [0, 0, 0], type: "vec2<f32>" },
        uTextureScale: { value: 1, type: "f32" },
      },
    },
  });

  const quadGeometry = new Geometry({
    attributes: {
      aPosition: [
        -250,
        -250, // x, y
        250,
        -250, // x, y
        250,
        250, // x, y,
        -250,
        250, // x, y,
      ],
      //aUV: [0, 0, 1, 0, 1, 1, 0, 1],
    },
    indexBuffer: [0, 1, 2, 0, 3, 2],
  });


  let quad = new Mesh({
    geometry: quadGeometry,
    shader,
  });
  quad.i_shader = shader;

  const size = Math.max(app.screen.width, app.screen.height);
  quad.width = size;
  quad.height = size;
  quad.x = size / 2;
  quad.y = size / 2;

  //app.stage.addChild(quad);
  const _texture = giantTexture(app, size);
  app.renderer.render({ container: quad, target: _texture, clear: true });
  quad.sprite = new Sprite(_texture);
  quad.sprite._size = size;
  return quad;
};
*/
class Base1 {
  constructor(props) {
    this.pos = {
      x: props?.pos?.x ?? 0,
      y: props?.pos?.y ?? 0,
    };
    this.vel = {
      x: props?.vel?.x ?? 0,
      y: props?.vel?.y ?? 0,
    };
    this.r = props?.r ?? 0;
    this.e = props?.e ?? 0;
    this.mass = props?.mass ?? 1;
    this.meshes = props?.meshes;
  }

  generate() {
    let p = new Graphics();
    for (const mesh of this.meshes) {
      if (mesh.kind === Meshes.kPoly) {
        p.poly(mesh.flatten());
        if (mesh.fill !== undefined) {
          p.fill(mesh.fill);
        }
        if (mesh.width) {
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
      }
      if (mesh.kind === Meshes.kCircle) {
        p.circle(mesh.center[0], mesh.center[1], mesh.radius);
        if (mesh.width) {
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
        if (mesh.fill !== undefined) {
          p.fill(mesh.fill);
        }
      }
      /*if (mesh.kind === Meshes.kPlanet) {
        let q = new Graphics();
        p.circle(mesh.center[0], mesh.center[1], mesh.radius);
        q.circle(mesh.center[0], mesh.center[1], mesh.radius);
        if (mesh.width) {
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
          q.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
        if (mesh.fill !== undefined) {
          p.fill(mesh.fill);
          q.fill(mesh.fill);
        }
        let c = new Container();
        let cc = new Container();
        cc.mask = p;
        cc.addChild(p);
        cc.addChild(q);
        cc.addChild(mesh.texture.sprite);
        c.addChild(cc);
        cc.planetTexture = true;
        const rad = mesh.radius;
        mesh.texture.sprite.anchor.x = 0.5;
        mesh.texture.sprite.anchor.y = 0.5;
        mesh.texture.sprite.x = mesh.center[0];
        mesh.texture.sprite.y = mesh.center[1];
        // Scale ideally is proportional to size (max of height and width) and adjusted for planet radius…
        mesh.texture.sprite.scale =
          (2 * mesh.radius) / mesh.texture.sprite._size;
        this.generated = true;
        this.presentations = [cc];
        return;
      }*/
    }
    this.presentations = [p];
    this.generated = true;
  }

  attach(viewframe) {
    for (const presentation of this.presentations) {
      viewframe.presentation.addChild(presentation);
    }

    this.viewframe = viewframe;
    this.drawn = true;
  }

  move(t) {
    this.pos.x += this.vel.x * t;
    this.pos.y += this.vel.y * t;
  }

  update() {
    if (this.e <= 0.1) {
      this.e = -1;
      for (let presentation of this.presentations) {
        if (!presentation || presentation.destroyed) {
          continue;
        }
        presentation.destroy();
        presentation = null;
      }
    }
    for (let presentation of this.presentations) {
      if (presentation != null && !presentation.destroyed) {
        presentation.x = this.pos.x - this.viewframe.pos.x;
        presentation.y = this.pos.y - this.viewframe.pos.y;
      }
    }
  }
}
