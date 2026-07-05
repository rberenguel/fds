export { SystemMap };

import { PlanetKinds } from "./tinker/system.js";
import { SCAN_RANGE } from "./wreck.js";

const FACTION_COLOR = {
  police:   "rgba(80,140,255,0.9)",
  military: "rgba(80,220,100,0.9)",
  pirate:   "rgba(255,80,80,0.9)",
  merchant: "rgba(255,210,60,0.9)",
};

class SystemMap {
  constructor() {
    this._overlay  = null;
    this._canvas   = null;
    this._tooltip  = null;
    this._visible  = false;
    this._scene    = null;
    this._zoom     = 1;
    this._pan      = { x: 0, y: 0 };
    this._baseS    = 1; // base world→pixel scale (computed once on show)
    this._drag     = null; // { startX, startY, panX, panY } while dragging
    this._hitTargets   = []; // rebuilt each _draw(): [{ x, y, r, label, wx, wy }]
    this._hoveredTarget = null;
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

    const tooltip = document.createElement("div");
    Object.assign(tooltip.style, {
      position: "fixed", pointerEvents: "none", zIndex: "9999",
      background: "rgba(0,0,0,0.82)", border: "1px solid rgba(255,255,255,0.18)",
      color: "#dde", fontFamily: "monospace", fontSize: "12px",
      padding: "5px 9px", borderRadius: "4px", display: "none", whiteSpace: "pre",
    });
    document.body.appendChild(tooltip);
    this._tooltip = tooltip;

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
      if (this._drag) {
        this._pan.x = this._drag.panX + (e.clientX - this._drag.startX);
        this._pan.y = this._drag.panY + (e.clientY - this._drag.startY);
      }
      // Hover hit-test
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const hit = this._hitTargets.find(t => (mx - t.x) ** 2 + (my - t.y) ** 2 < t.r * t.r);
      this._hoveredTarget = hit ?? null;
      if (hit) {
        this._tooltip.style.display = "block";
        this._tooltip.style.left = `${e.clientX + 14}px`;
        this._tooltip.style.top  = `${e.clientY + 14}px`;
        this._tooltip.textContent = hit.label;
      } else {
        this._tooltip.style.display = "none";
      }
      this._draw();
    });
    const endDrag = () => { this._drag = null; overlay.style.cursor = "grab"; };
    overlay.addEventListener("mouseup",   endDrag);
    overlay.addEventListener("mouseleave", () => {
      endDrag();
      this._hoveredTarget = null;
      this._tooltip.style.display = "none";
      this._draw();
    });

    this._draw();
  }

  hide() {
    this._overlay?.remove();
    this._tooltip?.remove();
    this._overlay = null;
    this._canvas  = null;
    this._tooltip = null;
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
    this._hitTargets = [];

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
      this._hitTargets.push({ x: sp.x, y: sp.y, r: 18, label: tunnel.name, wx: tunnel.pos.x, wy: tunnel.pos.y });
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
      const bodyName = isSun ? obj.name : (obj.p?.kind ?? obj.kind ?? 'Planet').replace('k','');
      this._hitTargets.push({ x, y, r: Math.max(14, r * 2), label: bodyName, wx: obj.pos.x, wy: obj.pos.y });
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
      this._hitTargets.push({ x, y, r: 16, label: scene.station.name, wx: scene.station.pos.x, wy: scene.station.pos.y });
    }

    // Other ships
    for (const ship of scene.otherShips) {
      if (ship.e < 0) continue;
      const { x, y } = toScreen(ship.pos.x, ship.pos.y);
      ctx.beginPath();
      ctx.arc(x, y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = FACTION_COLOR[ship.faction] ?? FACTION_COLOR.pirate;
      ctx.fill();
      const shipLabel = ship.traderName
        ? `${ship.traderName} (${ship.faction})`
        : ship.faction ?? 'unknown';
      this._hitTargets.push({ x, y, r: 10, label: shipLabel, wx: ship.pos.x, wy: ship.pos.y });
    }

    // Wrecks — ? if unresolved, × if within scan range
    // INVARIANT: wreck rendering must mirror minimap.js wreck rendering.
    // Both use SCAN_RANGE to gate ? (unresolved) vs × (resolved).
    // If you change the logic here, change it there too, and vice versa.
    const plx = scene.player.pos.x;
    const ply = scene.player.pos.y;
    for (const wreck of (scene.wrecks ?? [])) {
      const { x, y } = toScreen(wreck.pos.x, wreck.pos.y);
      const dx = wreck.pos.x - plx;
      const dy = wreck.pos.y - ply;
      const resolved = dx * dx + dy * dy < SCAN_RANGE * SCAN_RANGE;
      ctx.save();
      if (resolved) {
        const cs = 5;
        ctx.strokeStyle = "rgba(255,170,50,0.85)";
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(x - cs, y - cs); ctx.lineTo(x + cs, y + cs);
        ctx.moveTo(x + cs, y - cs); ctx.lineTo(x - cs, y + cs);
        ctx.stroke();
        const lootDesc = wreck.loot.map(l =>
          l.kind === 'ammo'    ? `${l.count}× ${l.weapon.replace('k','').replace(/([A-Z])/g,' $1').trim()}` :
          l.kind === 'credits' ? `${l.count} credits` :
          l.name ?? l.id
        ).join('\n');
        this._hitTargets.push({ x, y, r: 12, label: `Wreck\n${lootDesc}`, wx: wreck.pos.x, wy: wreck.pos.y });
      } else {
        ctx.fillStyle = "rgba(220,220,255,0.9)";
        ctx.font = "11px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("?", x, y);
        this._hitTargets.push({ x, y, r: 12, label: "Unknown signal source", wx: wreck.pos.x, wy: wreck.pos.y });
      }
      ctx.restore();
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

      const p = scene.player;
      const weaponNames = (p.weapons ?? [])
        .map(w => w.kind?.replace('k','').replace(/([A-Z])/g,' $1').trim() ?? '?')
        .join(', ');
      const ammoLines = Object.entries(p.ammo ?? {})
        .map(([kind, a]) => `  ${kind.replace('k','').replace(/([A-Z])/g,' $1').trim()}: ${Math.floor(a.count)}`)
        .join('\n');
      const cargoLines = (p.cargo ?? [])
        .map(item => `  ${item.name ?? item.id}`)
        .join('\n');
      const credits = p.credits != null ? `Credits: ${p.credits}` : null;

      const lines = [
        `Weapons: ${weaponNames || 'none'}`,
        ammoLines ? `Ammo:\n${ammoLines}` : null,
        `Cargo: ${(p.cargo ?? []).length === 0 ? 'empty' : ''}` + (cargoLines ? `\n${cargoLines}` : ''),
        `Credits: ${p.credits ?? 0}`,
      ].filter(Boolean).join('\n');

      this._hitTargets.push({ x, y, r: 14, label: lines, isPlayer: true });
    }

    // Hover distance line — from player to hovered object
    const ht = this._hoveredTarget;
    if (ht && !ht.isPlayer && ht.wx != null) {
      const playerHit = this._hitTargets.find(t => t.isPlayer);
      if (playerHit) {
        const dx = ht.wx - scene.player.pos.x;
        const dy = ht.wy - scene.player.pos.y;
        const distWorld = Math.sqrt(dx * dx + dy * dy);
        const distLabel = distWorld < 1000
          ? `${Math.round(distWorld)} u`
          : distWorld < 1e6
          ? `${(distWorld / 1000).toFixed(1)}k u`
          : `${(distWorld / 1e6).toFixed(2)}M u`;

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = "rgba(0,255,136,0.45)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(playerHit.x, playerHit.y);
        ctx.lineTo(ht.x, ht.y);
        ctx.stroke();
        ctx.setLineDash([]);

        const mx = (playerHit.x + ht.x) / 2;
        const my = (playerHit.y + ht.y) / 2;
        ctx.font = "11px monospace";
        ctx.fillStyle = "rgba(0,255,136,0.8)";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(distLabel, mx, my - 10);
        ctx.restore();
      }
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
