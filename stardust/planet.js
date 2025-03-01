export {
  EarthLikePlanet,
  GasGiantPlanet,
  IceGiantPlanet,
  RockyPlanet,
  AtmospherePlanet,
  Sun,
};

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
  BlurFilter,
} from "../libs/3rdparty/pixi.mjs";

import { rotate } from "./math.js";

import { seededRnd } from "./rnd.js";
import { System, PlanetKinds } from "./tinker/system.js";

// Note: y coordinates are reversed… is it worth the fix internally?

const fluidFragment = await Assets.load({
  src: "./giant_planet_1.frg",
  loadParser: "loadTxt",
});

const craterFragment = await Assets.load({
  src: "./moon.glsl",
  loadParser: "loadTxt",
});

const vertex = await Assets.load({
  src: "./giant_planet_1.vrt",
  loadParser: "loadTxt",
});

const averageColors = (...colors) => {
  if (colors.length === 0) {
    return [0, 0, 0]; // Return black (or any default) for an empty list
  }

  let sumR = 0;
  let sumG = 0;
  let sumB = 0;

  for (const color of colors) {
    sumR += color[0];
    sumG += color[1];
    sumB += color[2];
  }

  const numColors = colors.length;
  return [sumR / numColors, sumG / numColors, sumB / numColors];
};

// TODO: This should be a renderer in System

const planets_ = () => {
  const rad = 100;
  const ps = [
    new EarthLikePlanet({
      pos: { x: 500, y: -200 },
      radius: rad,
      e: 100000,
    }),
    new EarthLikePlanet({
      pos: { x: 500, y: -200 },
      radius: rad,
      e: 100000,
    }),
    new AtmospherePlanet({
      pos: { x: 500, y: 200 },
      radius: rad,
      e: 100000,
    }),
    new AtmospherePlanet({
      pos: { x: 500, y: 200 },
      radius: rad,
      e: 100000,
    }),
    new GasGiantPlanet({
      pos: { x: 500, y: 200 },
      radius: rad,
      e: 100000,
    }),
    new GasGiantPlanet({
      pos: { x: 500, y: 200 },
      radius: rad,
      e: 100000,
    }),
    new IceGiantPlanet({
      pos: { x: 200, y: 300 },
      radius: rad,
      e: 100000,
    }),
    new IceGiantPlanet({
      pos: { x: 200, y: 300 },
      radius: rad,
      e: 100000,
    }),
    new RockyPlanet({
      pos: { x: 200, y: 300 },
      radius: rad,
      e: 100000,
    }),
    new RockyPlanet({
      pos: { x: 200, y: 300 },
      radius: rad,
      e: 100000,
    }),
  ];
  for (let i = 0; i < ps.length; i++) {
    const x = Math.cos((i * Math.PI * 2) / ps.length) * 400;
    const y = Math.sin((i * Math.PI * 2) / ps.length) * 400;
    let p = ps[i];
    p.pos.x = x;
    p.pos.y = y;
  }
  return ps;
};

/*colors: [
      [0.0, 0.0, 1.0], //mid3
      [0.0, 0.0, 1.0], //mid2
      [0.0, 1.0, 0.0], //mid1
      [0.0, 0.5, 0.0], //top
      [0.0, 1.0, 1.0], //bottom
    ],*/
/*colors: [
      [1.0, 0.4, 0.2], //mid3
      [0.7, 0.4, 0.3], //mid2
      [0.1, 0.2, 0.0], //mid1
      [0.8, 0.5, 0.8], //top
      [0]
    ],*/
const rgbToPixiFill = (rgb) => {
  const [r, g, b] = rgb;
  return (
    (Math.round(r * 255) << 16) +
    (Math.round(g * 255) << 8) +
    Math.round(b * 255)
  );
};

class Planet extends Base1 {
  // This should cover gas and ice giants
  constructor(props) {
    const mesh = new SMesh({
      kind: Meshes.kPlanet,
      center: [0, 0],
      radius: props.radius,
      fill: 0x222222, //rgbToPixiFill(props.colors[0]),
    });
    super({ ...props, meshes: [mesh] });
    // Required, list of RGB coordinates for the shader, 0-1 range.
    this.layers = props.layers;
    this.rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    this.p = props.p;
  }

