export { Ship }

import { Mesh, Meshes } from "./mesh.js"

import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";

class Base1 {
  constructor(props){
    console.log(props)
    this.pos = {
      x: props.pos.x ?? 0,
      y: props.pos.y ?? 0
    }
    this.vel = {
      x: props.vel?.x ?? 0,
      y: props.vel?.y ?? 0
    }
    this.r = props.r ?? 0;
    this.e = props.e ?? 0;
    this.meshes = props.meshes;
    console.log(this)
  }

  generate(){
    let p = new Graphics()
    for(const mesh of this.meshes){
      if(mesh.kind === Meshes.kPoly){
        p.poly(mesh.flatten());
        console.log(mesh.flatten())
        console.log(mesh.color, mesh.width)
        p.stroke({ color: mesh.color, width: mesh.width });
      }
    } 
    this.presentation = p
    this.generated = true
    console.log("Generated")
  }

  attach(app){
    console.log("Attaching")
    app.stage.addChild(this.presentation);
    this.drawn = true
    console.log("Attached")
  }

  move(t){
    this.pos.x += this.vel.x * t;
    this.pos.y += this.vel.y * t;
  }

  update(){
    if(this.e <= 0.1){
      this.e = -1;
      this.presentation.destroy()
    }
  }
}


class Ship extends Base1 {
  static kind = "kShip"

  constructor(props) {
    const mesh = new Mesh({
      kind: Meshes.kPoly,
      vertices: [[-70, 50], [70, 0], [-70, -50], [-30, 0], [-70, 50]],
      color: 0xffffff,
      width: 10
    })
    super({...props, meshes: [mesh] });
    console.log("Constructed")
    this.e = 1000
  }

  generate(){
    console.log("Generating")
    super.generate()
    this.presentation.scale.set(0.1)
    console.log("Generated")
    console.log(this)
  }

  /* pos would be universe coordinates, then here I need to use screen coordinates */

  update(delta) {
    super.update(delta)
    super.move(delta.deltaTime)
    this.presentation.rotation = this.r;
    this.presentation.x = this.pos.x
    this.presentation.y = this.pos.y; 
  }
}
