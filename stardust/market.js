export { MarketScreen };

import { commodityRegistry, SystemCategories } from './tinker/systemEconomy.js';

const SELL_FACTOR = 0.9; // player receives 90% of market price (transaction surcharge)

const S = {
  overlay: `position:fixed;inset:0;background:rgba(0,0,0,0.9);color:#00ff88;font-family:monospace;
            display:flex;flex-direction:column;align-items:center;z-index:9999;overflow:auto;padding:2em 1em`,
  panel:   `max-width:760px;width:100%;`,
  title:   `font-size:1.6em;font-weight:bold;letter-spacing:0.12em;color:#00ffcc;margin-bottom:0.2em`,
  sub:     `color:#558866;font-size:0.82em;margin-bottom:1em`,
  stats:   `display:flex;gap:2em;font-size:0.9em;margin-bottom:1.2em;padding:0.5em 0;
            border-top:1px solid #1a4a3a;border-bottom:1px solid #1a4a3a`,
  table:   `width:100%;border-collapse:collapse;font-size:0.85em`,
  th:      `text-align:left;padding:0.3em 0.5em;color:#558866;border-bottom:1px solid #1a4a3a;
            font-size:0.78em;letter-spacing:0.08em`,
  thR:     `text-align:right;padding:0.3em 0.5em;color:#558866;border-bottom:1px solid #1a4a3a;
            font-size:0.78em;letter-spacing:0.08em`,
  td:      `padding:0.3em 0.5em;border-bottom:1px solid #0d2a20`,
  tdR:     `padding:0.3em 0.5em;border-bottom:1px solid #0d2a20;text-align:right`,
  btn:     `padding:0.1em 0.4em;margin:0 1px;background:#0a2a1a;border:1px solid #336644;
            color:#00cc66;font-family:monospace;font-size:0.8em;cursor:pointer`,
  btnSell: `padding:0.1em 0.4em;margin:0 1px;background:#2a1a00;border:1px solid #664400;
            color:#cc8800;font-family:monospace;font-size:0.8em;cursor:pointer`,
  btnDim:  `opacity:0.25;cursor:default`,
  undock:  `margin-top:2em;padding:0.5em 2em;background:#0a2a1a;border:1px solid #00ff88;
            color:#00ff88;font-family:monospace;font-size:1em;letter-spacing:0.1em;cursor:pointer`,
  section: `color:#558866;font-size:0.78em;letter-spacing:0.1em;margin:1.2em 0 0.5em`,
  item:    `color:#aaffcc;font-size:0.82em;padding:0.2em 0.5em`,
};

class MarketScreen {
  constructor({ player, system, stationName, onUndock }) {
    this.player    = player;
    this.system    = system;
    this.stationName = stationName;
    this.onUndock  = onUndock;
    this._el       = null;
  }

  get _cargoUsed() {
    return Object.values(this.player.inventory ?? {}).reduce((a, b) => a + b, 0)
      + (this.player.cargo ?? []).length;
  }

  get _cargoMax() { return this.player.cargoMax ?? 20; }

  // ── public ────────────────────────────────────────────────────────────────

  show() {
    this._el = this._buildEl();
    document.body.appendChild(this._el);
  }

  hide() {
    this._el?.remove();
    this._el = null;
  }

  // ── build DOM ─────────────────────────────────────────────────────────────

  _buildEl() {
    const el = document.createElement('div');
    el.style.cssText = S.overlay;

    const catName = SystemCategories.repr(this.system.category)?.name ?? this.system.category;
    const govName = this.system.government;

    el.innerHTML = `
      <div style="${S.panel}">
        <div style="${S.title}">⬡ STATION MARKET</div>
        <div style="${S.sub}">${this.stationName} &nbsp;·&nbsp; ${this.system.name} &nbsp;·&nbsp; ${catName} &nbsp;·&nbsp; ${govName}</div>
        <div data-stats style="${S.stats}">${this._statsHTML()}</div>
        <table style="${S.table}">
          <thead>
            <tr>
              <th style="${S.th}">COMMODITY</th>
              <th style="${S.thR}">BUY</th>
              <th style="${S.thR}">SELL</th>
              <th style="${S.thR}">DOCK STOCK</th>
              <th style="${S.thR}">IN HOLD</th>
              <th style="${S.thR}">PROFIT</th>
              <th style="${S.th}"></th>
            </tr>
          </thead>
          <tbody data-rows>${this._rowsHTML()}</tbody>
        </table>
        ${this._equipmentHTML()}
        <div style="text-align:center">
          <button data-undock style="${S.undock}">UNDOCK</button>
        </div>
      </div>`;

    this._attachHandlers(el);
    return el;
  }

  _statsHTML() {
    const cr   = Math.floor(this.player.credits ?? 0).toLocaleString();
    const used = this._cargoUsed;
    const max  = this._cargoMax;
    const cargoColor = used >= max ? '#ff4444' : '#aaffcc';
    return `<span>Credits: <span style="color:#ffff88">${cr} cr</span></span>
            <span>Cargo: <span style="color:${cargoColor}">${used} / ${max} t</span></span>`;
  }

