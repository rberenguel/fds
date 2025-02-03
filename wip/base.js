export { Base1 }

import {
  Graphics
} from "../libs/3rdparty/pixi.mjs";

import { Mesh, Meshes } from "./mesh.js"

class Base1 {
  constructor(props){
    this.pos = {
      x: props?.pos?.x ?? 0,
      y: props?.pos?.y ?? 0
    }
    this.vel = {
      x: props?.vel?.x ?? 0,
      y: props?.vel?.y ?? 0
    }
    this.r = props?.r ?? 0;
    this.e = props?.e ?? 0;
    this.meshes = props?.meshes;
  }

  generate(){
    let p = new Graphics()
    for(const mesh of this.meshes){
      if(mesh.kind === Meshes.kPoly){
        p.poly(mesh.flatten());
        console.log(mesh)
        console.log(mesh.fill)
        console.log(mesh.fill !== undefined)
        if(mesh.fill !== undefined){
          console.log("Setting fill")
          p.fill(mesh.fill)
        }
        if(mesh.width){
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
      }
      if(mesh.kind === Meshes.kCircle){
        p.circle(mesh.center[0], mesh.center[1], mesh.radius);
        if(mesh.width){
          p.stroke({ color: mesh.color, width: mesh.width ?? 0 });
        }
        if(mesh.fill !== undefined){
          p.fill(mesh.fill)
        }
      }
    } 
    this.presentation = p
    this.generated = true
  }

  attach(viewframe){
    viewframe.presentation.addChild(this.presentation)
    this.viewframe = viewframe
    this.drawn = true
  }

  move(t){
    this.pos.x += this.vel.x * t;
    this.pos.y += this.vel.y * t;
  }

  update(){
    if(this.e <= 0.1){
      this.e = -1;
      this.presentation?.destroy()
      this.presentation = null
    }
    if(this.presentation != null && !this.presentation.destroyed){
      this.presentation.x = this.pos.x - this.viewframe.pos.x
      this.presentation.y = this.pos.y- this.viewframe.pos.y
    }
  }
}


