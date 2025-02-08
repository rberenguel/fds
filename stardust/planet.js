export { planet, GiantPlanet };

import { Mesh as SMesh, Meshes } from "./mesh.js";
import { Base1 } from "./base.js";

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

import { rotate } from "./math.js";

const fragment = await Assets.load({
  src: "./giant_planet_1.frg",
  loadParser: "loadTxt",
});
const vertex = await Assets.load({
  src: "./giant_planet_1.vrt",
  loadParser: "loadTxt",
});

const planet = () =>
  new GiantPlanet({
    pos: { x: 200000, y: 2500 },
    radius: 80000,
    e: 100000,
    colors: [
      [0.0, 0.0, 1.0], //mid3
      [0.0, 0.0, 1.0], //mid2
      [0.0, 1.0, 0.0], //mid1
      [0.0, 0.5, 0.0], //top
      [0.0, 1.0, 1.0], //bottom
    ],
    /*colors: [
      [1.0, 0.4, 0.2], //mid3
      [0.7, 0.4, 0.3], //mid2
      [0.1, 0.2, 0.0], //mid1
      [0.8, 0.5, 0.8], //top
      [0]
    ],*/
  });

const rgbToPixiFill = (rgb) => {
  const [r, g, b] = rgb;
  return (
    (Math.round(r * 255) << 16) +
    (Math.round(g * 255) << 8) +
    Math.round(b * 255)
  );
};

class GiantPlanet extends Base1 {
  // This should cover gas and ice giants
  constructor(props) {
    const mesh = new SMesh({
      kind: Meshes.kPlanet,
      center: [0, 0],
      radius: props.radius,
      fill: rgbToPixiFill(props.colors[0]),
    });
    super({ ...props, meshes: [mesh] });
    // Required, list of RGB coordinates for the shader, 0-1 range.
    this.colors = props.colors;
  }

  generate(app) {
    // Overrides completely the super, since it needs to generate the textures
    // Also, this needs app to be able to render
    this.texture(app);
    let p = new Graphics();
    let q = new Graphics();
    const mesh = this.meshes[0];
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
    cc.addChild(this.sprite);
    c.addChild(cc);
    cc.planetTexture = true;
    const rad = mesh.radius;
    this.sprite.anchor.x = 0.5;
    this.sprite.anchor.y = 0.5;
    this.sprite.x = mesh.center[0];
    this.sprite.y = mesh.center[1];
    // Scale ideally is proportional to size (max of height and width) and adjusted for planet radius…
    this.sprite.scale = (2 * mesh.radius) / this.sprite._size;
    this.generated = true;
    this.presentations = [cc];
  }

  texture(app) {
    const shader = Shader.from({
      gl: {
        vertex,
        fragment,
      },
      resources: {
        ufs: {
          iResolution: { value: [1000, 1000, 1], type: "vec3<f32>" },
          col_mid3: { value: [0, 0, 0], type: "vec3<f32>" },
          col_mid2: { value: [0, 0, 0], type: "vec3<f32>" },
          col_mid1: { value: [0, 0, 0], type: "vec3<f32>" },
          col_top: { value: [0, 0, 0], type: "vec3<f32>" },
          col_bot: { value: [0, 0, 0], type: "vec3<f32>" },
          iTime: { value: 1, type: "f32" },
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
      },
      indexBuffer: [0, 1, 2, 0, 3, 2],
    });

    /*
    TODO: reuse geometry (and shader) across all planets. Will save some cycles.
  geometry 
  Includes vertex positions, face indices, colors, UVs, and custom attributes within buffers, reducing the cost of passing all this data to the GPU. Can be shared between multiple Mesh objects.
  
   material 
  Alias for shader.
  
   shader SHADER | null
  Represents the vertex and fragment shaders that processes the geometry and runs on the GPU. Can be shared between multiple Mesh objects.
    */

    shader.resources.ufs.uniforms.col_mid3 = this.colors[0];
    shader.resources.ufs.uniforms.col_mid2 = this.colors[1];
    shader.resources.ufs.uniforms.col_mid1 = this.colors[2];
    shader.resources.ufs.uniforms.col_top = this.colors[3];
    shader.resources.ufs.uniforms.col_bot = this.colors[4];

    let quad = new Mesh({
      geometry: quadGeometry,
      shader,
    });

    const size = Math.max(app.screen.width, app.screen.height);
    quad.width = size;
    quad.height = size;
    quad.x = size / 2;
    quad.y = size / 2;
    console.log(this.colors);

    const _texture = RenderTexture.create({
      width: size,
      height: size,
      resolution: 1,
    });
    app.renderer.render({ container: quad, target: _texture, clear: true });
    this.sprite = new Sprite(_texture);
    this.sprite._size = size;

    // TODO: destroy everything not used
  }
}