  _rows() {
    const map = new Map();
    const add = (commodity) => {
      if (!map.has(commodity.id)) {
        const inPlayer  = this.player.inventory?.[commodity.id] ?? 0;
        const buyPrice  = Math.round(this.system.getPrice(commodity.id));
        const sellPrice = Math.round(this.system.getPrice(commodity.id) * SELL_FACTOR);
        const avgCost   = this.player.inventoryCost?.[commodity.id] ?? null;
        const profit    = avgCost != null && inPlayer > 0
          ? Math.round((sellPrice - avgCost) * inPlayer)
          : null;
        map.set(commodity.id, {
          commodity,
          inSystem: this.system.getInventory(commodity.id),
          inPlayer, buyPrice, sellPrice, profit,
        });
      }
    };
    for (const { commodity } of this.system.getProducedCommodities()) add(commodity);
    for (const { commodity } of this.system.getConsumedCommodities()) add(commodity);
    for (const [id] of Object.entries(this.player.inventory ?? {})) {
      const c = commodityRegistry.getCommodity(id);
      if (c) add(c);
    }
    return [...map.values()];
  }

  _rowsHTML() {
    const cargoFull = this._cargoUsed >= this._cargoMax;
    const credits   = this.player.credits ?? 0;

    return this._rows().map(({ commodity, inSystem, inPlayer, buyPrice, sellPrice }) => {
      const id   = commodity.id;
      const canB1  = !cargoFull && inSystem >= 1  && credits >= buyPrice;
      const canB10 = !cargoFull && inSystem >= 10 && credits >= buyPrice * 10;
      const canS1  = inPlayer >= 1;
      const canS10 = inPlayer >= 10;

      const bBtn  = (qty, can) => can
        ? `<button data-buy="${id}:${qty}" style="${S.btn}">+${qty}</button>`
        : `<button style="${S.btn};${S.btnDim}" disabled>+${qty}</button>`;
      const sBtn = (qty, can) => can
        ? `<button data-sell="${id}:${qty}" style="${S.btnSell}">−${qty}</button>`
        : `<button style="${S.btnSell};${S.btnDim}" disabled>−${qty}</button>`;

      const holdColor  = inPlayer > 0 ? 'color:#aaffcc' : 'color:#446655';
      const stockColor = inSystem > 0 ? 'color:#88ccaa' : 'color:#446655';
      const profitHTML = profit == null
        ? `<span style="color:#446655">—</span>`
        : profit > 0
          ? `<span style="color:#44ff88">+${profit} cr</span>`
          : profit < 0
            ? `<span style="color:#ff5555">${profit} cr</span>`
            : `<span style="color:#888888">0 cr</span>`;

      return `<tr>
        <td style="${S.td};color:#00ccaa">${commodity.name}</td>
        <td style="${S.tdR};color:#cccc44">${buyPrice} cr</td>
        <td style="${S.tdR};color:#cc8800">${sellPrice} cr</td>
        <td style="${S.tdR};${stockColor}">${inSystem}</td>
        <td style="${S.tdR};${holdColor}">${inPlayer}</td>
        <td style="${S.tdR}">${profitHTML}</td>
        <td style="${S.td}">${bBtn(1, canB1)}${bBtn(10, canB10)}&nbsp;&nbsp;${sBtn(1, canS1)}${sBtn(10, canS10)}</td>
      </tr>`;
    }).join('');
  }

  _equipmentHTML() {
    const items = this.player.cargo ?? [];
    if (items.length === 0) return '';
    const rows = items.map(item =>
      `<div style="${S.item}">▸ ${item.name ?? item.id}</div>`
    ).join('');
    return `<div style="${S.section}">EQUIPMENT IN HOLD</div>${rows}`;
  }

  // ── interactions ──────────────────────────────────────────────────────────

  _attachHandlers(el) {
    el.querySelector('[data-undock]').addEventListener('click', () => this.onUndock?.());

    el.addEventListener('click', (e) => {
      const buyBtn  = e.target.closest('[data-buy]');
      const sellBtn = e.target.closest('[data-sell]');
      if (buyBtn)  { const [id, q] = buyBtn.dataset.buy.split(':');   this._buy(id, +q);  }
      if (sellBtn) { const [id, q] = sellBtn.dataset.sell.split(':'); this._sell(id, +q); }
    });
  }

  _refresh() {
    if (!this._el) return;
    this._el.querySelector('[data-stats]').innerHTML  = this._statsHTML();
    this._el.querySelector('[data-rows]').innerHTML   = this._rowsHTML();
  }

  _buy(commodityId, qty) {
    const price     = Math.round(this.system.getPrice(commodityId));
    const stock     = this.system.getInventory(commodityId);
    const cargoFree = this._cargoMax - this._cargoUsed;
    const canAfford = Math.floor((this.player.credits ?? 0) / price);
    const actual    = Math.min(qty, stock, cargoFree, canAfford);
    if (actual <= 0) return;

    // Weighted average cost basis
    this.player.inventoryCost ??= {};
    const oldQty  = this.player.inventory?.[commodityId] ?? 0;
    const oldCost = this.player.inventoryCost[commodityId] ?? price;
    this.player.inventoryCost[commodityId] = (oldCost * oldQty + price * actual) / (oldQty + actual);

    this.player.credits = (this.player.credits ?? 0) - price * actual;
    this.player.inventory ??= {};
    this.player.inventory[commodityId] = oldQty + actual;
    this.system.removeFromInventory(commodityId, actual);
    this._refresh();
  }

  _sell(commodityId, qty) {
    const playerStock = this.player.inventory?.[commodityId] ?? 0;
    const actual      = Math.min(qty, playerStock);
    if (actual <= 0) return;

    const sellPrice = Math.round(this.system.getPrice(commodityId) * SELL_FACTOR);
    this.player.credits = (this.player.credits ?? 0) + sellPrice * actual;
    this.player.inventory[commodityId] = playerStock - actual;
    if (this.player.inventory[commodityId] === 0) {
      delete this.player.inventory[commodityId];
      delete this.player.inventoryCost?.[commodityId];
    }
    this.system.addToInventory(commodityId, actual);
    this._refresh();
  }
}