  generate(app) {
    // Overrides completely the super, since it needs to generate the textures
    // Also, this needs app to be able to render
    if (this.atmospheric) {
      this.textureAtmospheric(app);
    }
    if (this.rocky) {
      this.textureRocky(app);
    }

    let p = new Graphics();
    let q = new Graphics();
    const mesh = this.meshes[0];
    p.circle(mesh.center[0], mesh.center[1], mesh.radius);

    if (mesh.width) {
      p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
      q.stroke({ color: mesh.color, width: mesh.width ?? 0 });
    }
    if (mesh.fill !== undefined) {
      p.fill(mesh.fill);
    }
    let cc = new Container();
    cc.mask = p;
    cc.addChild(p);
    for (let sprite of this.sprites) {
      cc.addChild(sprite);
      sprite.anchor.x = 0.5;
      sprite.anchor.y = 0.5;
      sprite.x = mesh.center[0];
      sprite.y = mesh.center[1];
      // Scale ideally is proportional to size (max of height and width) and adjusted for planet radius…
      sprite.scale = (2 * mesh.radius) / this.sprites._size;
      if (sprite.fillGlow) {
        q.circle(
          mesh.center[0],
          mesh.center[1],
          sprite.fillGlow.size * mesh.radius,
        );
        q.fill(sprite.fillGlow.color);

        q.alpha = 0.4;
        cc.addChild(q);
      }
    }

    this.generated = true;
    this.presentations = [q, cc];
  }

