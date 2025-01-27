export {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
  touchZoneHandler,
  getDeviceInput,
  VirtualPad
};

const keys = {};

const controllers = [];
const touchZoneHandler = (elt, kn) => {
  elt.addEventListener("mousedown", (ev) => {
    keys[kn] = true; // Mark the key as pressed
    if (elt.alsoClick) {
      elt.alsoClick();
    }
    ev.preventDefault();
  });
  elt.addEventListener("touchstart", (ev) => {
    keys[kn] = true; // Mark the key as pressed
    if (elt.alsoClick) {
      elt.alsoClick();
    }
    ev.preventDefault();
  });
  elt.addEventListener("mouseup", (ev) => {
    keys[kn] = false; // Mark the key as unpressed
    ev.preventDefault();
  });
  elt.addEventListener("touchend", (ev) => {
    keys[kn] = false; // Mark the key as unpressed
    ev.preventDefault();
  });
};

const bindGamepadHandlers = () => {
  window.addEventListener("gamepadconnected", function (e) {
    gamepadHandler(e, true);
    console.log(
      "Gamepad connected at index %d: %s. %d buttons, %d axes.",
      e.gamepad.index,
      e.gamepad.id,
      e.gamepad.buttons.length,
      e.gamepad.axes.length,
    );
  });
  window.addEventListener("gamepaddisconnected", function (e) {
    console.log(
      "Gamepad disconnected from index %d: %s",
      e.gamepad.index,
      e.gamepad.id,
    );
    gamepadHandler(e, false);
  });
};

const bindKeyHandlers = () => {
  document.addEventListener("keydown", (event) => {
    keys[event.code] = true; // Mark the key as pressed
    event.preventDefault();
  });

  document.addEventListener("keyup", (event) => {
    keys[event.code] = false; // Mark the key as released
    event.preventDefault();
  });
};

const buttonPressed = (b) => {
  if (typeof b == "object") {
    return b.pressed; // binary
  }
  return b > 0.9; // analog value
};

const logPads = () => {
  let gamepads = navigator.getGamepads();
  for (let i in controllers) {
    let controller = gamepads[i]; //controllers[i]
    if (controller.buttons) {
      for (let btn = 0; btn < controller.buttons.length; btn++) {
        let val = controller.buttons[btn];
        if (buttonPressed(val)) {
          console.log(btn);
        }
      }
    }
  }
};

const gamepadHandler = (event, connecting) => {
  let gamepad = event.gamepad;
  if (connecting) {
    controllers[gamepad.index] = gamepad;
  } else {
    delete controllers[gamepad.index];
  }
};

const getDeviceInput = async (kind) => {
  let input = null;
  while (input === null) {
    input = _getDeviceInput(kind);
    if (input === null) {
      await new Promise((resolve) => setTimeout(resolve, 10)); // Wait 10ms
    }
  }
  return input;
};

const _getDeviceInput = (kind) => {
  let gamepads = navigator.getGamepads();
  if (kind == "keyboard") {
    for (let key in keys) {
      if (keys[key]) {
        return key;
      }
    }
    return null;
  }
  if (kind == "gamepad") {
    for (let i in controllers) {
      let controller = gamepads[i];
      if (controller.buttons) {
        console.log("Buttons done");
        for (let b = 0; b < controller.buttons.length; b++) {
          if (buttonPressed(controller.buttons[b])) {
            return b;
          }
        }
      }
    }
    return null;
  }
};

const handleControls = (gameActions, keyMap, buttonMap) => {
  let gamepads = navigator.getGamepads();

  if (controllers.length == 0) {
    for (let key in keyMap) {
      if (keys[key]) {
        gameActions[keyMap[key]]();
      }
    }
    return;
  }

  for (let i in controllers) {
    let controller = gamepads[i]; //controllers[i]
    if (controller.buttons) {
      const pressed = (b) => buttonPressed(controller.buttons[b]);
      for (let button in buttonMap) {
        if (buttonPressed(controller.buttons[button.slice(1)])) {
          gameActions[buttonMap[button]]?.();
        }
      }
    }
  }
};


function pointInRect(x, y, rect) {
  console.log(x, y, rect)
  return (
    x >= rect.ul[0] && x <= rect.lr[0] && 
    y >= rect.ul[1] && y <= rect.lr[1]
  );
}

class VirtualPad {
  constructor(props){
    this.ix = 0
    this.iy = 0
    this.gameActions = props.gameActions
    this.padArea = props.padArea
    this.shootArea = props.shootArea
    this.padStarted = false
    this.shooting = false; 
    this.shootInterval = null;
    this.repeatFire = props.repeatFire ?? 100
    this.relativeRotation = props.relativeRotation
  }
  touchStart(e, ev) {
    // e should have x and y, and ev be a full event
    ev.preventDefault()
    if(pointInRect(e.x, e.y, this.padArea)){
      this.ix = e.x
      this.iy = e.y
      this.padStarted = true
      return
    }
    this.padStarted = false
    if(pointInRect(e.x, e.y, this.shootArea)){
      console.log(ev)
      this.startShooting()
    }
  }
  touchEnd(e) {
    if (pointInRect(e.x, e.y, this.shootArea)) {
      this.stopShooting();
    }
    this.padStarted = false
  }

  touchMove(e, r) {
    if(!this.padStarted){
      return
    }
    const vx = e.x - this.ix
    const vy = e.y - this.iy
    const angle = Math.atan2(vy, vx)
    const distance = Math.sqrt(vx * vx + vy * vy);
    if(distance < 75){
      return
    }
    const normalizedAngle = (angle + 2 * Math.PI) % (2 * Math.PI)// + r + Math.PI/2; // Normalize angle to 0-2PI
    if (normalizedAngle >= Math.PI * 7 / 4 || normalizedAngle < Math.PI / 4) {
      //console.log("Right"); 
      this.gameActions["moveRight"]()
    } else if (normalizedAngle >= Math.PI / 4 && normalizedAngle < Math.PI * 3 / 4) {
      if(distance < 150) {
        return
      }
      this.gameActions["moveDown"]()
      //console.log("Down");
    } else if (normalizedAngle >= Math.PI * 3 / 4 && normalizedAngle < Math.PI * 5 / 4) {
      this.gameActions["moveLeft"]()
       //console.log("Left");
    } else if (normalizedAngle >= Math.PI * 5 / 4 && normalizedAngle < Math.PI * 7 / 4) {
      if(distance < 150) {
        return
      }
      this.gameActions["moveUp"]()
      //console.log("Up");
    }

    // Intermediate areas (combine actions)
    if (normalizedAngle >= Math.PI / 8 && normalizedAngle < Math.PI * 3 / 8) {
      //console.log("Down-Right");
    } else if (normalizedAngle >= Math.PI * 5 / 8 && normalizedAngle < Math.PI * 7 / 8) {
      //console.log("Down-Left");
    } else if (normalizedAngle >= Math.PI * 9 / 8 && normalizedAngle < Math.PI * 11 / 8) {
      //console.log("Up-Left");
    } else if (normalizedAngle >= Math.PI * 13 / 8 && normalizedAngle < Math.PI * 15 / 8) {
      //console.log("Up-Right");
    } 
  }
  startShooting() {
    if (!this.shooting) {
      this.shooting = true;
      this.gameActions["shoot"](); 

      this.shootInterval = setInterval(() => {
        this.gameActions["shoot"]();
      }, this.repeatFire); 
    }
  }

  stopShooting() {
    if (this.shooting) {
      this.shooting = false;
      clearInterval(this.shootInterval); // Clear the interval
    }
  }
}
