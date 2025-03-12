export { VirtualPad };

function pointInRect(x, y, rect) {
  return (
    x >= rect.ul[0] && x <= rect.lr[0] && y >= rect.ul[1] && y <= rect.lr[1]
  );
}

class VirtualPad {
  constructor(props) {
    this.ix = 0;
    this.iy = 0;
    this.currentStrength = 0;
    this.gameActions = props.gameActions;
    this.padArea = props.padArea;
    this.shootArea = props.shootArea;
    this.padStarted = false;
    this.shooting = false;
    this.shootInterval = null;
    this.repeatFire = props.repeatFire ?? 100;
    this.repeatMove = props.repeatMove ?? 30;
    this.relativeRotation = props.relativeRotation;
    this.displacement = props.displacement ?? 75;
    this.moving = false;
    this.debug = props.debug;
    if (this.debug) {
      this.debugTouchStartElement = document.createElement("DIV");
      this.debugTouchStartElement.id = "virtualpad-touchstart";
      this.debugTouchStartElement.style.display = "none";
      this.debugTouchMoveElement = document.createElement("DIV");
      this.debugTouchMoveElement.id = "virtualpad-touchmove";
      document.body.appendChild(this.debugTouchStartElement);
      document.body.appendChild(this.debugTouchMoveElement);
    }
  }
  touchStart(e, ev) {
    // e should have x and y, and ev be a full event
    ev.preventDefault();
    if (this.debug && this.debugTouchStartElement) {
      // Check both debug flag and element existence
      this.debugTouchStartElement.style.left = e.x + "px";
      this.debugTouchStartElement.style.top = e.y + "px";
      this.debugTouchStartElement.style.display = "block";
      // (No setTimeout here - hide it in touchEnd)
    }
    if (pointInRect(e.x, e.y, this.padArea)) {
      this.ix = e.x;
      this.iy = e.y;
      this.padStarted = true;
      return;
    }
    this.padStarted = false;
    if (pointInRect(e.x, e.y, this.shootArea)) {
      this.startShooting();
    }
  }
  touchEnd(e) {
    if (this.debug) {
      // Check both debug flag and element existence
      this.debugTouchStartElement.style.display = "none";
      this.debugTouchMoveElement.style.display = "none";
      // (No setTimeout here - hide it in touchEnd)
    }
    if (pointInRect(e.x, e.y, this.shootArea)) {
      this.stopShooting();
    }
    if (this.padStarted) {
      this.stopMoving();
    }
    this.padStarted = false;
  }

  touchMove(e, r) {
    if (!this.padStarted) {
      return;
    }
    if (this.debug && this.debugTouchMoveElement) {
      // Check both debug flag and element existence
      this.debugTouchMoveElement.style.left = e.x + "px";
      this.debugTouchMoveElement.style.top = e.y + "px";
      this.debugTouchMoveElement.style.display = "block";
      // (No setTimeout here - hide it in touchEnd)
    }
    const vx = e.x - this.ix;
    const vy = e.y - this.iy;
    // The r correction works here but is not natural at all
    const angle = Math.atan2(vy, vx); // - Math.PI/2 - r()
    const distance = Math.sqrt(vx * vx + vy * vy);
    // Calculate strength based on distance
    let strength = 0; // Initialize strength to 0 here - Corrected!

    if (distance > this.displacement) {
      // Check only against displacement now
      if (this.debugTouchMoveElement) {
        // Debug code (keep if needed)
        this.debugTouchMoveElement.classList.add("green");
      }
      // Strength is proportional to distance *beyond* displacement
      strength = Math.min(
        1,
        (distance - this.displacement) / this.displacement, // Adjusted strength calculation
      ); // Normalize to 0-1, starting from displacement
    } else {
      if (this.debugTouchMoveElement) {
        // Debug code (keep if needed)
        this.debugTouchMoveElement.classList.remove("green");
      }
      return; // Exit if distance is NOT greater than displacement - Corrected logic
    }
    this.currentStrength = strength;
    const normalizedAngle = (angle + 2 * Math.PI) % (2 * Math.PI);
    if (normalizedAngle >= (Math.PI * 7) / 4 || normalizedAngle < Math.PI / 4) {
      this.startMoving("moveRight"); // Pass strength
    } else if (
      normalizedAngle >= Math.PI / 4 &&
      normalizedAngle < (Math.PI * 3) / 4
    ) {
      if (distance < this.displacement) {
        return;
      }
      this.startMoving("moveDown"); // Pass strength, reduced for diagonals
    } else if (
      normalizedAngle >= (Math.PI * 3) / 4 &&
      normalizedAngle < (Math.PI * 5) / 4
    ) {
      this.startMoving("moveLeft"); // Pass strength
    } else if (
      normalizedAngle >= (Math.PI * 5) / 4 &&
      normalizedAngle < (Math.PI * 7) / 4
    ) {
      if (distance < this.displacement) {
        return;
      }
      this.startMoving("moveUp"); // Pass strength, reduced for diagonals
    }
    if (distance < 0.6 * this.displacement) {
      return;
    }
    // Intermediate areas (combine actions)
    if (normalizedAngle >= Math.PI / 8 && normalizedAngle < (Math.PI * 3) / 8) {
      this.startMoving("moveDown"); // Pass strength
      this.startMoving("moveRight"); // Pass strength
    } else if (
      normalizedAngle >= (Math.PI * 5) / 8 &&
      normalizedAngle < (Math.PI * 7) / 8
    ) {
      this.startMoving("moveDown"); // Pass strength
      this.startMoving("moveLeft"); // Pass strength
    } else if (
      normalizedAngle >= (Math.PI * 9) / 8 &&
      normalizedAngle < (Math.PI * 11) / 8
    ) {
      this.startMoving("moveUp"); // Pass strength
      this.startMoving("moveLeft"); // Pass strength
    } else if (
      normalizedAngle >= (Math.PI * 13) / 8 &&
      normalizedAngle < (Math.PI * 15) / 8
    ) {
      this.startMoving("moveUp"); // Pass strength
      this.startMoving("moveRight"); // Pass strength
    }
  }

  startShooting() {
    if (!this.shooting) {
      this.shooting = true;
      this.gameActions["shoot"](); // No strength for shooting in this example

      this.shootInterval = setInterval(() => {
        this.gameActions["shoot"](); // No strength for shooting in this example
      }, this.repeatFire);
    }
  }

  startMoving(direction) {
    // <--- Strength argument added
    if (this.padStarted) {
      if (this.moving == direction) {
        return;
      }
      this.moving = direction;
      this.gameActions[direction](this.currentStrength); // <--- Pass strength to gameAction
      if (this.moveInterval) {
        clearInterval(this.moveInterval);
      }

      this.moveInterval = setInterval(() => {
        this.gameActions[direction](this.currentStrength); // <--- Pass strength to gameAction in interval too
      }, this.repeatMove);
    }
  }

  stopShooting() {
    if (this.shooting) {
      this.shooting = false;
      clearInterval(this.shootInterval); // Clear the interval
    }
  }
  stopMoving() {
    if (this.moveInterval) {
      clearInterval(this.moveInterval); // Clear the interval
    }
  }
}
