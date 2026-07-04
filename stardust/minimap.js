export { Minimap };
import { SCAN_RANGE } from "./wreck.js";

const SIZE = Math.round(window.innerWidth / 5.5);
const PADDING = Math.round(SIZE * 0.075);
const VIEW_RADIUS = 250000; // world units visible from ship to edge
const PLAYER_COLOR = "#00ff88";
const PLANET_COLOR = "#8888ff";
const BG_COLOR = "rgba(0,0,0,0.55)";
const BORDER_COLOR = "rgba(255,255,255,0.18)";
const FACTION_COLOR = {
  police:   "rgba(80,140,255,0.85)",
  military: "rgba(80,220,100,0.85)",
  pirate:   "rgba(255,80,80,0.85)",
  merchant: "rgba(255,210,60,0.85)",
};

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
    this.warpTunnels = props.warpTunnels ?? [];
    this.station = props.station ?? null;
    this._scale = null;
    this._hud = { targetName: null, targetColor: null, targetDist: null, targetPos: null, speed: null, torus: false, velAngle: null, shipAngle: 0, dockPrompt: null, dockedFlash: false, zoomRatio: 1 };
    this._otherShips = [];
    this._wrecks = [];

    const GS = 200;
    this._ghostSize = GS;
    this._ghostCanvas = document.createElement("canvas");
    this._ghostCanvas.width = GS;
    this._ghostCanvas.height = GS;
    Object.assign(this._ghostCanvas.style, {
      position: "fixed",
      left: "50%",
      top: "50%",
      transform: "translate(-50%, -50%)",
      pointerEvents: "none",
      zIndex: "900",
    });
    document.body.appendChild(this._ghostCanvas);
    this._ghostCtx = this._ghostCanvas.getContext("2d");
  }

  setHUD(hud) {
    this._hud = hud;
  }

  setOtherShips(ships) {
    this._otherShips = ships;
  }

  setWrecks(wrecks) {
    this._wrecks = wrecks;
  }

  destroy() {
    this.canvas.remove();
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

    // Warp tunnel edge markers — small orange triangles pointing inward at minimap rim
    const rimR = SIZE / 2 - PADDING * 0.6;
    for (const tunnel of this.warpTunnels) {
      const dx = tunnel.pos.x - ox;
      const dy = tunnel.pos.y - oy;
      const angle = Math.atan2(dy, dx);
      const ex = cx + Math.cos(angle) * rimR;
      const ey = cy + Math.sin(angle) * rimR;
      const aw = SIZE * 0.022; // arrow half-width
      const al = SIZE * 0.034; // arrow length
      ctx.save();
      ctx.translate(ex, ey);
      ctx.rotate(angle + Math.PI); // point inward
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-al, -aw);
      ctx.lineTo(-al, aw);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,160,40,0.75)";
      ctx.fill();
      ctx.restore();
    }

    // Station marker — small diamond (square rotated 45°)
    if (this.station) {
      const sx = cx + (this.station.pos.x - ox) * s;
      const sy = cy + (this.station.pos.y - oy) * s;
      const hw = SIZE * 0.022;
      ctx.save();
      ctx.translate(sx, sy);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = "rgba(80,200,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-hw, -hw, hw * 2, hw * 2);
      ctx.restore();
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

    // Other ships — only within minimap view radius, colored by faction
    for (const ship of this._otherShips) {
      if (ship.e < 0) continue;
      const sdx = ship.pos.x - ox;
      const sdy = ship.pos.y - oy;
      if (sdx * sdx + sdy * sdy > VIEW_RADIUS * VIEW_RADIUS) continue;
      ctx.beginPath();
      ctx.arc(cx + sdx * s, cy + sdy * s, SIZE * 0.013, 0, Math.PI * 2);
      ctx.fillStyle = FACTION_COLOR[ship.faction] ?? FACTION_COLOR.pirate;
      ctx.fill();
    }

    // Wreck scanner blips
    // INVARIANT: wreck rendering must mirror systemMap.js wreck rendering.
    // Both use SCAN_RANGE to gate ? (unresolved) vs × (resolved).
    // If you change the logic here, change it there too, and vice versa.
    for (const wreck of this._wrecks) {
      const wdx = wreck.pos.x - ox;
      const wdy = wreck.pos.y - oy;
      const distSq = wdx * wdx + wdy * wdy;
      if (distSq > VIEW_RADIUS * VIEW_RADIUS) continue;
      const wx = cx + wdx * s;
      const wy = cy + wdy * s;
      const resolved = distSq < SCAN_RANGE * SCAN_RANGE;
      if (resolved) {
        // Resolved: bright amber × cross
        const cs = SIZE * 0.018;
        ctx.save();
        ctx.strokeStyle = "rgba(255,180,40,0.95)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(wx - cs, wy - cs); ctx.lineTo(wx + cs, wy + cs);
        ctx.moveTo(wx + cs, wy - cs); ctx.lineTo(wx - cs, wy + cs);
        ctx.stroke();
        ctx.restore();
      } else {
        // Unresolved: dim grey ? mark
        ctx.save();
        ctx.fillStyle = "rgba(220,220,255,0.9)";
        ctx.font = `${SIZE * 0.045}px monospace`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", wx, wy);
        ctx.restore();
      }
    }

    // Prograde / retrograde markers
    const { velAngle, shipAngle } = this._hud;
    if (velAngle !== null) {
      const markerR = SIZE * 0.19;
      const markerSize = SIZE * 0.028;
      const ALIGN_DOT = Math.cos(5 * Math.PI / 180); // cos(5°)

      const headingDot = Math.cos(velAngle - shipAngle);
      const progradeAligned   = headingDot >  ALIGN_DOT;
      const retrogradeAligned = headingDot < -ALIGN_DOT;

      const pgx = cx + markerR * Math.cos(velAngle);
      const pgy = cy + markerR * Math.sin(velAngle);
      const rgx = cx - markerR * Math.cos(velAngle);
      const rgy = cy - markerR * Math.sin(velAngle);

      // Prograde — open circle
      ctx.save();
      ctx.strokeStyle = progradeAligned ? "rgba(0,255,136,1)" : "rgba(0,255,136,0.45)";
      ctx.lineWidth = progradeAligned ? 2 : 1;
      ctx.beginPath();
      ctx.arc(pgx, pgy, markerSize, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
      ctx.restore();

      // Retrograde — circle with cross inside
      ctx.save();
      ctx.strokeStyle = retrogradeAligned ? "rgba(255,160,0,1)" : "rgba(255,160,0,0.35)";
      ctx.lineWidth = retrogradeAligned ? 2 : 1;
      ctx.beginPath();
      ctx.arc(rgx, rgy, markerSize, 0, Math.PI * 2);
      ctx.closePath();
      ctx.stroke();
      const cr = markerSize * 0.55;
      ctx.beginPath();
      ctx.moveTo(rgx - cr, rgy);
      ctx.lineTo(rgx + cr, rgy);
      ctx.moveTo(rgx, rgy - cr);
      ctx.lineTo(rgx, rgy + cr);
      ctx.stroke();
      ctx.restore();
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
    const { targetName, targetColor, targetDist, speed, torus, dockPrompt, dockedFlash } = this._hud;

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
      ctx.fillStyle = torus ? "rgba(100,200,255,0.9)" : "rgba(0,255,136,0.8)";
      ctx.fillText(torus ? "c" : speed + " m/s", cx, cy + curveR - fontSize * 1.3);
    }

    // Dock prompt / docked confirmation — centred in minimap
    if (dockedFlash) {
      const pulse = 0.7 + 0.3 * Math.abs(Math.sin(performance.now() / 300));
      ctx.font = `bold ${Math.round(SIZE * 0.09)}px monospace`;
      ctx.fillStyle = `rgba(0,255,136,${pulse})`;
      ctx.fillText("DOCKED", cx, cy);
    } else if (dockPrompt === 'dock') {
      const pulse = 0.6 + 0.4 * Math.abs(Math.sin(performance.now() / 400));
      ctx.font = `bold ${Math.round(SIZE * 0.085)}px monospace`;
      ctx.fillStyle = `rgba(0,255,204,${pulse})`;
      ctx.fillText("[ DOCK ]", cx, cy);
    } else if (dockPrompt === 'approach') {
      ctx.font = `${Math.round(SIZE * 0.065)}px monospace`;
      ctx.fillStyle = "rgba(80,200,255,0.6)";
      ctx.fillText("approach", cx, cy);
    }

    ctx.restore();

    // Border ring — green flash on dock, blue pulse on torus
    ctx.beginPath();
    ctx.arc(cx, cy, SIZE / 2 - 0.5, 0, Math.PI * 2);
    ctx.strokeStyle = dockedFlash
      ? `rgba(0,255,136,${0.7 + 0.3 * Math.abs(Math.sin(performance.now() / 300))})`
      : torus
        ? `rgba(100,200,255,${0.6 + 0.35 * Math.sin(performance.now() / 200)})`
        : BORDER_COLOR;
    ctx.lineWidth = (dockedFlash || torus) ? 2 : 1;
    ctx.stroke();

    this._drawGhost();
  }

  _drawGhost() {
    const { shipAngle, zoomRatio, playerScreenX, playerScreenY } = this._hud;
    const gc = this._ghostCtx;
    const GS = this._ghostSize;

    gc.clearRect(0, 0, GS, GS);

    // Fade in below 30% zoom, fully visible at 5%
    const FADE_START = 0.3;
    const FADE_FULL  = 0.05;
    if (zoomRatio == null || zoomRatio > FADE_START) return;
    const alpha = Math.min(0.65, (FADE_START - zoomRatio) / (FADE_START - FADE_FULL));
    if (alpha <= 0) return;

    // Track the player's actual screen position (camera dead zone can offset it from centre)
    const screenCX = window.innerWidth  / 2 + (playerScreenX ?? 0);
    const screenCY = window.innerHeight / 2 + (playerScreenY ?? 0);
    Object.assign(this._ghostCanvas.style, {
      left: `${screenCX}px`,
      top:  `${screenCY}px`,
      transform: "translate(-50%, -50%)",
    });

    const cx = GS / 2;
    const cy = GS / 2;
    const t  = GS * 0.28;

    gc.save();
    gc.globalAlpha = alpha;
    gc.translate(cx, cy);
    gc.rotate(shipAngle);

    gc.beginPath();
    gc.moveTo(t, 0);
    gc.lineTo(-t * 0.6,  t * 0.7);
    gc.lineTo(-t * 0.6, -t * 0.7);
    gc.closePath();
    gc.strokeStyle = "#00ff88";
    gc.lineWidth = 2;
    gc.stroke();
    gc.fillStyle = "rgba(0,255,136,0.07)";
    gc.fill();

    gc.restore();
  }

  destroy() {
    this.canvas.remove();
    this._ghostCanvas.remove();
  }
}
