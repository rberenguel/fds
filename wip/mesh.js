export { Meshes, Mesh }

const Meshes = {
  kPoly: "kPoly"
}

class Mesh {
  constructor(props){
    this.kind = props.kind
    this.vertices = props.vertices
    this.color = props.color
    this.width = props.width ?? 1;
    console.log(this)
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
