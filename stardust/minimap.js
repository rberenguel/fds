export { Minimap };

const SIZE = Math.round(window.innerWidth / 5.5);
const PADDING = Math.round(SIZE * 0.075);
const VIEW_RADIUS = 250000; // world units visible from ship to edge
const PLAYER_COLOR = "#00ff88";
const PLANET_COLOR = "#8888ff";
const BG_COLOR = "rgba(0,0,0,0.55)";
const BORDER_COLOR = "rgba(255,255,255,0.18)";

class Minimap {
  constructor(props = {}) {
    this.canvas = document.createElement("canvas");
    this.canvas.width = SIZE;
    this.canvas.height = SIZE;
    Object.assign(this.canvas.style, {
      position: "absolute",
      bottom: "1.2em",
      right: "1.2em",
      borderRadius: "50%",
      border: `1px solid ${BORDER_COLOR}`,
      zIndex: "1000",
      imageRendering: "pixelated",
      pointerEvents: "none",
    });
    document.body.appendChild(this.canvas);
    this.ctx = this.canvas.getContext("2d");
    this.player = props.player;
    this.renderedSystem = props.renderedSystem;
    this._scale = null;
    this._hud = { targetName: null, targetColor: null, targetDist: null, targetPos: null, speed: null };
    this._otherShips = [];
  }

  setHUD(hud) {
    this._hud = hud;
  }

  setOtherShips(ships) {
    this._otherShips = ships;
  }

  _computeScale() {
    return (SIZE / 2 - PADDING) / VIEW_RADIUS;
  }

  _drawCurvedText(text, cx, cy, radius) {
    const ctx = this.ctx;
    // Measure total arc width, then center it at the bottom (θ = π/2)
    const charWidths = [];
    let totalWidth = 0;
    for (const ch of text) {
      const w = ctx.measureText(ch).width;
      charWidths.push(w);
      totalWidth += w;
    }
    const totalAngle = totalWidth / radius;
    let θ = Math.PI / 2 + totalAngle / 2;
    for (let i = 0; i < text.length; i++) {
      const charAngle = charWidths[i] / radius;
      const midθ = θ - charAngle / 2;
      ctx.save();
      ctx.translate(cx + radius * Math.cos(midθ), cy + radius * Math.sin(midθ));
      ctx.rotate(midθ - Math.PI / 2);
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(text[i], 0, 0);
      ctx.restore();
      θ -= charAngle;
    }
  }

  update() {
    const ctx = this.ctx;
    const cx = SIZE / 2;
    const cy = SIZE / 2;

    this._scale = this._computeScale();
    const s = this._scale;

    ctx.clearRect(0, 0, SIZE, SIZE);

    // Circular clip + background
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, SIZE / 2, 0, Math.PI * 2);
    ctx.fillStyle = BG_COLOR;
    ctx.fill();
    ctx.clip();

    // System objects — all positions relative to player
    const ox = this.player.pos.x;
    const oy = this.player.pos.y;
    for (const obj of this.renderedSystem.planetObjects) {
      const x = cx + (obj.pos.x - ox) * s;
      const y = cy + (obj.pos.y - oy) * s;
      const isSun = obj.pos.x === 0 && obj.pos.y === 0;
      if (isSun) {
        const c = obj.color ?? 0xffdd88;
        ctx.beginPath();
        ctx.arc(x, y, SIZE * 0.031, 0, Math.PI * 2);
        ctx.fillStyle = typeof c === "number"
          ? "#" + c.toString(16).padStart(6, "0")
          : c;
        ctx.fill();
      } else {
        ctx.beginPath();
        ctx.arc(x, y, SIZE * 0.016, 0, Math.PI * 2);
        ctx.fillStyle = PLANET_COLOR;
        ctx.fill();
      }
    }

    // Target lock: line from centre to targeted object + highlight dot
    const { targetPos } = this._hud;
    if (targetPos) {
      const tx = cx + (targetPos.x - ox) * s;
      const ty = cy + (targetPos.y - oy) * s;
      ctx.save();
      ctx.strokeStyle = "rgba(255,255,100,0.45)";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(tx, ty);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.arc(tx, ty, SIZE * 0.028, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,100,0.9)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.restore();
    }

    // Other ships
    for (const ship of this._otherShips) {
      if (ship.e < 0) continue;
      ctx.beginPath();
      ctx.arc(cx + (ship.pos.x - ox) * s, cy + (ship.pos.y - oy) * s, SIZE * 0.013, 0, Math.PI * 2);
      ctx.fillStyle = "rgba(255,80,80,0.85)";
      ctx.fill();
    }

    // Player triangle — always at centre
    const px = cx;
    const py = cy;
    const t = SIZE * 0.031;
    ctx.save();
    ctx.translate(px, py);
    ctx.rotate(this.player.r);
    ctx.beginPath();
    ctx.moveTo(t, 0);
    ctx.lineTo(-t * 0.6, t * 0.7);
    ctx.lineTo(-t * 0.6, -t * 0.7);
    ctx.closePath();
    ctx.fillStyle = PLAYER_COLOR;
    ctx.fill();
    ctx.restore();

    // HUD text — faint separator arc
    const { targetName, targetColor, targetDist, speed } = this._hud;

    const fontSize = Math.round(SIZE * 0.075);
    const smallFontSize = Math.round(SIZE * 0.065);
    // Curved text sits just inside the circle edge
    const curveR = SIZE / 2 - fontSize * 0.65;

    // Curved line: name + distance together in planet colour
    if (targetName && targetDist) {
      const col = targetColor
        ? `rgba(${Math.round(targetColor[0] * 255)},${Math.round(targetColor[1] * 255)},${Math.round(targetColor[2] * 255)},0.9)`
        : "rgba(255,255,255,0.85)";
      ctx.fillStyle = col;
      ctx.font = `bold ${fontSize}px monospace`;
      this._drawCurvedText(`${targetName.toUpperCase()}  ${targetDist}`, cx, cy, curveR);
    }

    // Speed centred above the curved line
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.font = `${smallFontSize}px monospace`;
    if (speed !== null) {
      ctx.fillStyle = "rgba(0,255,136,0.8)";
      ctx.fillText(speed + " m/s", cx, cy + curveR - fontSize * 1.3);
    }

    ctx.restore();

    // Border ring
    ctx.beginPath();
    ctx.arc(cx, cy, SIZE / 2 - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = BORDER_COLOR;
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  destroy() {
    this.canvas.remove();
  }
}
