export { Viewframe }

import { Base1 } from "./base.js"

import {
  Container
} from "../libs/3rdparty/pixi.mjs";


import { rotate } from "./math.js"

class Viewframe extends Base1 {
  constructor(props){
    super(props)
    this.scale = 1
  }
  attach(app){
    const viewframe = new Container();
    this.presentation = viewframe
    app.stage.addChild(viewframe); 
  }
  update(){
    //super.update()
    this.presentation.scale.set(this.scale)
  }
}
