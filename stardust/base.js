export { Base1, giantTexture, renderGiant };

import {
  Graphics,
  Filter,
  Assets,
  GlProgram,
  Mesh,
  Shader,
  Geometry,
  RenderTexture,
  Container,
} from "../libs/3rdparty/pixi.mjs";

import { Meshes } from "./mesh.js";

const giantTexture = (app) =>
  RenderTexture.create({
    width: app.screen.width,
    height: app.screen.height,
    resolution: 1,
  });

const renderGiant = async (app, texture) => {
  const fragment = await Assets.load({
    src: "./custom.frg",
    loadParser: "loadTxt",
  });
  const vertex = await Assets.load({
    src: "./custom.vrt",
    loadParser: "loadTxt",
  });

  console.log(fragment);
  //console.log(vertex);

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

  /*
geometry 
Includes vertex positions, face indices, colors, UVs, and custom attributes within buffers, reducing the cost of passing all this data to the GPU. Can be shared between multiple Mesh objects.

 material 
Alias for shader.

 shader SHADER | null
Represents the vertex and fragment shaders that processes the geometry and runs on the GPU. Can be shared between multiple Mesh objects.


  */

  let quad = new Mesh({
    geometry: quadGeometry,
    shader,
  });
  quad.i_shader = shader;

  quad.width = 1000;
  quad.height = 1000;
  quad.x = 0;
  quad.y = 0;

  //app.stage.addChild(quad);

  //app.renderer.render({ container: quad, target: texture, clear: true });
  //quad.destroy(true);
  //quad = null;
  return quad;
};

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
    this.meshes = props?.meshes;
  }

  generate() {
    let p = new Graphics();
    for (const mesh of this.meshes) {
      if (mesh.kind === Meshes.kPoly) {
        p.poly(mesh.flatten());
        console.log(mesh);
        console.log(mesh.fill);
        console.log(mesh.fill !== undefined);
        if (mesh.fill !== undefined) {
          console.log("Setting fill");
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
      if (mesh.kind === Meshes.kPlanet) {
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
        cc.addChild(mesh.texture);
        c.addChild(cc);
        cc.planetTexture = true;
        mesh.texture.x = mesh.center[0];
        mesh.texture.y = mesh.center[1];
        mesh.texture.scale = 1000;
        this.generated = true;
        this.presentations = [cc];
        return;
      }
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
        presentation.destroy();
        presentation = null;
      }
    }
    for (let presentation of this.presentations) {
      if (presentation != null && !presentation.destroyed) {
        presentation.x = this.pos.x - this.viewframe.pos.x;
        presentation.y = this.pos.y - this.viewframe.pos.y;
        if (presentation.planetTexture) {
          const app = this.viewframe.app;
          const w = app.screen.width;
          const h = app.screen.height;
          const scale = this.viewframe.scale;
          let t = this.meshes[0].texture;
          //console.log(this.meshes[0].radius*scale)
          const r = this.meshes[0].radius;
          t.scale.x = r;
          t.scale.y = r;
          //t.x = this.pos.x// - this.viewframe.pos.x;
          t.x = 0;
          t.y = 0;
          t.i_shader.resources.shaderToyUniforms.uniforms.uTextureOffset = [
            (scale * (this.pos.x - this.viewframe.pos.x)) / 1000,
            (-scale * (this.pos.y - this.viewframe.pos.y)) / 1000,
          ]; //[scale*(this.pos.x - this.viewframe.pos.x), -scale*(this.pos.y - this.viewframe.pos.y)]
          //console.log(scale*(this.pos.x - this.viewframe.pos.x)/1000)
          //console.log(scale * (this.pos.x - this.viewframe.pos.x)/4000)
          //console.log(t.i_shader.resources.shaderToyUniforms.uniforms.uTextureOffset[0])
          //console.log(250-scale*(this.pos.y - this.viewframe.pos.y))
          t.i_shader.resources.shaderToyUniforms.uniforms.uTextureScale = scale;
        }
      }
    }
  }
}
