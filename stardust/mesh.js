export { Meshes, Mesh };

const Meshes = {
  kPoly: "kPoly",
  kCircle: "kCircle",
  kPlanet: "kPlanet",
};

class Mesh {
  constructor(props) {
    this.name = props.name ?? "";
    this.kind = props.kind;
    this.vertices = props.vertices;
    this.color = props.color;
    this.width = props.width;
    this.fill = props.fill;
    this.gradienter = props.gradienter;
    this.center = props.center;
    this.radius = props.radius;
    this.texture = props.texture;
  }
  flatten() {
    let flat = [];
    for (let v of this.vertices) {
      flat.push(v[0]);
      flat.push(v[1]);
    }
    return flat;
  }
}
