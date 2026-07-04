export { SystemMap };

import { PlanetKinds } from "./tinker/system.js";

const FACTION_COLOR = {
  police:   "rgba(80,140,255,0.9)",
  military: "rgba(80,220,100,0.9)",
  pirate:   "rgba(255,80,80,0.9)",
  merchant: "rgba(255,210,60,0.9)",
};

class SystemMap {
  constructor() {
    this._overlay = null;
    this._canvas  = null;
    this._visible = false;
    this._scene   = null;
    this._zoom    = 1;
    this._pan     = { x: 0, y: 0 };
    this._baseS   = 1; // base world→pixel scale (computed once on show)
    this._drag    = null; // { startX, startY, panX, panY } while dragging
  }

  get visible() { return this._visible; }

  show(scene) {
    if (this._visible) return;
    this._visible = true;
    this._scene   = scene;
    this._zoom    = 1;
    this._pan     = { x: 0, y: 0 };

    const overlay = document.createElement("div");
    Object.assign(overlay.style, {
      position: "fixed", inset: "0", background: "rgba(0,0,0,0.92)",
      zIndex: "8888", cursor: "grab",
    });

    const canvas = document.createElement("canvas");
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    Object.assign(canvas.style, { position: "absolute", inset: "0", display: "block" });
    overlay.appendChild(canvas);
    document.body.appendChild(overlay);

    this._overlay = overlay;
    this._canvas  = canvas;

    // Compute base scale once
    const allPos = [
      ...scene.renderedSystem.planetObjects.map(p => p.pos),
      ...scene.warpTunnels.map(t => t.pos),
    ];
    const maxDist = Math.max(1, ...allPos.map(p => Math.sqrt(p.x * p.x + p.y * p.y)));
    const PAD  = 60;
    const mapR = Math.min(canvas.width, canvas.height) / 2 - PAD;
    this._baseS = mapR / (maxDist * 1.08);

    // Wheel to zoom, centered on cursor
    overlay.addEventListener("wheel", (e) => {
      e.preventDefault();
      const rect  = canvas.getBoundingClientRect();
      const mx    = e.clientX - rect.left;
      const my    = e.clientY - rect.top;
      const cx    = canvas.width  / 2;
      const cy    = canvas.height / 2;
      const factor = e.deltaY < 0 ? 1.15 : 1 / 1.15;
      const newZoom = Math.max(0.5, Math.min(20, this._zoom * factor));
      // Keep world point under cursor fixed
      this._pan.x = (mx - cx) * (1 - newZoom / this._zoom) + this._pan.x * newZoom / this._zoom;
      this._pan.y = (my - cy) * (1 - newZoom / this._zoom) + this._pan.y * newZoom / this._zoom;
      this._zoom  = newZoom;
      this._draw();
    }, { passive: false });

    // Drag to pan
    overlay.addEventListener("mousedown", (e) => {
      this._drag = { startX: e.clientX, startY: e.clientY, panX: this._pan.x, panY: this._pan.y };
      overlay.style.cursor = "grabbing";
    });
    overlay.addEventListener("mousemove", (e) => {
      if (!this._drag) return;
      this._pan.x = this._drag.panX + (e.clientX - this._drag.startX);
      this._pan.y = this._drag.panY + (e.clientY - this._drag.startY);
      this._draw();
    });
    const endDrag = () => { this._drag = null; overlay.style.cursor = "grab"; };
    overlay.addEventListener("mouseup",   endDrag);
    overlay.addEventListener("mouseleave", endDrag);

    this._draw();
  }

  hide() {
    this._overlay?.remove();
    this._overlay = null;
    this._canvas  = null;
    this._visible = false;
    this._scene   = null;
  }

