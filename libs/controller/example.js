import { set, get } from "../3rdparty/idb-keyval.js";

import {
  bindGamepadHandlers,
  bindKeyHandlers,
  handleControls,
  VirtualPad,
} from "./controlHandling.js";

bindGamepadHandlers();
bindKeyHandlers();

let keyMap = await get("keyMap");

if (keyMap === undefined) {
  keyMap = {
    ArrowUp: "moveUp",
    ArrowDown: "moveDown",
    ArrowLeft: "moveLeft",
    ArrowRight: "moveRight",
    Space: "shoot",
    KeyQ: "menu",
  };
}

let buttonMap = await get("buttonMap");

if (buttonMap === undefined) {
  buttonMap = {
    b15: "moveRight",
    b14: "moveLeft",
    b13: "moveDown",
    b12: "moveUp",
    b1: "shoot",
    //b2: "reload",
  };
}
const directionIndicator = document.getElementById(
  "direction-indicator-container",
);
const directionArrow = document.getElementById("direction-arrow");

const gameActions = {
  moveUp: (f = 1) => {
    console.log("moveUp", f);
    updateDirectionIndicator("up", f); // Update indicator for moveUp
  },
  moveDown: (f = 1) => {
    console.log("moveDown", f);
    updateDirectionIndicator("down", f); // Update indicator for moveDown
  },
  moveRight: (f = 1) => {
    console.log("moveRight", f);
    updateDirectionIndicator("right", f); // Update indicator for moveRight
  },
  moveLeft: (f = 1) => {
    console.log("moveLeft", f);
    updateDirectionIndicator("left", f); // Update indicator for moveLeft
  },
  shoot: () => {
    console.log("shoot");
    hideDirectionIndicator(); // Hide indicator for shoot (or adjust as needed)
  },
  menu: () => {
    console.log("menu");
    hideDirectionIndicator(); // Hide indicator for menu (or adjust as needed)
  },
};

// --- New functions for direction indicator ---
function updateDirectionIndicator(direction, strength) {
  directionIndicator.style.display = "block"; // Show the container

  let rotation = 0;
  switch (direction) {
    case "up":
      rotation = 0;
      break; // Up is 0 degrees
    case "down":
      rotation = 180;
      break; // Down is 180 degrees
    case "left":
      rotation = -90;
      break; // Left is -90 degrees (or 270)
    case "right":
      rotation = 90;
      break; // Right is 90 degrees
  }

  directionArrow.style.transform = `rotate(${rotation}deg) scale(${1 + strength * 1.5})`; // Rotate and scale
}

const virtualPad = new VirtualPad({
  gameActions: gameActions,
  displacement: Math.min(window.innerWidth / 2, window.innerHeight) / 4, // Adjust displacement as needed
  padArea: {
    ul: [0, 0], // Upper-Left corner at the very top-left of the screen (x=0, y=0)
    lr: [window.innerWidth / 2, window.innerHeight], // Lower-Right corner at the vertical center and full screen height
  },
  shootArea: {
    ul: [window.innerWidth / 2, 0], // Upper-Left corner starts at the horizontal center, top of screen
    lr: [window.innerWidth, window.innerHeight], // Lower-Right corner is at the very bottom-right (full width, full height)
  },
  debug: true, // Keep debug enabled for visual feedback
});

// Touch event listeners for virtual pad - now on document.body
document.body.addEventListener(
  "touchstart",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

document.body.addEventListener(
  "touchmove",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

document.body.addEventListener(
  "touchend",
  (e) => {
    e.preventDefault();
  },
  { passive: false },
);

document.body.addEventListener("pointerdown", (e) => {
  virtualPad.touchStart(e, e); // Pass raw event now, VirtualPad expects x, y in first arg
});
document.body.addEventListener("pointermove", (e) => {
  virtualPad.touchMove(e, () => 0); // Dummy r function
});
document.body.addEventListener("pointerup", (e) => {
  virtualPad.touchEnd(e, e); // Pass raw event now, VirtualPad expects x, y in first arg
});

const focusTrap = document.getElementById("focus-trap"); // Assuming you still have focus-trap in HTML
focusTrap.focus();

const controller = handleControls(gameActions, keyMap, buttonMap); // Initialize controls

function getLandscapeDimensions() {
  const screenWidth = window.innerWidth;
  const screenHeight = window.innerHeight;

  if (screenWidth >= screenHeight) {
    return { width: screenWidth, height: screenHeight };
  } else {
    return { width: screenHeight, height: screenWidth };
  }
}

function resizeForLandscape() {
  // No PixiJS resize anymore, if you need to resize viewport elements, do it here.
  console.log("resizeForLandscape called (no PixiJS)");
}

function handleOrientationChange() {
  if (window.screen.orientation === 90 || window.screen.orientation === -90) {
    document.body.classList.add("landscape");
  } else {
    document.body.classList.remove("landscape");
  }
  resizeForLandscape();
}

window.addEventListener("orientationchange", handleOrientationChange);
handleOrientationChange();

setInterval(() => {
  controller();
}, 30);
