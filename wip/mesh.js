export { Meshes, Mesh }

const Meshes = {
  kPoly: "kPoly",
  kCircle: "kCircle"
}

class Mesh {
  constructor(props){
    this.kind = props.kind
    this.vertices = props.vertices
    this.color = props.color
    this.width = props.width;
    this.fill = props.fill
    this.center = props.center
    this.radius = props.radius
  }
  flatten() {
    let flat = []
    for(let v of this.vertices){
      flat.push(v[0])
      flat.push(v[1])
    }
    return flat
  }
}