  _draw() {
    const canvas = this._canvas;
    const scene  = this._scene;
    if (!canvas || !scene) return;

    const ctx  = canvas.getContext("2d");
    const W    = canvas.width;
    const H    = canvas.height;
    const cx   = W / 2;
    const cy   = H / 2;
    const s    = this._baseS * this._zoom;
    const px   = this._pan.x;
    const py   = this._pan.y;

    const toScreen = (wx, wy) => ({ x: cx + px + wx * s, y: cy + py + wy * s });

    ctx.clearRect(0, 0, W, H);

    // Orbit rings
    ctx.save();
    scene.renderedSystem.planets.forEach(p => {
      ctx.beginPath();
      ctx.arc(cx + px, cy + py, p.distance * s, 0, Math.PI * 2);
      ctx.strokeStyle = "rgba(255,255,255,0.06)";
      ctx.lineWidth = 1;
      ctx.stroke();
    });
    ctx.restore();

    // Warp tunnel arrows
    for (const tunnel of scene.warpTunnels) {
      const angle   = Math.atan2(tunnel.pos.y, tunnel.pos.x);
      const sp      = toScreen(tunnel.pos.x, tunnel.pos.y);
      const aw = 8, al = 14;
      ctx.save();
      ctx.translate(sp.x, sp.y);
      ctx.rotate(angle + Math.PI);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(-al, -aw);
      ctx.lineTo(-al,  aw);
      ctx.closePath();
      ctx.fillStyle = "rgba(255,160,40,0.8)";
      ctx.fill();
      ctx.rotate(-(angle + Math.PI));
      ctx.font = "11px monospace";
      ctx.fillStyle = "rgba(255,160,40,0.65)";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(tunnel.name, 0, -18);
      ctx.restore();
    }

    // Planets + sun
    for (const obj of scene.renderedSystem.planetObjects) {
      const { x, y } = toScreen(obj.pos.x, obj.pos.y);
      const isSun = obj.pos.x === 0 && obj.pos.y === 0;
      const r = isSun ? 10 : 5;
      const col = obj.color ?? obj.averagedColor;
      let cssCol;
      if (Array.isArray(col)) {
        cssCol = `rgb(${Math.round(col[0]*255)},${Math.round(col[1]*255)},${Math.round(col[2]*255)})`;
      } else if (typeof col === "number") {
        cssCol = "#" + col.toString(16).padStart(6, "0");
      } else {
        cssCol = "#8888ff";
      }
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = cssCol;
      ctx.fill();
      if (isSun) {
        ctx.beginPath();
        ctx.arc(x, y, r * 2.4, 0, Math.PI * 2);
        ctx.strokeStyle = cssCol + "30";
        ctx.lineWidth = 7;
        ctx.stroke();
      }
    }

    // Station
    if (scene.station) {
      const { x, y } = toScreen(scene.station.pos.x, scene.station.pos.y);
      const hw = 6;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(Math.PI / 4);
      ctx.strokeStyle = "rgba(80,200,255,0.9)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(-hw, -hw, hw * 2, hw * 2);
      ctx.restore();
      ctx.font = "10px monospace";
      ctx.fillStyle = "rgba(80,200,255,0.6)";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      ctx.fillText(scene.station.name, x, y + 10);
    }

    // Other ships
    for (const ship of scene.otherShips) {
      if (ship.e < 0) continue;
      const { x, y } = toScreen(ship.pos.x, ship.pos.y);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = FACTION_COLOR[ship.faction] ?? FACTION_COLOR.pirate;
      ctx.fill();
    }

    // Player
    {
      const { x, y } = toScreen(scene.player.pos.x, scene.player.pos.y);
      const t = 7;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(scene.player.r);
      ctx.beginPath();
      ctx.moveTo( t, 0);
      ctx.lineTo(-t * 0.6,  t * 0.7);
      ctx.lineTo(-t * 0.6, -t * 0.7);
      ctx.closePath();
      ctx.fillStyle = "#00ff88";
      ctx.fill();
      ctx.restore();
    }

    // System name
    ctx.font = "bold 18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.7)";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(scene.renderedSystem.name.toUpperCase(), W / 2, 20);

    // Hints
    ctx.font = "12px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.3)";
    ctx.textBaseline = "bottom";
    ctx.fillText("[ ESC ] close   scroll to zoom   drag to pan", W / 2, H - 16);
  }
}