  textureAtmospheric(app) {
    const shader = Shader.from({
      gl: {
        vertex: vertex,
        fragment: fluidFragment,
      },
      resources: {
        ufs: {
          iResolution: { value: [1000, 1000, 1], type: "vec3<f32>" },
          col_mid3: { value: [0, 0, 0], type: "vec3<f32>" },
          col_mid2: { value: [0, 0, 0], type: "vec3<f32>" },
          col_mid1: { value: [0, 0, 0], type: "vec3<f32>" },
          col_top: { value: [0, 0, 0], type: "vec3<f32>" },
          col_bot: { value: [0, 0, 0], type: "vec3<f32>" },
          col_skip: { value: [0, 0, 0], type: "vec3<f32>" },
          col_shift: { value: [0, 0, 0], type: "vec3<f32>" },
          stretch: { value: [1, 1], type: "vec2<f32>" },
          col_threshold: { value: 0.1, type: "f32" },
          shifting: { value: 3 * this.rnd(), type: "f32" },
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

    this.sprites = [];
    let counter = 0;
    for (let layer of this.layers) {
      const colors = layer.colors;
      shader.resources.ufs.uniforms.col_mid3 = colors[0];
      shader.resources.ufs.uniforms.col_mid2 = colors[1];
      shader.resources.ufs.uniforms.col_mid1 = colors[2];
      shader.resources.ufs.uniforms.col_top = colors[3];
      shader.resources.ufs.uniforms.col_bot = colors[4];
      shader.resources.ufs.uniforms.col_shift = layer.color_shift ?? [0, 0, 0];
      shader.resources.ufs.uniforms.col_skip = layer.skip;
      shader.resources.ufs.uniforms.col_threshold = layer.threshold;
      shader.resources.ufs.uniforms.stretch = layer.stretch ?? [1, 1];
      counter++;
      shader.resources.ufs.uniforms.shifting = counter + this.rnd() * 3;
      let quad = new Mesh({
        geometry: quadGeometry,
        shader: shader,
      });
      const size = Math.max(app.screen.width, app.screen.height);
      quad.width = size;
      quad.height = size;
      quad.x = size / 2;
      quad.y = size / 2;

      const _texture = RenderTexture.create({
        width: size,
        height: size,
        resolution: 1,
        alphaMode: "no-premultiply-alpha",
      });

      app.renderer.render({
        container: quad,
        target: _texture,
        clear: true,
        backgroundAlpha: 0,
      });
      let sprite = new Sprite(_texture);
      if (layer.fillGlow) {
        sprite.fillGlow = {};
        sprite.fillGlow.color = averageColors(...colors);
        this.averagedColor = sprite.fillGlow.color;
        sprite.fillGlow.size = layer.fillGlow;
      }
      if (layer.tint) {
        sprite.tint = layer.tint;
      }
      this.sprites.push(sprite);
      this.sprites._size = size;
    }
    if (!this.averagedColor) {
      this.averagedColor = averageColors(...this.layers[0].colors);
    }
    console.log(this.averagedColor);
    // TODO: destroy everything not used
  }

  textureRocky(app) {
    const shader = Shader.from({
      gl: {
        vertex: vertex,
        fragment: craterFragment,
      },
      resources: {
        ufs: {
          iResolution: { value: [1000, 1000, 1], type: "vec3<f32>" },
          in_color: { value: [0, 0, 0], type: "vec3<f32>" },
          shifting: { value: 3 * this.rnd(), type: "f32" },
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

    this.sprites = [];
    let counter = 0;
    for (let layer of this.layers) {
      const colors = layer.colors;

      shader.resources.ufs.uniforms.in_color = colors[0];
      counter++;
      shader.resources.ufs.uniforms.shifting = this.rnd() * 3;
      let quad = new Mesh({
        geometry: quadGeometry,
        shader: shader,
      });
      const size = Math.max(app.screen.width, app.screen.height);
      quad.width = size;
      quad.height = size;
      quad.x = size / 2;
      quad.y = size / 2;

      const _texture = RenderTexture.create({
        width: size,
        height: size,
        resolution: 1,
        alphaMode: "no-premultiply-alpha",
      });

      app.renderer.render({
        container: quad,
        target: _texture,
        clear: true,
        backgroundAlpha: 0,
      });
      let sprite = new Sprite(_texture);
      if (layer.fillGlow) {
        sprite.fillGlow = {};
        sprite.fillGlow.color = averageColors(...colors);
        this.averagedColor = sprite.fillGlow.color;
        sprite.fillGlow.size = layer.fillGlow;
      }
      if (!this.averagedColor) {
        this.averagedColor = averageColors(...this.layers[0].colors);
      }
      this.sprites.push(sprite);
      this.sprites._size = size;
    }

    // TODO: destroy everything not used
  }
}

class EarthLikePlanet extends Planet {
  constructor(props) {
    const rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    const layers = [
      {
        colors: [
          [0.6, 0.4, 0.25], // Rich brown
          [0.55, 0.45, 0.3], // Earthy brown
          [0.45, 0.35, 0.2], // Muted brown
          [0.65, 0.5, 0.35], // Ochre/Golden brown
          [0.45, 0.35, 0.2],
        ],
        skip: [0.45, 0.35, 0.2],
        threshold: 0.0,
      },
      {
        colors: [
          [0.1, 0.3, 0.1],
          [0.3, 0.6, 0.2],
          [0.45, 0.35, 0.2],
          [0.0, 0.0, 0.9],
          [0.25, 0.45, 0.2],
        ],
        skip: [0.45, 0.35, 0.2],
        threshold: 0.1 * rnd(),
        fillGlow: 1.1,
      },
      {
        colors: [
          [1.0, 1.0, 1.0],
          [0.9, 0.9, 0.9],
          [0.9, 0.9, 0.9],
          [0.9, 0.9, 0.9],
          [0.9, 0.9, 0.9],
        ],
        skip: [0.5, 0.5, 0.5],
        color_shift: [0.5, 0.5, 0.5],
        threshold: 0.32,
      },
    ];
    super({ ...props, layers: layers });
    this.atmospheric = true;
    this.rnd = rnd;
    this.kind = PlanetKinds.EarthLike;
  }
}

class GasGiantPlanet extends Planet {
  constructor(props) {
    // This should be yellow/orange dominant
    const rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    const c1 = [0.5 + 0.5 * rnd(), 0.2 + 0.2 * rnd(), 0.5 * rnd()];
    const layers = [
      {
        colors: [
          c1, //mid3
          [0.7, 0.4, 0.3], //mid2
          [0.1, 0.2, 0.0], //mid1
          [1.0, 1.0, 1.0], //top
          [0, 0, 0],
        ],
        skip: [0.45, 0.35, 0.2],
        threshold: 0.0,
        stretch: [3 + rnd() * 2, 1],
        fillGlow: 1.1,
      },
    ];
    super({ ...props, layers: layers });
    this.atmospheric = true;
    this.rnd = rnd;
    this.kind = PlanetKinds.GasGiant;
  }
}

class IceGiantPlanet extends Planet {
  constructor(props) {
    // This should be blue/turquoise dominant
    const rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    const c1 = [0.2 * rnd(), 0.2 + 0.7 * rnd(), 0.5 + 0.5 * rnd()];
    const layers = [
      {
        colors: [
          c1, //[.2, 0.4, 1.0], //mid3
          [0.3, 0.4, 0.7], //mid2
          [0.0, 0.2, 0.1], //mid1
          [1.0, 1.0, 1.0], //top
          [0, 0, 0],
        ],
        skip: [0.45, 0.35, 0.2],
        threshold: 0.0,
        stretch: [5 + rnd() * 2, 1],
        fillGlow: 1.1,
      },
    ];
    super({ ...props, layers: layers });
    this.atmospheric = true;
    this.rnd = rnd;
    this.kind = PlanetKinds.IceGiant;
  }
}

class AtmospherePlanet extends Planet {
  constructor(props) {
    const rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    const c1 = [0.2 + 0.6 * rnd(), 0.2 + 0.6 * rnd(), 0.2 + 0.6 * rnd()];
    const c2 = [0.2 + 0.6 * rnd(), 0.2 + 0.6 * rnd(), 0.2 + 0.6 * rnd()];
    const c3 = [0.2 + 0.6 * rnd(), 0.2 + 0.6 * rnd(), 0.2 + 0.6 * rnd()];
    const layers = [
      {
        colors: [
          c1, // Rich brown
          [0.55, 0.45, 0.3], // Earthy brown
          [0.45, 0.35, 0.2], // Muted brown
          [0.65, 0.5, 0.35], // Ochre/Golden brown
          [0.45, 0.35, 0.2],
        ],
        skip: [0.45, 0.35, 0.2],
        threshold: 0.0,
        stretch: [0.5 + rnd(), 0.5 + rnd()],
      },
      {
        colors: [
          c2,
          [0.3, 0.6, 0.2],
          [0.45, 0.35, 0.2],
          [0.0, 0.0, 0.9],
          [0.25, 0.45, 0.2],
        ],
        skip: [0.45, 0.35, 0.2],
        threshold: 0.8 * rnd(),
        stretch: [0.5 + rnd(), 0.5 + rnd()],
        fillGlow: 1.1,
      },
      {
        colors: [c3, c2, c1, [0.9, 0.9, 0.9], [0.9, 0.9, 0.9]],
        skip: [0.3, 0.3, 0.3],
        threshold: 0.32,
      },
    ];
    super({ ...props, layers: layers });
    this.atmospheric = true;
    this.rnd = rnd;
    this.kind = PlanetKinds.Atmosphere;
  }
}

class RockyPlanet extends Planet {
  constructor(props) {
    const rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    const c1 = [0.5 + 0.2 * rnd(), 0.5 + 0.2 * rnd(), 0.5 + 0.2 * rnd()];
    const layers = [
      {
        colors: [
          c1, //[.2, 0.4, 1.0], //mid3
        ],
        fillGlow: 1.05,
      },
    ];
    super({ ...props, layers: layers });
    this.rocky = true;
    this.rnd = rnd;
    this.kind = PlanetKinds.Rocky;
  }
}

class Sun extends Planet {
  constructor(props) {
    // This should be pretty uniform
    // TODO tint very subtly via the sun shade
    const rnd = props.seed
      ? seededRnd(props.seed)
      : seededRnd(performance.now());
    const c1 = [
      0.999 + 0.05 * rnd(),
      0.999 + 0.05 * rnd(),
      0.999 + 0.05 * rnd(),
    ];
    const layers = [
      {
        colors: [
          c1, //[.2, 0.4, 1.0], //mid3
          c1,
          c1,
          c1,
          c1,
        ],
        skip: [0.0, 0.0, 0.0],
        stretch: [-5 + rnd() * 10, -5 + rnd() * 10],
        color_shift: [0.8, 0.8, 0.1],
        threshold: 0.0,
        fillGlow: 1.2,
        tint: props.color,
      },
    ];
    super({ ...props, layers: layers });
    this.atmospheric = true;
    this.rnd = rnd;
    this.color = props.color;
    console.log(props.color);
    this.kind = PlanetKinds.Sun;
    this.name = props.name ?? PlanetKinds.Sun;
  }
}
